from __future__ import annotations

import json

from typing import TypedDict, Annotated, Literal
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import StructuredTool
from langchain_core.utils.function_calling import convert_to_openai_tool
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, add_messages
from langgraph.runtime import Runtime
from langgraph.types import Command

@dataclass
class ReActAgentContext:
    model: BaseChatModel

class ReActAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

class ReActAgent():
    
    INSTRUCTION = f"""
# Instruction
You need to act as an agent that use the above tools to help the user according to the above policy.
"""

    def __init__(
        self,
        model: BaseChatModel,
        tools: list[StructuredTool],
        wiki: str,
    ) -> None:
        instruction = ReActAgent.INSTRUCTION
        self.tools = tools
        self.tools_info = [convert_to_openai_tool(t) for t in tools]
        self.prompt = (
            wiki + "\n# Available tools\n" + json.dumps(self.tools_info) + instruction
        )
        self.model = model
        self.graph = (
            StateGraph(ReActAgentState, ReActAgentContext)
            .add_node("execute", self._execute_node)
            .set_entry_point("execute")
            .compile()
        )
        
    def _execute_node(self, state: dict, runtime: Runtime[ReActAgentContext]) -> Command[Literal["__end__"]]:
        
        agent = create_agent(
            model=self.model,
            tools=self.tools,
            system_prompt=self.prompt,
        )
        
        base_len = len(state["messages"])
        agent_state = agent.invoke(state)
        
        return Command(
            update={
                "messages": agent_state["messages"][base_len:]
            },
        )
        
    def invoke(self, state: dict, **kwargs):
        return self.graph.invoke(state, **kwargs)            
            