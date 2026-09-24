# Copyright Sierra
"""Think tool implementation."""

from typing import Any, Dict

from ..tool import Tool


class Think(Tool):
    """Tool for internal reasoning steps."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the think tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        def think(
            thought: Annotated[str, "A thought to think about"], 
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> str:
            """Record an internal reasoning step."""
            return self.invoke(thought=thought, data=None)

        return think

    def invoke(self, data: Dict[str, Any] | None, thought: str) -> str:
        """Return an empty result without changing state."""
        # This method does not change the state of the data; it simply returns an empty string.
        return ""

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "think",
                "description": (
                    "Use the tool to think about something. It will not obtain new information or change the database, "
                    "but just append the thought to the log. Use it when complex reasoning or some cache memory is needed."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "thought": {
                            "type": "string",
                            "description": "A thought to think about.",
                        },
                    },
                    "required": ["thought"],
                },
            },
        }
