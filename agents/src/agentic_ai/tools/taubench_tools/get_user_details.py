import json
from typing import Any, Dict

from agentic_ai.data import load_data_from_session
from langchain.tools import ToolRuntime
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from agentic_ai.model import ExtraState

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class GetUserDetails(Tool):
    """Tool for retrieving user details."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the get user details tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def get_user_details(
            user_id: Annotated[str, "The user id, such as 'sara_doe_496'."],
            runtime: ToolRuntime,
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> Command | str:
            """Get the details of a user, including their orders."""
            async with TaubenchConnection.async_session():
                try:
                    profile = await self.invoke(user_id=user_id, data=data or load_data_from_session())
                except ValueError as e:
                    return str(e)
                
                extra = ExtraState.from_state(runtime.state.get("extra"))
                new_extra = extra.update_artifact("user", profile)
                
                # Filter profile info: user name, email, addr, các order_ids for LLM
                llm_view = {
                    "name": profile.get("name"),
                    "email": profile.get("email"),
                    "address": profile.get("address"),
                    "orders": profile.get("orders")
                }
                content_str = json.dumps(llm_view)
                
                return Command(update={
                    "messages": [ToolMessage(content=profile, tool_call_id=runtime.tool_call_id, artifact=profile)],
                    "extra": new_extra
                })

        return get_user_details

    async def invoke(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Return user details for the given user id."""
        from agentic_ai.infra.web_api import get_current_user
        return await get_current_user()

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "get_user_details",
                "description": "Get the details of a user, including their orders.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "The user id, such as 'sara_doe_496'.",
                        },
                    },
                    "required": ["user_id"],
                },
            },
        }
