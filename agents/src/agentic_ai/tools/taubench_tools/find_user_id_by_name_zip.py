# Copyright Sierra
"""Find user id by name and zip tool implementation."""

from agentic_ai.data.taubench_data import TaubenchConnection
from typing import Any, Dict

from langchain.tools import ToolRuntime
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from agentic_ai.data import load_data_from_session
from agentic_ai.model import ExtraState
from ..tool import Tool



class FindUserIdByNameZip(Tool):
    """Tool for looking up user ids by name and zip code."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the find user by name and zip tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def find_user_id_by_name_zip(
            first_name: Annotated[
                str, "The first name of the customer, such as 'John'"
            ],
            last_name: Annotated[str, "The last name of the customer, such as 'Doe'"],
            zip: Annotated[str, "The zip code of the customer, such as '12345'."],
            runtime: ToolRuntime,
            data: Annotated[dict | None, InjectedToolArg] = None
        ) -> Command | str:
            """Find a user id by first name, last name, and zip code."""
            async with TaubenchConnection.async_session():
                try:
                    user_id, profile = self.invoke(
                        data or load_data_from_session(), first_name, last_name, zip
                    )
                except ValueError as e:
                    return str(e)
                
                extra = ExtraState.from_state(runtime.state.get("extra"))
                new_extra = extra.update_artifact("user", profile)
                
                return Command(update={
                    "messages": [ToolMessage(content=f"{user_id}", tool_call_id=runtime.tool_call_id, artifact=profile)],
                    "extra": new_extra
                })

        return find_user_id_by_name_zip

    def invoke(self, data: Dict[str, Any], first_name: str, last_name: str, zip: str) -> tuple[str, Dict[str, Any]]:
        """Look up a user id by name and zip code."""
        users = data["users"]
        for user_id, profile in users.items():
            if (
                profile["name"]["first_name"].lower() == first_name.lower()
                and profile["name"]["last_name"].lower() == last_name.lower()
                and profile["address"]["zip"] == zip
            ):
                return (user_id, profile)
        raise ValueError("Error: user not found")

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "find_user_id_by_name_zip",
                "description": (
                    "Find user id by first name, last name, and zip code. If the user is not found, the function "
                    "will return an error message. By default, find user id by email, and only call this function "
                    "if the user is not found by email or cannot remember email."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "first_name": {
                            "type": "string",
                            "description": "The first name of the customer, such as 'John'.",
                        },
                        "last_name": {
                            "type": "string",
                            "description": "The last name of the customer, such as 'Doe'.",
                        },
                        "zip": {
                            "type": "string",
                            "description": "The zip code of the customer, such as '12345'.",
                        },
                    },
                    "required": ["first_name", "last_name", "zip"],
                },
            },
        }
