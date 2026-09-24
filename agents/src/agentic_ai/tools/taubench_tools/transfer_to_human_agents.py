# Copyright Sierra
"""Transfer to human agents tool implementation."""

from typing import Any, Dict, Annotated
from dataclasses import replace
from langchain_core.tools import tool, InjectedToolArg
from langchain_core.messages import ToolMessage
from langgraph.prebuilt.tool_node import ToolRuntime
from langgraph.types import Command
from langgraph_sdk import get_client
from agentic_ai.persistence.threads import save_staff_thread
from agentic_ai.model import ExtraState
from datetime import datetime
from ..tool import Tool


class TransferToHumanAgents(Tool):
    """Tool for escalating requests to human agents."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the transfer to human agents tool callable."""

        @tool(return_direct=True)
        async def transfer_to_human_agents(
            summary: Annotated[str, "A summary of the user's issue."],
            runtime: ToolRuntime,
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> Command:
            """Transfer the user to a human agent. Only do this if the user explicitly requests it or if the issue cannot be resolved by available tools."""
            customer_thread_id = runtime.execution_info.thread_id
                        
            extra = ExtraState.from_state(runtime.state.get("extra"))
            
            updates = {}
            updates["messages"] = [
                ToolMessage(
                        content=f"Transfer successful.", 
                        tool_call_id=runtime.tool_call_id,
                )
            ]

            updates["extra"] = extra.escalate(customer_thread_id)
            
            return Command(update=updates, goto="__end__")

        return transfer_to_human_agents

    def invoke(self, data: Dict[str, Any] | None, summary: str) -> str:
        """Simulate a transfer to a human agent."""
        return "Transfer successful to sales staff."

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "transfer_to_human_agents",
                "description": (
                    "Transfer the user to a human agent, with a summary of the user's issue. "
                    "Only transfer if the user explicitly asks for a human agent, or if the user's issue cannot be resolved by the agent with the available tools."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "summary": {
                            "type": "string",
                            "description": "A summary of the user's issue.",
                        },
                    },
                    "required": ["summary"],
                },
            },
        }
