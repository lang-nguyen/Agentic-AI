from typing import Annotated, Any, Callable, Awaitable
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, dynamic_prompt, after_model, wrap_model_call
from langchain_core.tools import tool
from langgraph.prebuilt.tool_node import ToolRuntime
from langgraph.types import Command
from langgraph.graph import END
from langgraph.runtime import Runtime
from langchain_core.messages import AIMessage, ToolMessage, HumanMessage
from agentic_ai.model import ExtraState
from agentic_ai.llm.llm_factory import get_default_llm
from agentic_ai.tools.taubench_tools.transfer_to_human_agents import TransferToHumanAgents
from agentic_ai.state.react_state import State, Configuration
from agentic_ai.persistence.events import publish_new_message


@tool(return_direct=True)
async def transfer_to_agent(
    summary: Annotated[str, "A summary of the user's issue/request."],
    runtime: ToolRuntime,
) -> Command:
    """Transfer the user request to the ReAct agent to handle according to the tools/policy."""
    extra = ExtraState.from_state(runtime.state.get("extra"))
    
    updates = {}
    updates["messages"] = [
        ToolMessage(
            content="Transfer successful to ReAct agent.", 
            tool_call_id=runtime.tool_call_id,
        )
    ]
    updates["extra"] = extra.model_copy(update={"assignee": "agent"})
    
    return Command(update=updates)


@dynamic_prompt()
def _build_guardian_system_prompt(request: ModelRequest) -> str:
    context = getattr(request.runtime, "context", None)
    if context and getattr(context, "guardian_prompt", None):
        return context.guardian_prompt
        
    return (
        "You are a guardian routing assistant.\n"
        "Your task is to review the user request and make one of the following decisions:\n"
        "1. Respond directly to the user if the request is a simple greeting, conversation, out-of-scope question, or something that does not require customer profile/order actions.\n"
        "2. Call the `transfer_to_agent` tool if the request requires customer actions, order details, cancellation, modification, calculations, or other complex tasks.\n"
        "3. Call the `transfer_to_human_agents` tool if the user explicitly asks for a human, staff, or operator, or if the request cannot be handled.\n"
        "\n"
        "IMPORTANT: Do not attempt to solve complex queries or perform calculations yourself. Always transfer to the agent or human instead."
    )


@after_model
async def guardian_after_model(state: State, runtime: Runtime[Configuration]):
    # Only publish if the latest message is a direct reply (no tool calls)
    messages = state.get("messages", [])
    if messages:
        latest_msg = messages[-1]
        if isinstance(latest_msg, AIMessage) and not latest_msg.tool_calls:
            await publish_new_message(runtime.execution_info.thread_id)
    return {}


@wrap_model_call
async def filter_messages(
    request: ModelRequest,
    handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
) -> ModelResponse:
    filtered_messages = []
    for msg in request.messages:
        if isinstance(msg, HumanMessage):
            filtered_messages.append(msg)
        elif isinstance(msg, AIMessage):
            if msg.content:
                filtered_messages.append(msg)
                
    return await handler(request.override(messages=filtered_messages))


guardian_agent = create_agent(
    model=get_default_llm(),
    tools=[transfer_to_agent, TransferToHumanAgents().parse()],
    middleware=[_build_guardian_system_prompt, filter_messages, guardian_after_model],
    state_schema=State
)
