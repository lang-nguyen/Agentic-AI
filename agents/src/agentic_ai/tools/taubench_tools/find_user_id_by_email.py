# Copyright Sierra
"""Find user id by email tool implementation."""

from agentic_ai.data.taubench_data import TaubenchConnection
from typing import Any, Dict

from langchain.tools import ToolRuntime
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from agentic_ai.data import load_data_from_session
from agentic_ai.model import ExtraState
from ..tool import Tool


class FindUserIdByEmail(Tool):
    """Tool for looking up user ids by email."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the find user by email tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def find_user_id_by_email(
            email: Annotated[
                str, "The email of the user, such as 'something@example.com"
            ],
            runtime: ToolRuntime,
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> Command | str:
            """Find user id by email. If the user is not found, the function will return an error message."""
            async with TaubenchConnection.async_session():            
                try:
                    user_id, profile = self.invoke(data or load_data_from_session(), email)
                except ValueError as e:
                    return str(e)
                
                extra = ExtraState.from_state(runtime.state.get("extra"))
                new_extra = extra.update_artifact("user", profile)
                
                return Command(update={
                    "messages": [ToolMessage(content=f"{user_id}", tool_call_id=runtime.tool_call_id, artifact=profile)],
                    "extra": new_extra
                })

        return find_user_id_by_email

    def invoke(self, data: Dict[str, Any], email: str) -> tuple[str, Dict[str, Any]]:
        """Look up a user id from an email address."""
        users = data["users"]
        for user_id, profile in users.items():
            if profile["email"].lower() == email.lower():
                return (user_id, profile)
        raise ValueError("Error: user not found")

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "find_user_id_by_email",
                "description": "Find user id by email. If the user is not found, the function will return an error message.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "email": {
                            "type": "string",
                            "description": "The email of the user, such as 'something@example.com'.",
                        },
                    },
                    "required": ["email"],
                },
            },
        }
