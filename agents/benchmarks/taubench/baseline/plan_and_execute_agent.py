import sys
from dataclasses import dataclass
from typing import Any, Literal, TypedDict, Annotated

from pydantic import BaseModel, ConfigDict
from typing_extensions import NotRequired

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import tool, StructuredTool
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage, SystemMessage, BaseMessage
from langchain.agents import create_agent
from langgraph.graph import StateGraph, add_messages
from langgraph.runtime import Runtime
from langgraph.prebuilt import ToolRuntime
from langgraph.types import Command


class Task(BaseModel):
    """Task."""

    id: int
    name: str
    details: str
    status: Literal[
        "pending", "in_progress", "completed", "interrupted", "in_review", "failed"
    ]
    model_config = ConfigDict(frozen=True)


class TaskList(BaseModel):
    """TaskList."""

    items: list[Task]


class PlanExecuteState(TypedDict):
    """PlanExecuteState."""

    messages: Annotated[list[BaseMessage], add_messages]
    task_list: NotRequired[TaskList]
    task_result: NotRequired[dict[int, Any]]


@dataclass
class PlanExecuteContext:
    """PlanExecuteContext."""

    model: BaseChatModel
    wiki: str
    tools: list[StructuredTool]
    enable_interrupt: bool


@tool
def update_task(
    task_id: int,
    status: Literal[
        "pending", "in_progress", "completed", "interrupted", "in_review", "failed"
    ],
    runtime: ToolRuntime,
) -> Command[Any]:
    """Update task status."""
    task_list: TaskList | None = runtime.state.get("task_list")
    if task_list is None:
        raise ValueError("task_list not found")
    prev_status = next(t for t in task_list.items if t.id == task_id).status
    new_items = []
    for t in task_list.items:
        if t.id == task_id:
            new_items.append(t.model_copy(update={"status": status}))
        else:
            new_items.append(t)
    return Command(
        update={
            "task_list": TaskList(items=new_items),
            "messages": [
                ToolMessage(
                    tool_call_id=runtime.tool_call_id,
                    name="update_task",
                    content=f"Task {task_id}: {prev_status} → {status}",
                )
            ],
        }
    )


@tool(parse_docstring=True, return_direct=True)
def create_tasks(tasks: TaskList, runtime: ToolRuntime) -> Command[Any]:
    """Create task list.

    Args:
        tasks: a TaskList object. Example: {"tasks": {"items": [{"id": 1, "name": "Check inventory", "details": "Call tool ... to explore inventory.", "status": "in_progress"}]}}
    """
    return Command(
        update={
            "task_list": tasks,
            "messages": [
                ToolMessage(
                    tool_call_id=runtime.tool_call_id,
                    name="create_tasks",
                    content=f"Created {len(tasks.items)} tasks",
                )
            ],
        }
    )


PLANNER_PROMPT = """
Break the user request into ordered tasks.

Rules:
- First task MUST be in_progress
- Others are pending
- Keep tasks small and actionable
"""

EXECUTOR_PROMPT = """
You execute ONE task.

Rules:
- Only execute task you are assigned. (STRICT)
- After execution, return the most relevant result. Avoid unnecessary information.
- Always return a result, whether it is a success, failure, or error.
"""

VALIDATOR_PROMPT = """
Validate the task result and update it's status.

Rules:
- If the task result is relevant -> Update it as completed.
- If the task result is need human approval or review -> Update it as interrupted.
- If the task result is error or failed -> Update it as failed.
"""


