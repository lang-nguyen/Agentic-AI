# Copyright Sierra
"""Return delivered order items tool implementation."""

import json
from typing import Any, Dict, List, Optional, Union

from agentic_ai.data import load_data_from_session

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class ReturnDeliveredOrderItems(Tool):
    """Tool for AI Agents (Staff Role) to approve or reject a return request via the secure admin PUT API."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the return delivered items tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def return_delivered_order_items(
            return_id: Annotated[
                str,
                "The return request id, such as 'RET_ABCD1234'.",
            ],
            status: Annotated[
                str,
                "The target status for the return request. Must be one of: 'APPROVED', 'REJECTED'.",
            ],
            action: Annotated[
                str,
                "The action associated with the decision. Must be one of: 'REFUND_IMMEDIATELY', 'REFUND_AND_RETURN', 'PARTIAL_REFUND', 'REJECT_REFUND', 'WAIT_FOR_APPROVAL'.",
            ],
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> str:
            """Approve or reject a specific return request using the secure Spring Boot admin PUT API. Updates order status if approved."""
            async with TaubenchConnection.async_session():
                return await self.invoke(
                    data=data or load_data_from_session(),
                    return_id=return_id,
                    status=status,
                    action=action
                )

        return return_delivered_order_items

    async def invoke(
        self,
        data: Dict[str, Any], return_id: str, status: str, action: str
    ) -> str:
        """Submit the decision via the secure admin PUT endpoint and update local session data if approved."""
        from agentic_ai.infra.web_api import get_return_requests, update_admin_return_request_status
        
        # 1. Update the return request status and action via the Spring Boot admin PUT API
        result = await update_admin_return_request_status(
            return_id=return_id,
            status=status.upper(),
            action=action.upper()
        )
        
        # 2. Fetch all return requests to find the corresponding order_id and item_ids for offline state syncing
        order_id = None
        item_ids = []
        payment_method_id = None
        
        try:
            return_requests = await get_return_requests()
            for req in return_requests:
                if req.get("returnId") == return_id or req.get("id") == return_id:
                    order_id = req.get("orderId") or req.get("order_id")
                    payment_method_id = req.get("paymentMethodId") or req.get("payment_method_id")
                    if req.get("items"):
                        item_ids = [item.get("itemId") or item.get("item_id") for item in req["items"]]
                    break
        except Exception as e:
            print(f"Error fetching return requests for local sync: {e}")

        # 3. Synchronize local session data (data["orders"]) if the status is APPROVED
        if status.upper() == "APPROVED" and order_id and data and "orders" in data:
            if order_id in data["orders"]:
                order = data["orders"][order_id]
                order["status"] = "return_requested"
                order["return_items"] = sorted(item_ids)
                order["return_payment_method_id"] = payment_method_id

        # Return the resulting return request JSON or fallback
        if result:
            return json.dumps(result)
        else:
            return json.dumps({
                "returnId": return_id,
                "status": status.upper(),
                "action": action.upper(),
                "sync_warning": "No response from Spring Boot backend"
            })

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "return_delivered_order_items",
                "description": (
                    "Approve or reject a specific return request using the secure Spring Boot admin PUT API. "
                    "This updates the return request status and action, and registers corresponding order tracking logs."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "return_id": {
                            "type": "string",
                            "description": "The return request id, such as 'RET_ABCD1234'.",
                        },
                        "status": {
                            "type": "string",
                            "enum": ["APPROVED", "REJECTED"],
                            "description": "The target status: either 'APPROVED' or 'REJECTED'.",
                        },
                        "action": {
                            "type": "string",
                            "enum": ["REFUND_IMMEDIATELY", "REFUND_AND_RETURN", "PARTIAL_REFUND", "REJECT_REFUND", "WAIT_FOR_APPROVAL"],
                            "description": "The action associated with the decision.",
                        },
                    },
                    "required": ["return_id", "status", "action"],
                },
            },
        }
