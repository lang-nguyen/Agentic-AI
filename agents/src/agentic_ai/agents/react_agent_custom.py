"""ReAct-style agent implementation based on LangGraph."""

from typing import Any, Sequence

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import  SystemMessage
from langchain_core.tools import StructuredTool

from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.runtime import Runtime

from agentic_ai.data.taubench_data import TaubenchConnection
from agentic_ai.model import ExtraState

from agentic_ai.state.react_state import Configuration, State


class ReActAgent():
    """Agent that alternates between LLM reasoning and tool execution."""

    def __init__(self, llm: BaseChatModel, tools: Sequence[StructuredTool]):
        """Initialize the ReAct agent with model and tools."""
        self.llm = llm
        self.tools = tools

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(state_schema=State, context_schema=Configuration)

        graph.add_node("llm", self._llm_node, destinations={"tool": "action", END: "finish"})
        graph.add_node("tool", self._tool_node, destinations={"llm": "observation"})

        graph.add_edge(START, "llm")
        graph.add_edge("tool", "llm")
        graph.add_conditional_edges(
            "llm", tools_condition, {"tools": "tool", "__end__": END}
        )

        return graph
    
    def _build_system_prompt(self, runtime: Runtime[Configuration]) -> SystemMessage:
        instruction = runtime.context.instruction
        policy = runtime.context.policy
        return SystemMessage(content=f"<instruction>\n{instruction}\n</instruction>\n<policy>\n{policy}\n</policy>\n")
                
    async def _llm_node(self, state: State, runtime: Runtime[Configuration]) -> dict[str, Any]:
        system_prompt = self._build_system_prompt(runtime)
        reasoning = runtime.context.reasoning
        _llm = self.llm.model_copy(update={
            "reasoning": reasoning
        })
        if self.tools:
            _llm = _llm.bind_tools(self.tools)
        
        messages = list(state["messages"])
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [system_prompt, *messages]
        elif isinstance(messages[0], SystemMessage):
            messages[0].content = system_prompt.content
        ai_msg = await _llm.ainvoke(messages)
        
        return {"messages": [ai_msg]}

    async def _tool_node(self, state: State) -> dict[str, Any]:
        tool_node = ToolNode(self.tools)
        async with TaubenchConnection.async_session():
            return await tool_node.ainvoke(state)