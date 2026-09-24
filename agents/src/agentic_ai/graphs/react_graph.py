from typing import Any, Literal
from langchain_core.messages import ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langgraph.types import Command
from agentic_ai.persistence.events import publish_new_message
from agentic_ai.state.react_state import State, Configuration
from agentic_ai.model import ExtraState
from agentic_ai.agents import react_agent


async def before_run(state: State, runtime: Runtime[Configuration]) -> Command:
    """Middleware node to resolve extra and determine routing."""
    # 1. Get extra from client/state (loaded from checkpointer)
    raw_extra = state.get("extra")
    if raw_extra:
        extra = ExtraState.from_state(raw_extra)
    else:
        extra = ExtraState(assignee="agent")
        
    if extra.active is False or extra.assignee == "human":
        next_node = "human"
    else:
        next_node = "agent"
        
    await publish_new_message(runtime.execution_info.thread_id)
    return Command(update={"extra": extra}, goto=next_node)


async def human_node(state: State, runtime: Runtime[Configuration]) -> dict[str, Any]:
    """Human node."""  
    return {}

def route_after_agent(state: State) -> Literal["human", "__end__"]:
    extra = ExtraState.from_state(state.get("extra"))
    if extra.active is False or extra.assignee == "human":
        return "human"
    return "__end__"


builder = StateGraph(state_schema=State, context_schema=Configuration)

builder.add_node("before_run", before_run, destinations={"human": "human", "agent": "agent"})
builder.add_node("agent", react_agent, destinations={"human": "human"})
builder.add_node("human", human_node)

builder.add_edge(START, "before_run")
builder.add_conditional_edges("agent", route_after_agent, {"human": "human", "__end__": END})
builder.add_edge("human", END)

graph = builder.compile()
