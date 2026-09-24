from agentic_ai.tools.taubench_tools import ALL_TOOLS
from agentic_ai.tools.custom_tools import CreateReturnRequest
from agentic_ai.tools.taubench_tools import GetOrderDetails, GetProductDetails, ListAllProductTypes

def singleton(cls):
    instance = {}

    def get_instance(*args, **kwargs):
        if cls not in instance:
            instance[cls] = cls(*args, **kwargs)
        return instance[cls]

    return get_instance

@singleton
class ToolManager:

    def __init__(self):
        self.tools = ALL_TOOLS

    def get_available_tools(self):
        return [
            tool.parse()
            for tool in self.tools
            if tool.is_available
        ]

    def get_customer_support_tools(self):
        return [
            CreateReturnRequest().parse(),
            GetOrderDetails().parse(),
            GetProductDetails().parse(),
            ListAllProductTypes().parse()
        ]