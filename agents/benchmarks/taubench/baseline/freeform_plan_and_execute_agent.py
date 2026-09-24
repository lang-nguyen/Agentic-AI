import json
from typing import Any, TypedDict, Annotated, Literal
from pydantic import BaseModel, Field
from dataclasses import dataclass

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import tool, StructuredTool
from langchain_core.utils.function_calling import convert_to_openai_tool
from langchain_core.messages import BaseMessage, ToolMessage
from langchain_core.messages import *
from langchain.agents import create_agent
from langchain.agents.middleware.types import OmitFromInput
from langchain.agents.middleware import after_model

from langgraph.types import Command
from langgraph.graph import StateGraph, add_messages
from langgraph.runtime import Runtime
from langgraph.prebuilt import ToolRuntime

RESPOND_ACTION_NAME = "respond"
RESPOND_ACTION_FIELD_NAME = "content"

@tool(return_direct=True)
def write_plan(plan: Any, runtime: ToolRuntime):
    """Write a plan (It's will override existed plan)."""
    
    return Command(
        update={
            "plan": str(plan),
        }
    )

@tool(return_direct=True)
def continue_execution(runtime: ToolRuntime):
    """Call this tool when the existing plan is still valid and does not need any changes, to proceed with executing the current plan."""
    tool_msg = ToolMessage(
        tool_call_id=runtime.tool_call_id,
        name="continue_execution",
        content="Plan verified. Continuing execution."
    )
    return Command(
        update={
            "messages": [tool_msg]
        }
    )
        

@dataclass
class FreeformPlanAndExecuteContext:
    model: BaseModel

class FreeformPlanAndExecuteState(TypedDict):
    plan: Annotated[str, OmitFromInput]
    messages: Annotated[list[BaseMessage], add_messages]

class FreeformPlanAndExecuteAgent:
    def __init__(self, model: BaseChatModel, wiki: str, tools: list[StructuredTool]):
        self.model = model
        self.wiki = wiki
        self.tools = tools
        builder = StateGraph(FreeformPlanAndExecuteState, FreeformPlanAndExecuteContext)
        builder = builder.add_node("plan_node", self._plan_node)
        builder = builder.add_node("execute_node", self._execute_node)
        builder = builder.set_entry_point("plan_node")
        self.graph = builder.compile()

    def _plan_node(self, state: dict, runtime: Runtime[FreeformPlanAndExecuteContext]) -> Command[Literal["execute_node", "__end__"]]:
        instruction = f"""
# Who am I:

I'm Planner agent. 
My task is to analyze the user request and determine whether to:
1. continue execution
2. update the plan
3. ask a clarification question

Current Plan:
{state.get('plan', 'None')}

# The rules I must follow:
- If a plan already exists and is still valid for the user's latest request, I must respond only "###SKIP###"
- If a plan does not exist, or the current plan is no longer valid, I create or update the plan by respond "###PLAN### <the plan goes here>".
- If the user's request is unclear and I cannot determine whether to continue or update the plan, write the question in plan.

# The constraints I must follow:
- Plan must be deterministic and executable by the executor agent.
- Do not acknowledge the user..

# My hard limit:
- I can't execute another action that is not in my role.
- If I need to execute an action, I must write it in a plan (follow the rule above).
- I can only do 2 works: SKIP or PLAN
"""

        prompt = self.wiki + instruction
        
        plan = state.get("plan", "There are no plan")
        question = ""
        
        agent = create_agent(
            model=self.model,
            system_prompt=prompt,
            name="plan_agent"
        )
        
        ai_state = agent.invoke({
            "messages": state["messages"]
        })
        
        ai_msg = ai_state["messages"][-1]

        # determine next step
        if "SKIP" in ai_msg.content:
            goto = "execute_node"
        else:
            goto = "execute_node"
            plan = ai_msg.content
        return Command(
            update={
                "plan": plan
            },
            goto=goto
        )

    def _execute_node(self, state: dict, runtime: Runtime[FreeformPlanAndExecuteContext]) -> Command[Literal["__end__"]]:       
        instruction = f"""
# Who am I?
I am an executor agent that use the tools to help you according to the policy and follow the plan.

The plan I must follow:
{state.get('plan', '')}

# I must:
- Keep the conversation natural, concise and direct.
"""
        prompt = self.wiki + instruction

        agent = create_agent(
            model=runtime.context.model,
            tools=self.tools,
            name="execute_agent",
            system_prompt=prompt,
        )

        
        agent_state = agent.invoke({
            "messages": state["messages"]
        })

        base_len = len(state["messages"])
        agent_messages = agent_state["messages"][base_len:]
        
        return Command(
            update={
                "messages": agent_messages
            },
        )

    def invoke(self, state: dict, **kwargs) -> dict:
        context = FreeformPlanAndExecuteContext(model=self.model)
        return self.graph.invoke(state, context=context, **kwargs)


