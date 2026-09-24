# Copyright Sierra
"""Calculation tool implementation."""

from typing import Annotated, Any, Dict

from agentic_ai.tools.tool import Tool


class Calculate(Tool):
    """Tool for evaluating arithmetic expressions."""
    
    def __init__(self):
        super().__init__()

    def parse(self) -> Any:
        """Return the calculate tool callable."""
        from langchain_core.tools import tool, InjectedToolArg

        @tool
        def calculate(
            expression: Annotated[
                str, "The mathematical expression to calculate, e.g., '2 + 2'"
            ],
            data: Annotated[dict|None, InjectedToolArg] = None
        ) -> str:
            """Calculate the result of a mathematical expression."""
            return self.invoke(expression, data=None)

        return calculate

    def invoke(self, expression: str, data: Dict[str, Any] | None) -> str:
        """Evaluate the expression and return a result string."""
        if not all(char in "0123456789+-*/(). " for char in expression):
            return "Error: invalid characters in expression"
        try:
            # Evaluate the mathematical expression safely
            return str(round(float(eval(expression, {"__builtins__": None}, {})), 2))
        except Exception as e:
            return f"Error: {e}"

    def get_info(self) -> Dict[str, Any]:
        """Return metadata for this tool."""
        return {
            "type": "function",
            "function": {
                "name": "calculate",
                "description": "Calculate the result of a mathematical expression.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "The mathematical expression to calculate, such as '2 + 2'. The expression can contain numbers, operators (+, -, *, /), parentheses, and spaces.",
                        },
                    },
                    "required": ["expression"],
                },
            },
        }
