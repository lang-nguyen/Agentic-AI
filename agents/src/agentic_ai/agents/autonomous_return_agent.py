"""Autonomous Return Agent (ReAct) running in the background to evaluate and approve/reject requests."""

import os
import json
import uuid
from datetime import datetime
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, dynamic_prompt
from agentic_ai.llm.llm_factory import get_default_llm
from agentic_ai.tools.tool_manager import ToolManager
from agentic_ai.state.react_state import State
from agentic_ai.prompts import AUTONOMOUS_RETURN_INSTRUCTION, AUTONOMOUS_RETURN_POLICY

def _get_config_path() -> str:
    return os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        "agent_config.json"
    )

def load_agent_config() -> dict:
    config_path = _get_config_path()
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                # Ensure all default keys are present
                if "agentic_enabled" not in config:
                    config["agentic_enabled"] = True
                if "instruction" not in config:
                    config["instruction"] = AUTONOMOUS_RETURN_INSTRUCTION
                if "policy" not in config:
                    config["policy"] = AUTONOMOUS_RETURN_POLICY
                return config
        except Exception:
            pass
    
    # Save default config if not existing
    default_config = {
        "agentic_enabled": True,
        "instruction": AUTONOMOUS_RETURN_INSTRUCTION,
        "policy": AUTONOMOUS_RETURN_POLICY
    }
    save_agent_config(default_config)
    return default_config

def save_agent_config(config: dict):
    config_path = _get_config_path()
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving agent config: {e}")

def get_agentic_status() -> bool:
    """Retrieve whether the autonomous Return Agent is enabled."""
    return load_agent_config().get("agentic_enabled", True)

def toggle_agentic_status() -> bool:
    """Toggle the enabled status of the autonomous Return Agent."""
    config = load_agent_config()
    config["agentic_enabled"] = not config.get("agentic_enabled", True)
    save_agent_config(config)
    return config["agentic_enabled"]

def get_thread_uuid(return_id: str) -> str:
    """Generate a deterministic UUID from return_id to satisfy LangGraph API requirements."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, return_id))

def log_agent_action(return_id: str, status: str, action: str, order_id: str, reason: str, comment: str):
    """Log the autonomous agent action and result for audit."""
    log_file = os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        "agent_logs.json"
    )
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    logs = []
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except Exception:
            pass
            
    new_log = {
        "timestamp": datetime.now().isoformat(),
        "return_id": return_id,
        "status": status,
        "action": action,
        "order_id": order_id,
        "reason": reason,
        "comment": comment
    }
    
    logs.insert(0, new_log)
    logs = logs[:100]  # limit to last 100 entries
    
    try:
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Failed to write agent action log: {e}")

def get_agent_logs() -> list:
    """Fetch the action logs of the autonomous agent."""
    log_file = os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        "agent_logs.json"
    )
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

@dynamic_prompt()
async def _build_system_prompt(request: ModelRequest) -> str:
    context = getattr(request.runtime, "context", None)
    if context and getattr(context, "autonomous_return_prompt", None):
        return context.autonomous_return_prompt
        
    config = load_agent_config()
    instruction = config.get("instruction", AUTONOMOUS_RETURN_INSTRUCTION)
    policy = config.get("policy", AUTONOMOUS_RETURN_POLICY)
    return f"<instruction>\n{instruction}\n</instruction>\n<policy>\n{policy}\n</policy>"

# Initialize the ReAct Agent with all available TauBench tools.
# No checkpointer is specified here since the LangGraph API platform takes care of persistence.
autonomous_return_agent = create_agent(
    model=get_default_llm(),
    tools=ToolManager().get_available_tools(),
    middleware=[_build_system_prompt],
    state_schema=State
)

async def run_background_agent_worker():
    """Background worker polling PENDING_PROCESSING return requests and processing them using ReAct Agentic loop."""
    import asyncio
    from langgraph_sdk import get_client
    from agentic_ai.infra.web_api import get_admin_return_requests

    print("Background ReAct AI Return Agent worker started.")
    while True:
        try:
            config = load_agent_config()
            if config.get("agentic_enabled", True):
                requests = await get_admin_return_requests()
                pending = [r for r in requests if r.get("status") == "PENDING_PROCESSING"]
                if pending:
                    print(f"Found {len(pending)} pending return requests in queue. Dispatching to ReAct Agent...")
                else:
                    print("No pending return requests found in queue. Waiting...")
                    
                for req in pending:
                    return_id = req.get("returnId") or req.get("id")
                    if not return_id:
                        continue
                        
                    print(f"Invoking ReAct Agent for return request {return_id}...")
                    user_message = f"Process return request ID '{return_id}'."
                    user_message = f"{user_message}\n{req}"
                    thread_uuid = get_thread_uuid(return_id)
                    
                    try:
                        client = get_client(url="http://127.0.0.1:8000")
                        # Create thread if it doesn't exist to prevent 404 runs/wait error
                        try:
                            await client.threads.get(thread_uuid)
                        except Exception:
                            await client.threads.create(thread_id=thread_uuid)
                            
                        # Create run and poll status to support older versions of langgraph-api (0.7.x)
                        run = await client.runs.create(
                            thread_id=thread_uuid,
                            assistant_id="autonomous_return_agent",
                            input={
                                "messages": [
                                    {
                                        "role": "user",
                                        "content": user_message
                                    }
                                ]
                            }
                        )
                        # Poll until finished
                        while run.get("status") not in ["success", "failed", "cancelled"]:
                            await asyncio.sleep(1)
                            run = await client.runs.get(thread_id=thread_uuid, run_id=run["run_id"])
                            
                        if run.get("status") == "success":
                            print(f"ReAct Agent finished running via LangGraph SDK on thread '{thread_uuid}'.")
                            
                            # Wait a bit then check updated status to log metadata
                            await asyncio.sleep(1)
                            updated_requests = await get_admin_return_requests()
                            updated_req = next((r for r in updated_requests if (r.get("returnId") == return_id or r.get("id") == return_id)), None)
                            if updated_req:
                                log_agent_action(
                                    return_id=return_id,
                                    status=str(updated_req.get("status")),
                                    action=str(updated_req.get("action")),
                                    order_id=str(updated_req.get("orderId")),
                                    reason=str(updated_req.get("reason")),
                                    comment=updated_req.get("items")[0].get("customerComment") if updated_req.get("items") else ""
                                )
                            
                            # Publish event to all admin clients for instant UI refresh
                            try:
                                from agentic_ai.persistence.events import publish_agent_update
                                await publish_agent_update()
                            except Exception as sse_err:
                                print(f"Failed to publish agent update event: {sse_err}")
                        else:
                            print(f"LangGraph API run ended with status {run.get('status')}.")
                    except Exception as e:
                        print(f"Error invoking ReAct Agent for return {return_id}: {e}")
                        
        except Exception as e:
            print(f"Error in background agent worker loop: {e}")
            
        await asyncio.sleep(10)

def start_background_agent_worker():
    """Start background worker task."""
    import asyncio
    asyncio.create_task(run_background_agent_worker())
