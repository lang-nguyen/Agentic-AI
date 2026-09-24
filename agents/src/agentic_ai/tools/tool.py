"""Taubench Tool Schema."""

import abc
from typing import Any

from langchain_core.tools import StructuredTool


class Tool(abc.ABC):
    """Abstract base class for callable tools."""
    
    def __init__(self):
        self.is_available=True

    def invoke(self, *args: Any, **kwargs: Any) -> Any:
        """Invoke the tool."""
        raise NotImplementedError

    def get_info(self) -> dict[str, Any]:
        """Return tool info in dict."""
        raise NotImplementedError

    def parse(self) -> StructuredTool:
        """Return a LangChain structured tool."""
        raise NotImplementedError
