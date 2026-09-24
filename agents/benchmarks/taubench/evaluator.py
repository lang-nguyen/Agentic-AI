# ruff: noqa
# mypy: ignore-errors

from typing import Any
from itertools import chain
from agentic_ai.tools import ALL_TAUBENCH_TOOLS
from langchain_core.messages.tool import tool_call

def _parse_tool_calls_from_task(task: Any) -> Any:
    actions = task.get("actions",[])
    tool_calls = [tool_call(name=a["name"], args=a["kwargs"], id=None) for a in actions]
    return tool_calls
    
def _parse_tool_calls_from_state(state: Any) -> Any:
    messages = state.get("messages", [])
    pred_tool_calls = [
        msg.tool_calls
        for msg in messages
        if msg.type == "ai" and msg.tool_calls
    ]
    pred_tool_calls = list(chain.from_iterable(pred_tool_calls))
    taubench_tool_names = [t.name for t in ALL_TAUBENCH_TOOLS]
    pred_tool_calls = [t for t in pred_tool_calls if t["name"] in taubench_tool_names]
    return pred_tool_calls
        
def _normalize_value(v):
    if isinstance(v, dict):
        return {
            k: _normalize_value(v[k])
            for k in sorted(v.keys())
        }
    elif isinstance(v, list):
        return [_normalize_value(x) for x in v]
    elif isinstance(v, (int, float)):
        return str(v)
    else:
        return v
    

def _normalize_args(args):
    if args is None:
        return {}
    return {
        k: _normalize_value(args[k])
        for k in sorted(args.keys())
    }


def _is_same_args(pred_args, true_args):
    return _normalize_args(pred_args) == _normalize_args(true_args)


def evaluate_tool_calls(pred_list, true_list):
    """
    Args:
        pred_list: list of tool calls (prediction)
        true_list: list of tool calls (ground truth)

    Returns:
        dict with correct, missing, extra, mismatch
    """

    correct = []
    mismatch = []
    missing = []
    extra = []

    used_pred = set()

    for gt in true_list:
        gt_name = gt.get("name")
        gt_args = gt.get("args", {})

        matched = False

        for i, pred in enumerate(pred_list):
            if i in used_pred:
                continue

            pred_name = pred.get("name")
            pred_args = pred.get("args", {})

            # match tool name
            if pred_name == gt_name:

                # match args
                if _is_same_args(pred_args, gt_args):
                    correct.append(pred)
                    used_pred.add(i)
                else:
                    mismatch.append({
                        "pred": pred,
                        "true": gt,
                    })

                matched = True
                break

        if not matched:
            missing.append(gt)

    # find extra pred
    for i, pred in enumerate(pred_list):
        if i not in used_pred:
            extra.append(pred)

    return {
        "scores": {
            "correct": len(correct),
            "missing": len(missing),
            "extra": len(extra),
            "mismatch": len(mismatch)
        },
        "correct": correct,
        "missing": missing,
        "extra": extra,
        "mismatch": mismatch,
    }
    
# ===============================================================================

from agentic_ai.agents.plan_and_execute import graph
from agentic_ai.state.plan_execute import PlanExecuteContext, PlanExecuteState
from agentic_ai.prompts.taubench import WIKI
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langsmith import trace, uuid7
from langsmith.client import Client
from pathlib import Path
import asyncio
import os
import json
from tqdm import tqdm

TASK_PATH = Path(__file__).parent / "tasks" / "tasks_test.json"
SAVE_DIR = Path(__file__).parent / "results" / "4-plan-and-execute-gpt-oss-20b"
START_INDEX = 0
END_INDEX = None
RECURSION_LIMIT = 25
LLM_MODEL = "gpt-oss:20b"
LANGSMITH_PROJECT_NAME = "5-plan-and-execute-gpt-oss-20b"
TAGS = ["taubench"]

os.makedirs(SAVE_DIR, exist_ok=True)

with open(TASK_PATH, "r", encoding="utf-8") as f:
    tasks = json.load(f)

base_model = ChatOllama(
    model="gpt-oss:20b",
    num_ctx=16384,
    keep_alive=-1,
    temperature=0.0,
    seed=42,
    
)

client = Client()

for task_idx, task in enumerate(tqdm(tasks[START_INDEX:END_INDEX], desc="Running tasks", ncols=70), start=START_INDEX):
    init_state = PlanExecuteState(
        messages=[
            SystemMessage(WIKI),
            HumanMessage(task["prompt"])
        ]
    )
    
    run_id = uuid7()
    print("\nrun_id:", run_id)
    
    with trace(
        client=client,
        run_id=run_id,
        name=f"task_{task_idx}", 
        project_name=LANGSMITH_PROJECT_NAME,
        inputs=init_state,
        tags=TAGS,
        metadata={
            "model": LLM_MODEL,
            "taubench": {
                "task_idx": task_idx
            }
        },
        attachments={
            "task": (
                "application/json",
                json.dumps(task, ensure_ascii=False, indent=2)
            )
        }
    ) as run:
        config = {
            "configurable": {"thread_id": f"task_{task_idx}"},
            "recursion_limit": RECURSION_LIMIT
        }
        
        checkpointer = MemorySaver()
        agent = graph.compile(checkpointer)
        run.ensure_dotted_order()
        error = None
        context = PlanExecuteContext(
            model=base_model
        )
        try:
            _ = asyncio.run(agent.ainvoke(input=init_state, context=context, config=config))
        except Exception as e:
            print(f"Error at task {task_idx}: {e}")
            error = str(e)
            
        state = agent.get_state(config).values
       
        true_tool_calls = _parse_tool_calls_from_task(task)
        pred_tool_calls = _parse_tool_calls_from_state(state)
        scores = evaluate_tool_calls(true_list=true_tool_calls, pred_list=pred_tool_calls)

        checkpointer.storage.clear()
        
        for k, v in scores.get("scores", {}).items():
            client.create_feedback(
                key=k,
                score=v,
                trace_id=run.id,
                extra={k: scores[k]},
            )

        result = {
            "task_idx": task_idx,
            "task": task,
            "scores": scores,
            "trace_url": run.get_url()
        }
        if error:
            result["error"] = error

        file_path = os.path.join(SAVE_DIR, f"task_{task_idx}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)        
        print(scores["scores"])
        print(f"task saved at: {os.path.abspath(file_path)}")