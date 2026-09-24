# Copyright Sierra
"""Modify pending order payment tool implementation."""

import json
from typing import Any, Dict

from agentic_ai.data import load_data_from_session

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class ModifyPendingOrderPayment(Tool):
    """Tool for changing payment methods on pending orders."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the modify pending order payment tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def modify_pending_order_payment(
            order_id: Annotated[
                str,
                "The order id, such as '#W0000000'. Includes the '#' symbol at the beginning.",
            ],
            payment_method_id: Annotated[
                str,
                "Payment method id to pay or receive refund for the item price difference, e.g., 'gift_card_0000000' or 'credit_card_0000000'. Can be looked up from the user or order details.",
            ],
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> str:
            """Modify the payment method of a pending order. Agent must explain the modification and get explicit user confirmation (yes/no) to proceed."""
            async with TaubenchConnection.async_session():
                return self.invoke(
                    data or load_data_from_session(), order_id, payment_method_id
                )

        return modify_pending_order_payment

    def invoke(
        self,
        data: Dict[str, Any],
        order_id: str,
        payment_method_id: str,
    ) -> str:
        """Apply a payment method change to a pending order."""
        orders = data["orders"]

        # Check if the order exists and is pending
        if order_id not in orders:
            return "Error: order not found"
        order = orders[order_id]
        if order["status"] != "pending":
            return "Error: non-pending order cannot be modified"

        # Check if the payment method exists
        if payment_method_id not in data["users"][order["user_id"]]["payment_methods"]:
            return "Error: payment method not found"

        # Check that the payment history should only have one payment
        if (
            len(order["payment_history"]) > 1
            or order["payment_history"][0]["transaction_type"] != "payment"
        ):
            return "Error: there should be exactly one payment for a pending order"

        # Check that the payment method is different
        if order["payment_history"][0]["payment_method_id"] == payment_method_id:
            return (
                "Error: the new payment method should be different from the current one"
            )

        amount = order["payment_history"][0]["amount"]
        payment_method = data["users"][order["user_id"]]["payment_methods"][
            payment_method_id
        ]

        # Check if the new payment method has enough balance if it is a gift card
        if (
            payment_method["source"] == "gift_card"
            and payment_method["balance"] < amount
        ):
            return "Error: insufficient gift card balance to pay for the order"

        # Modify the payment method
        order["payment_history"].extend(
            [
                {
                    "transaction_type": "payment",
                    "amount": amount,
                    "payment_method_id": payment_method_id,
                },
                {
                    "transaction_type": "refund",
                    "amount": amount,
                    "payment_method_id": order["payment_history"][0][
                        "payment_method_id"
                    ],
                },
            ]
        )

        # If payment is made by gift card, update the balance
        if payment_method["source"] == "gift_card":
            payment_method["balance"] -= amount
            payment_method["balance"] = round(payment_method["balance"], 2)

        # If refund is made to a gift card, update the balance
        if "gift_card" in order["payment_history"][0]["payment_method_id"]:
            old_payment_method = data["users"][order["user_id"]]["payment_methods"][
                order["payment_history"][0]["payment_method_id"]
            ]
            old_payment_method["balance"] += amount
            old_payment_method["balance"] = round(old_payment_method["balance"], 2)

        return json.dumps(order)

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "modify_pending_order_payment",
                "description": "Modify the payment method of a pending order. The agent needs to explain the modification detail and ask for explicit user confirmation (yes/no) to proceed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_id": {
                            "type": "string",
                            "description": "The order id, such as '#W0000000'. Be careful there is a '#' symbol at the beginning of the order id.",
                        },
                        "payment_method_id": {
                            "type": "string",
                            "description": "The payment method id to pay or receive refund for the item price difference, such as 'gift_card_0000000' or 'credit_card_0000000'. These can be looked up from the user or order details.",
                        },
                    },
                    "required": [
                        "order_id",
                        "payment_method_id",
                    ],
                },
            },
        }
