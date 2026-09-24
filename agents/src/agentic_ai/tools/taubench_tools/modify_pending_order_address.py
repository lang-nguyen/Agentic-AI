# Copyright Sierra
"""Modify pending order address tool implementation."""

import json
from typing import Any, Dict

from agentic_ai.data import load_data_from_session

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class ModifyPendingOrderAddress(Tool):
    """Tool for updating addresses on pending orders."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the modify pending order address tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def modify_pending_order_address(
            order_id: Annotated[
                str,
                "The order id, such as '#W0000000'. Includes the '#' symbol at the beginning.",
            ],
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
            """Modify the shipping address of a pending order. The agent must explain the modification and get explicit user confirmation (yes/no) to proceed."""
            async with TaubenchConnection.async_session():
                return self.invoke(
                    data or load_data_from_session(),
                    order_id,
                    address1,
                    address2,
                    city,
                    state,
                    country,
                    zip,
                )

        return modify_pending_order_address

    def invoke(
        self,
        data: Dict[str, Any],
        order_id: str,
        address1: str,
        address2: str,
        city: str,
        state: str,
        country: str,
        zip: str,
    ) -> str:
        """Update the shipping address for a pending order."""
        # Check if the order exists and is pending
        orders = data["orders"]
        if order_id not in orders:
            return "Error: order not found"
        order = orders[order_id]
        if order["status"] != "pending":
            return "Error: non-pending order cannot be modified"

        # Modify the address
        order["address"] = {
            "address1": address1,
            "address2": address2,
            "city": city,
            "state": state,
            "country": country,
            "zip": zip,
        }
        return json.dumps(order)

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "modify_pending_order_address",
                "description": "Modify the shipping address of a pending order. The agent needs to explain the modification detail and ask for explicit user confirmation (yes/no) to proceed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_id": {
                            "type": "string",
                            "description": "The order id, such as '#W0000000'. Be careful there is a '#' symbol at the beginning of the order id.",
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
                        "order_id",
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
