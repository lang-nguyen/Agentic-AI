# Copyright Sierra
"""Return delivered order items tool implementation."""

import json
from typing import Any, Dict, List, Optional, Union

from agentic_ai.data import load_data_from_session

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class CreateReturnRequest(Tool):
    """Tool for creating a return request."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Create a return request."""
        import ast
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def create_return_request(
            order_id: Annotated[
                str,
                "The order id, such as '#W0000000'. Includes the '#' symbol at the beginning.",
            ],
            claim_type: Annotated[
                str,
                "The type of claim, either 'return' or 'exchange'.",
            ],
            item_ids: Annotated[
                Union[List[str], str],
                "The item ids to be returned or exchanged, e.g., ['1008292230']. DO NOT pass a string representation of a list.",
            ],
            payment_method_id: Annotated[
                str,
                "Payment method id to pay or receive refund, e.g., 'gift_card_0000000' or 'credit_card_0000000'. Can be looked up from user or order details.",
            ],
            reason: Annotated[
                str,
                "Reason for the return or exchange. Must be one of: 'wrong_size', 'wrong_color', 'wrong_item', 'damaged_item', 'changed_mind', 'poor_quality', 'other'.",
            ],
            customer_comment: Annotated[
                Optional[str],
                "Additional comment or details provided by the customer.",
            ] = None,
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> str:
            """Create a return or exchange request for some items of a delivered order. Order status changes to 'return requested' or 'exchange requested'. Agent must explain details and get explicit user confirmation (yes/no) to proceed."""
            if isinstance(item_ids, str):
                try:
                    item_ids = ast.literal_eval(item_ids)
                except (SyntaxError, ValueError):
                    pass
            if not isinstance(item_ids, list):
                return "Error: item_ids must be a valid list of strings."

            async with TaubenchConnection.async_session():
                return await self.invoke(
                    data=data or load_data_from_session(),
                    order_id=order_id,
                    claim_type=claim_type,
                    item_ids=item_ids,
                    payment_method_id=payment_method_id,
                    reason=reason,
                    customer_comment=customer_comment
                )

        return create_return_request

    async def invoke(
        self,
        data: Dict[str, Any],
        order_id: str,
        claim_type: str,
        item_ids: List[str],
        payment_method_id: str,
        reason: str,
        customer_comment: Optional[str] = None
    ) -> str:
        """Create a return request."""
        from agentic_ai.infra.web_api import get_order_by_id, get_current_user, create_return_request
        # Check if the order exists and is delivered
        order = await get_order_by_id(order_id)
        if not order:
            return "Error: order not found" 
        if order["status"] != "delivered":
            return "Error: non-delivered order cannot be returned or exchanged"

        # Check if the payment method exists and is either the original payment method or a gift card
        user = await get_current_user()
        if payment_method_id not in user["paymentMethods"]:
            return "Error: payment method not found"
        if (
            "gift_card" not in payment_method_id
            and payment_method_id != order["paymentHistory"][0]["paymentMethodId"]
        ):
            return "Error: payment method should be either the original payment method or a gift card"

        # Check if the items to be returned exist (there could be duplicate items in either list)
        all_item_ids = [item["itemId"] for item in order["items"]]
        for item_id in item_ids:
            if item_ids.count(item_id) > all_item_ids.count(item_id):
                return "Error: some item not found"

        # Check claim_type
        if claim_type.lower() not in ["return", "exchange"]:
            return "Error: claim_type must be either 'return' or 'exchange'"

        # Check reason
        valid_reasons = ["wrong_size", "wrong_color", "wrong_item", "damaged_item", "changed_mind", "poor_quality", "other"]
        if reason.lower() not in valid_reasons:
            return f"Error: reason must be one of {valid_reasons}"

        return_request = {
            "order_id": order_id,
            "claim_type": claim_type.lower(),
            "reason": reason.lower(),
            "item_ids": sorted(item_ids),
            "payment_method_id": payment_method_id,
            "customer_comment": customer_comment
        }

        saved_return_request = await create_return_request(**return_request)
        return json.dumps(saved_return_request)

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "create_return_request",
                "description": (
                    "Create a return or exchange request for some items of a delivered order. "
                    "The order status will be changed to 'return requested' or 'exchange requested' depending on the claim type. "
                    "The agent needs to explain the details and ask for explicit user confirmation (yes/no) to proceed. "
                    "The user will receive follow-up email with further instructions."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_id": {
                            "type": "string",
                            "description": (
                                "The order id, such as '#W0000000'. Be careful there is a '#' symbol at the beginning of the order id."
                            ),
                        },
                        "claim_type": {
                            "type": "string",
                            "enum": ["return", "exchange"],
                            "description": "The type of claim: either 'return' or 'exchange'.",
                        },
                        "item_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": (
                                "The item ids to be returned or exchanged, each such as '1008292230'. There could be duplicate items in the list."
                            ),
                        },
                        "payment_method_id": {
                            "type": "string",
                            "description": (
                                "The payment method id to pay or receive refund for the item price difference, such as 'gift_card_0000000' or 'credit_card_0000000'. "
                                "These can be looked up from the user or order details."
                            ),
                        },
                        "reason": {
                            "type": "string",
                            "enum": ["wrong_size", "wrong_color", "wrong_item", "damaged_item", "changed_mind", "poor_quality", "other"],
                            "description": "The reason for the return or exchange request.",
                        },
                        "customer_comment": {
                            "type": "string",
                            "description": "Additional comment or details provided by the customer regarding their request.",
                        },
                    },
                    "required": ["order_id", "claim_type", "item_ids", "payment_method_id", "reason"],
                },
            },
        }
