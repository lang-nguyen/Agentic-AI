# Copyright Sierra
"""Get product details tool implementation."""

import json
from typing import Any, Dict

from agentic_ai.data import load_data_from_session

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class GetProductDetails(Tool):
    """Tool for retrieving product details."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the get product details tool callable."""
        from typing import Annotated

        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def get_product_details(
            product_id: Annotated[
                str,
                "The product id, such as '6086499569'. Note: product id is different from item id.",
            ],
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> str:
            """Get the inventory details of a product."""
            async with TaubenchConnection.async_session():
                return self.invoke(
                    data=data or load_data_from_session(), product_id=product_id
                )

        return get_product_details

    def invoke(self, data: Dict[str, Any], product_id: str) -> str:
        """Return product details for the given product id."""
        products = data["products"]
        if product_id in products:
            return json.dumps(products[product_id])
        return "Error: product not found"

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "get_product_details",
                "description": "Get the inventory details of a product.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_id": {
                            "type": "string",
                            "description": "The product id, such as '6086499569'. Be careful the product id is different from the item id.",
                        },
                    },
                    "required": ["product_id"],
                },
            },
        }
