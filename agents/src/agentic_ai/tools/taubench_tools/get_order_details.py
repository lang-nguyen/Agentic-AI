import json
from typing import Any, Dict

from agentic_ai.data import load_data_from_session
from langchain.tools import ToolRuntime
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from agentic_ai.model import ExtraState

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class GetOrderDetails(Tool):
    """Tool for retrieving order details."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the get order details tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def get_order_details(
            order_id: Annotated[
                str,
                "The order id, such as '#W0000000'. Includes the '#' symbol at the beginning.",
            ],
            runtime: ToolRuntime,
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> Command | str:
            """Get the status and details of an order."""
            async with TaubenchConnection.async_session():
                try:
                    order_info = self.invoke(data=data or load_data_from_session(), order_id=order_id)
                except ValueError as e:
                    return str(e)
                
                extra = ExtraState.from_state(runtime.state.get("extra"))
                new_extra = extra.update_artifact("order", order_info)
                
                # Filter order details (order_id, status, items with name/item_id/product_id/price/options) for LLM
                llm_view = {
                    "order_id": order_info.get("order_id"),
                    "status": order_info.get("status"),
                    "items": [
                        {
                            "name": item.get("name"),
                            "item_id": item.get("item_id"),
                            "product_id": item.get("product_id"),
                            "price": item.get("price"),
                            "options": item.get("options")
                        }
                        for item in order_info.get("items", [])
                    ]
                }
                content_str = json.dumps(llm_view)
                
                return Command(update={
                    "messages": [ToolMessage(content=content_str, tool_call_id=runtime.tool_call_id, artifact=order_info)],
                    "extra": new_extra
                })

        return get_order_details

    def invoke(self, data: Dict[str, Any], order_id: str) -> Dict[str, Any]:
        """Return order details for the given order id."""
        orders = data["orders"]
        if order_id in orders:
            return orders[order_id]
        raise ValueError("Error: order not found")

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "get_order_details",
                "description": "Get the status and details of an order.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_id": {
                            "type": "string",
                            "description": "The order id, such as '#W0000000'. Be careful there is a '#' symbol at the beginning of the order id.",
                        },
                    },
                    "required": ["order_id"],
                },
            },
        }