class PlanAndExecuteAgent:
    def __init__(
        self,
        model: BaseChatModel,
        wiki: str,
        tools: list[StructuredTool],
        enable_interrupt: bool = True,
    ):
        self.model = model
        self.wiki = wiki
        self.tools = tools
        self.enable_interrupt = enable_interrupt

        builder = StateGraph(PlanExecuteState, PlanExecuteContext)
        builder = builder.add_node("plan", self._plan_node)
        builder = builder.add_node("execute", self._execute_node)
        builder = builder.add_node("validate", self._validate_node)
        builder = builder.add_node("interrupt", self._interrupt_node)
        
        builder = builder.set_entry_point("plan")
        self.graph = builder.compile()

    def _plan_node(self, state: PlanExecuteState, runtime: Runtime[PlanExecuteContext]) -> Command[Literal["execute"]]:
        task_list = state.get("task_list")
        if task_list:
            # Check if there is an interrupted task (which means we are resuming from interrupt)
            interrupted_task = next((t for t in task_list.items if t.status == "interrupted"), None)
            if interrupted_task:
                # Get the last human message content as the answer
                last_msg = state["messages"][-1]
                answer = last_msg.content if last_msg else ""
                
                new_items = []
                for t in task_list.items:
                    if t.id == interrupted_task.id:
                        new_items.append(t.model_copy(update={"status": "in_progress"}))
                    else:
                        new_items.append(t)
                
                task_result = state.get("task_result", {})
                return Command(
                    update={
                        "task_list": TaskList(items=new_items),
                        "task_result": {**task_result, interrupted_task.id: answer},
                    },
                    goto="execute",
                )
            return Command(goto="execute")

        # Run planner agent to create the tasks list
        planner = create_agent(
            model=runtime.context.model,
            tools=[create_tasks],
            system_prompt=runtime.context.wiki + "\n" + PLANNER_PROMPT,
            state_schema=PlanExecuteState,
            name="planner",
        )
        
        result = planner.invoke(state)
        return Command(
            update={
                "messages": result.get("messages"),
                "task_list": result.get("task_list"),
            },
            goto="execute",
        )

    def _execute_node(self, state: PlanExecuteState, runtime: Runtime[PlanExecuteContext]) -> Command[Literal["validate"]]:
        task_list = state.get("task_list")
        task_result = state.get("task_result", {})
        base_len = len(state.get("messages", []))

        if not task_list:
            return Command(goto="validate")

        current = next((t for t in task_list.items if t.status == "in_progress"), None)
        if not current:
            # Try to find a pending task
            current = next((t for t in task_list.items if t.status == "pending"), None)
            if current:
                new_items = []
                for t in task_list.items:
                    if t.id == current.id:
                        new_items.append(t.model_copy(update={"status": "in_progress"}))
                    else:
                        new_items.append(t)
                task_list = TaskList(items=new_items)
                current = next((t for t in task_list.items if t.status == "in_progress"), None)
            else:
                return Command(goto="validate")

        executor = create_agent(
            model=runtime.context.model,
            tools=runtime.context.tools,
            state_schema=PlanExecuteState,
            name="executor",
        )

        system_message = SystemMessage(content=runtime.context.wiki + "\n" + EXECUTOR_PROMPT)
        human_message = HumanMessage(content=f"Execute task: {current}\nOnly execute the given task. Do not execute other tasks.")
        
        messages = [system_message] + state.get("messages", []) + [human_message]
        result = executor.invoke({"messages": messages})
        
        new_messages = result["messages"][len(messages):]
        output = ""
        if new_messages:
            output = new_messages[-1].content.lower()

        new_items = []
        for t in task_list.items:
            if t.id == current.id:
                new_items.append(t.model_copy(update={"status": "in_review"}))
            else:
                new_items.append(t)

        return Command(
            update={
                "messages": new_messages,
                "task_list": TaskList(items=new_items),
                "task_result": {**task_result, current.id: output},
            },
            goto="validate",
        )

    def _validate_node(self, state: PlanExecuteState, runtime: Runtime[PlanExecuteContext]) -> Command[Literal["execute", "interrupt", "__end__"]]:
        task_list = state.get("task_list")
        task_result = state.get("task_result", {})
        
        in_review_task = next((t for t in task_list.items if t.status == "in_review"), None)
        if not in_review_task:
            return Command(goto="__end__")
            
        in_review_task_result = task_result.get(in_review_task.id, "")

        validator = create_agent(
            model=runtime.context.model,
            tools=[update_task],
            state_schema=PlanExecuteState,
            name="validator",
        )

        system_message = SystemMessage(content=runtime.context.wiki + "\n" + VALIDATOR_PROMPT)
        human_message = HumanMessage(content=f"Validate this task: {in_review_task}\nThe result: {in_review_task_result}")
        
        messages = [system_message] + state.get("messages", []) + [human_message]
        validator_state = validator.invoke(
            {**state, "messages": messages}
        )

        new_task_list: TaskList = validator_state.get("task_list", task_list)

        # Check if any task was marked as interrupted
        if any(t.status == "interrupted" for t in new_task_list.items):
            if runtime.context.enable_interrupt:
                return Command(update={"task_list": new_task_list}, goto="interrupt")
            else:
                # If interrupts are disabled, override status of "interrupted" tasks to "completed"
                new_items = []
                for t in new_task_list.items:
                    if t.status == "interrupted":
                        new_items.append(t.model_copy(update={"status": "completed"}))
                    else:
                        new_items.append(t)
                new_task_list = TaskList(items=new_items)

        # Find the next pending task, set to in_progress, and go to execute
        for t in new_task_list.items:
            if t.status == "pending":
                new_items = []
                for x in new_task_list.items:
                    if x.id == t.id:
                        new_items.append(x.model_copy(update={"status": "in_progress"}))
                    else:
                        new_items.append(x)
                return Command(
                    update={"task_list": TaskList(items=new_items)},
                    goto="execute",
                )

        return Command(update={"task_list": new_task_list}, goto="__end__")

    def _interrupt_node(self, state: PlanExecuteState, runtime: Runtime[PlanExecuteContext]) -> Command[Literal["__end__"]]:
        task_list = state["task_list"]
        blocked = next(t for t in task_list.items if t.status == "interrupted")
        
        task_result = state.get("task_result", {}).get(blocked.id)
        question = (
            task_result
            if task_result
            else "Sorry, something went wrong. Would you like to retry?"
        )

        return Command(
            update={
                "messages": [AIMessage(content=question)],
            },
            goto="__end__",
        )

    def invoke(self, state: dict, **kwargs) -> dict:
        context = PlanExecuteContext(
            model=self.model,
            wiki=self.wiki,
            tools=self.tools,
            enable_interrupt=self.enable_interrupt,
        )
        return self.graph.invoke(state, context=context, **kwargs)
