from typing import Callable, Awaitable, Any
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, dynamic_prompt, after_model, wrap_model_call
from langgraph.runtime import Runtime
from langchain_core.messages import AIMessage, ToolMessage
from agentic_ai.llm.llm_factory import get_default_llm
from agentic_ai.tools.tool_manager import ToolManager
from agentic_ai.state.react_state import State, Configuration
from agentic_ai.model import ExtraState
from agentic_ai.persistence.threads import save_guest_thread
from agentic_ai.persistence.events import publish_thread_created, publish_new_message
from agentic_ai.services import ArtifactService
from agentic_ai.prompts.customer_support_prompt import CUSTOMER_SUPPORT_PROMPT


def _resolve_state(state: State, runtime: Runtime[Configuration]) -> State:
    raw_extra = state.get("extra")
    if not raw_extra:
        extra = ExtraState(assignee="agent")
    else:
        extra = ExtraState.model_validate(raw_extra, extra="ignore")
    return State(messages=state.get("messages", []), extra=extra)


@dynamic_prompt()
async def _build_system_prompt(request: ModelRequest) -> str:
    from agentic_ai.infra.web_api import get_current_user
    context = getattr(request.runtime, "context", None)
    user = await get_current_user()
    if context and getattr(context, "customer_support_prompt", None):
        prompt = context.customer_support_prompt
        prompt += f"\n<user_profile>\n{user}\n</user_profile>"
        return prompt
        
    return f"{CUSTOMER_SUPPORT_PROMPT}\n<user_context>\n{user}\n</user_context>"


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
    # Lọc bỏ message là tool call transfer_to_agent đi 
    filtered_messages = []
    skipped_tool_call_ids = set()
    for msg in request.messages:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            has_transfer = any(tc.get("name") == "transfer_to_agent" for tc in msg.tool_calls)
            if has_transfer:
                for tc in msg.tool_calls:
                    if tc.get("name") == "transfer_to_agent":
                        tc_id = tc.get("id")
                        if tc_id:
                            skipped_tool_call_ids.add(tc_id)
                continue
        if isinstance(msg, ToolMessage):
            if msg.name == "transfer_to_agent" or msg.tool_call_id in skipped_tool_call_ids:
                continue
        filtered_messages.append(msg)

    request = request.override(messages=filtered_messages)

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
    tools=ToolManager().get_customer_support_tools(),
    middleware=[_build_system_prompt, save_thread, wrap_model],
    state_schema=State
)
