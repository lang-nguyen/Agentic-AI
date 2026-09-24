# Copyright Sierra
"""Modify user address tool implementation."""

import json
from typing import Any, Dict

from agentic_ai.data import load_data_from_session

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class ModifyUserAddress(Tool):
    """Tool for updating a user's default address."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the modify user address tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def modify_user_address(
            user_id: Annotated[str, "The user id, such as 'sara_doe_496'."],
            address1: Annotated[
                str, "The first line of the address, such as '123 Main St'."
            ],
            address2: Annotated[
                str, "The second line of the address, such as 'Apt 1' or ''."
            ],
            city: Annotated[str, "The city, such as 'San Francisco'."],
            state: Annotated[str, "The state, such as 'CA'."],
            country: Annotated[str, "The country, such as 'USA'."],
            zip: Annotated[str, "The zip code, such as '12345'."],
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> str:
            """Modify the default address of a user. Agent must explain the modification and get explicit user confirmation (yes/no) to proceed."""
            async with TaubenchConnection.async_session():
                return self.invoke(
                    data or load_data_from_session(),
                    user_id,
                    address1,
                    address2,
                    city,
                    state,
                    country,
                    zip,
                )

        return modify_user_address

    def invoke(
        self,
        data: Dict[str, Any],
        user_id: str,
        address1: str,
        address2: str,
        city: str,
        state: str,
        country: str,
        zip: str,
    ) -> str:
        """Update the default address for a user."""
        users = data["users"]
        if user_id not in users:
            return "Error: user not found"
        user = users[user_id]
        user["address"] = {
            "address1": address1,
            "address2": address2,
            "city": city,
            "state": state,
            "country": country,
            "zip": zip,
        }
        return json.dumps(user)

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "modify_user_address",
                "description": "Modify the default address of a user. The agent needs to explain the modification detail and ask for explicit user confirmation (yes/no) to proceed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "The user id, such as 'sara_doe_496'.",
                        },
                        "address1": {
                            "type": "string",
                            "description": "The first line of the address, such as '123 Main St'.",
                        },
                        "address2": {
                            "type": "string",
                            "description": "The second line of the address, such as 'Apt 1' or ''.",
                        },
                        "city": {
                            "type": "string",
                            "description": "The city, such as 'San Francisco'.",
                        },
                        "state": {
                            "type": "string",
                            "description": "The state, such as 'CA'.",
                        },
                        "country": {
                            "type": "string",
                            "description": "The country, such as 'USA'.",
                        },
                        "zip": {
                            "type": "string",
                            "description": "The zip code, such as '12345'.",
                        },
                    },
                    "required": [
                        "user_id",
                        "address1",
                        "address2",
                        "city",
                        "state",
                        "country",
                        "zip",
                    ],
                },
            },
        }
