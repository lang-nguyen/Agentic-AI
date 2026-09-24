from typing import Callable, Awaitable, Any
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, dynamic_prompt, after_model, wrap_model_call
from langgraph.runtime import Runtime
from langchain_core.messages import AIMessage
from agentic_ai.llm.llm_factory import get_default_llm
from agentic_ai.tools.tool_manager import ToolManager
from agentic_ai.state.react_state import State, Configuration
from agentic_ai.model import ExtraState
from agentic_ai.persistence.threads import save_guest_thread
from agentic_ai.persistence.events import publish_thread_created, publish_new_message
from agentic_ai.services import ArtifactService


def _resolve_state(state: State, runtime: Runtime[Configuration]) -> State:
    raw_extra = state.get("extra")
    if not raw_extra:
        extra = ExtraState(assignee="agent")
    else:
        extra = ExtraState.model_validate(raw_extra, extra="ignore")
    return State(messages=state.get("messages", []), extra=extra)


@dynamic_prompt()
def _build_system_prompt(request: ModelRequest) -> str:
    context = getattr(request.runtime, "context", None)
    if context and getattr(context, "agent_prompt", None):
        return context.agent_prompt
        
    instruction = "You need to act as an agent that use the above tools to help the user according to the policy. Response in short and concise way. Don't use markdown format."
    policy = ""
    return f"<instruction>\n{instruction}\n</instruction>\n<policy>\n{policy}\n</policy>\n"


@after_model
async def save_thread(state: State, runtime: Runtime[Configuration]):
    state = _resolve_state(state, runtime)
    extra = state["extra"]
    if not extra.customer_thread_id:
        extra.customer_thread_id = runtime.execution_info.thread_id
        if runtime.store:
            await save_guest_thread(runtime.store, runtime.execution_info.thread_id)
        await publish_thread_created(runtime.execution_info.thread_id)
        
    await publish_new_message(runtime.execution_info.thread_id)
    extra = extra.clear_events()
    return {"extra": extra}


@wrap_model_call
async def wrap_model(request: ModelRequest, handler: Callable[[ModelRequest], Awaitable[ModelResponse]]) -> ModelResponse:
    context = getattr(request.runtime, "context", None)
    reasoning = context.reasoning if context else True
    if reasoning:
        reasoning_model = request.model.model_copy(update={
            "reasoning": True
        })
        response = await handler(request.override(model=reasoning_model))
    else:
        response = await handler(request)
        
    raw_extra = request.state.get("extra")
    if not raw_extra:
        return response

    extra = ExtraState.from_state(raw_extra)
    if not extra.events or not response.result:
        return response

    last_msg = response.result[-1]
    if isinstance(last_msg, AIMessage) and not last_msg.tool_calls:
        artifacts = {}
        for event in extra.events:
            if event.get("type") != "new_artifact":
                continue
            key = event.get("key")
            val = event.get("value")
            if key == "user":
                artifacts["user"] = ArtifactService.create_user_artifact(val)
            elif key == "order":
                artifacts["order"] = ArtifactService.create_order_artifact(val)

        if artifacts:
            last_msg.additional_kwargs["artifact"] = artifacts
                
    return response


react_agent = create_agent(
    model=get_default_llm(),
    tools=ToolManager().get_available_tools(),
    middleware=[_build_system_prompt, save_thread, wrap_model],
    state_schema=State
)
