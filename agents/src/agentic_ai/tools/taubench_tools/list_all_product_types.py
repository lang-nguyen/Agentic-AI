# Copyright Sierra
"""List all product types tool implementation."""

import json
from typing import Any, Dict

from agentic_ai.data import load_data_from_session

from ..tool import Tool


from agentic_ai.data.taubench_data import TaubenchConnection

class ListAllProductTypes(Tool):
    """Tool for listing available product types."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the list product types tool callable."""
        from typing import Annotated
        from langchain_core.tools import tool, InjectedToolArg

        @tool
        async def list_all_product_types(
            data: Annotated[dict|None, InjectedToolArg] = None 
        ) -> str:
            """List the name and product id of all product types. Each product type has a variety of items with unique item ids and options. There are only 50 product types in the store."""
            async with TaubenchConnection.async_session():
                return self.invoke(data=data or load_data_from_session())

        return list_all_product_types

    def invoke(self, data: Dict[str, Any]) -> str:
        """Return product names mapped to product ids."""
        products = data["products"]
        product_dict = {
            product["name"]: product["product_id"] for product in products.values()
        }
        product_dict = dict(sorted(product_dict.items()))
        return json.dumps(product_dict)

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "list_all_product_types",
                "description": "List the name and product id of all product types. Each product type has a variety of different items with unique item ids and options. There are only 50 product types in the store.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        }
