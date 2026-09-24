"""FastAPI router for Smart Return endpoints."""

import json
import os

import httpx
from fastapi import APIRouter, BackgroundTasks

from agentic_ai.services.smart_return.models import (
    ExperimentRequest,
    ExperimentResponse,
    ReturnEvaluationResult,
    ReturnRequest,
    RuleRepresentation,
    ScenarioExperimentResult,
    TestScenarioRepresentation,
)
from agentic_ai.services.smart_return.rule import NLPBased, RuleBased
from agentic_ai.services.smart_return.rule_action import ActionType, RuleAction
from agentic_ai.services.smart_return.rule_manager import RuleManager

router = APIRouter(prefix="/api/smart-return", tags=["Smart Return"])


def get_rule_manager() -> RuleManager:
    """Load policy rules from seed_rules.json and return a configured RuleManager."""
    rules_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "data",
        "seed",
        "seed_rules.json",
    )
    with open(rules_path, encoding="utf-8") as f:
        rules_data = json.load(f)

    rule_based_rules = []
    nlp_rules = []

    for r in rules_data:
        rule_type = r.get("type")
        rule_id = r.get("rule_id")
        name = r.get("name")
        active = r.get("active", True)
        condition = r.get("condition")
        action_data = r.get("action")

        action = RuleAction(
            action_type=ActionType(action_data["action_type"]),
            mode=action_data["mode"],
        )

        if rule_type == "RuleBased":
            rule_based_rules.append(
                RuleBased(
                    rule_id=rule_id,
                    name=name,
                    condition=condition,
                    action=action,
                    active=active,
                )
            )
        elif rule_type == "NLPBased":
            nlp_rules.append(
                NLPBased(
                    rule_id=rule_id,
                    name=name,
                    condition=condition,
                    action=action,
                    active=active,
                )
            )

    return RuleManager(
        rule_based_rules=rule_based_rules,
        nlp_rules=nlp_rules,
    )


async def send_webhook_callback(callback_url: str, result_data: ReturnEvaluationResult):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                callback_url,
                json=result_data.model_dump(),
                timeout=10.0
            )
            response.raise_for_status()
        except Exception as e:
            print(f"Error calling webhook callback {callback_url}: {e}")


@app_post := router.post("/evaluate")
async def evaluate_return_request(request_data: ReturnRequest, background_tasks: BackgroundTasks):
    """Evaluate a customer return request against configured business and AI policies."""
    request_dict = request_data.model_dump()
    manager = get_rule_manager()
    result = manager.process_request(request_dict)

    eval_result = ReturnEvaluationResult(
        request_id=result["request_id"],
        rule_id=result.get("rule_id"),
        mode=result["mode"],
        status=result["status"],
        action=result.get("action"),
        ai_summary_for_staff=result.get("ai_summary_for_staff"),
        message_to_customer=result.get("message_to_customer"),
    )

    if request_data.callback_url:
        background_tasks.add_task(send_webhook_callback, request_data.callback_url, eval_result)

    # Publish SSE event to notify admin of the new queue item
    try:
        from agentic_ai.persistence.events import publish_agent_update
        background_tasks.add_task(publish_agent_update)
    except Exception as e:
        print(f"Failed to publish agent update event: {e}")

    return eval_result



@app_get := router.get("/rules", response_model=list[RuleRepresentation])
async def get_all_rules():
    """Retrieve all policy rules configured in the smart return system."""
    manager = get_rule_manager()
    rules_list = []

    # Process rule-based rules
    for rb_rule in manager.rule_based_rules:
        rules_list.append(
            RuleRepresentation(
                rule_id=rb_rule.rule_id,
                name=rb_rule.name,
                type="RuleBased",
                active=rb_rule.active,
                condition=rb_rule.condition,
                action={
                    "action_type": rb_rule.action.action_type,
                    "mode": rb_rule.action.mode,
                },
            )
        )

    # Process NLP-based rules
    for nlp_rule in manager.nlp_rules:
        rules_list.append(
            RuleRepresentation(
                rule_id=nlp_rule.rule_id,
                name=nlp_rule.name,
                type="NLPBased",
                active=nlp_rule.active,
                condition=nlp_rule.condition,
                action={
                    "action_type": nlp_rule.action.action_type,
                    "mode": nlp_rule.action.mode,
                },
            )
        )

    return rules_list


@router.get("/scenarios", response_model=list[TestScenarioRepresentation])
async def get_test_scenarios():
    """Retrieve all smart return test scenarios from seed_scenarios.json."""
    scenarios_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "data",
        "seed",
        "seed_scenarios.json",
    )
    with open(scenarios_path, encoding="utf-8") as f:
        scenarios_data = json.load(f)
    return scenarios_data


@router.post("/experiment", response_model=ExperimentResponse)
async def run_experiment(payload: ExperimentRequest):
    """Run an experiment by evaluating custom scenarios against a custom rule set."""
    rule_based_rules = []
    nlp_rules = []

    for r in payload.rules:
        action = RuleAction(
            action_type=r.action.action_type,
            mode=r.action.mode,
        )
        if r.type == "RuleBased":
            rule_based_rules.append(
                RuleBased(
                    rule_id=r.rule_id,
                    name=r.name,
                    condition=r.condition,
                    action=action,
                    active=r.active,
                )
            )
        elif r.type == "NLPBased":
            nlp_rules.append(
                NLPBased(
                    rule_id=r.rule_id,
                    name=r.name,
                    condition=str(r.condition),
                    action=action,
                    active=r.active,
                )
            )

    manager = RuleManager(
        rule_based_rules=rule_based_rules,
        nlp_rules=nlp_rules,
    )

    results = []
    for sc in payload.scenarios:
        request_dict = sc.request.model_dump()
        result = manager.process_request(request_dict)

        actual_result = ReturnEvaluationResult(
            request_id=result["request_id"],
            rule_id=result.get("rule_id"),
            mode=result["mode"],
            status=result["status"],
            action=result.get("action"),
            ai_summary_for_staff=result.get("ai_summary_for_staff"),
            message_to_customer=result.get("message_to_customer"),
        )

        expected = sc.expected_result
        is_pass = (
            actual_result.status == expected.status
            and actual_result.mode == expected.mode
            and actual_result.action == expected.action
        )
        status = "PASS" if is_pass else "FAIL"

        results.append(
            ScenarioExperimentResult(
                scenario_name=sc.scenario_name,
                request=sc.request,
                expected_result=sc.expected_result,
                actual_result=actual_result,
                status=status,
            )
        )

    return ExperimentResponse(results=results)


from fastapi import Body
from agentic_ai.agents.autonomous_return_agent import (
    load_agent_config,
    save_agent_config,
    get_agent_logs,
    toggle_agentic_status,
    autonomous_return_agent,
    get_thread_uuid
)

@router.get("/agent/config")
async def get_agent_config():
    """Retrieve autonomous Return Agent configuration (enabled status, instruction, policy)."""
    return load_agent_config()

@router.get("/agent/all-configs")
async def get_all_agent_configs():
    """Retrieve detailed configuration of all active agents from LangGraph API (Search and Schemas)."""
    import httpx
    from agentic_ai.prompts import GUARDIAN_PROMPT, CUSTOMER_SUPPORT_PROMPT, AUTONOMOUS_RETURN_INSTRUCTION, AUTONOMOUS_RETURN_POLICY

    agents_list = []
    try:
        async with httpx.AsyncClient() as client:
            # 1. Search all assistants via LangGraph API endpoint
            res = await client.post("http://127.0.0.1:8000/assistants/search", json={})
            if res.status_code == 200:
                assistants = res.json()
                for a in assistants:
                    aid = a["assistant_id"]
                    graph_id = a["graph_id"]
                    name = a["name"]
                    
                    # 2. Fetch detailed schemas for this assistant_id
                    schema_res = await client.get(f"http://127.0.0.1:8000/assistants/{aid}/schemas")
                    schema_data = schema_res.json() if schema_res.status_code == 200 else {}
                    
                    # Extract prompts from context_schema
                    context_props = schema_data.get("context_schema", {}).get("properties", {})
                    prompts_info = []
                    
                    for prop_name, prop_val in context_props.items():
                        if prop_val.get("langgraph_type") == "prompt" or "prompt" in prop_name:
                            prompts_info.append({
                                "name": prop_name,
                                "title": prop_val.get("title", prop_name.replace("_", " ").title()),
                                "value": prop_val.get("default", "")
                            })
                            
                    # Construct agent description & tools list
                    if graph_id == "guardian_graph":
                        desc = "User-facing orchestrator containing the Safety Guard node and the Customer Support node."
                        tools = [
                            {"name": "transfer_to_agent", "description": "Transfer the user request to the ReAct customer support agent."},
                            {"name": "transfer_to_human_agents", "description": "Transfer the customer to human support staff."},
                            {"name": "create_return_request", "description": "Create a return or exchange request for delivered order items."},
                            {"name": "get_order_details", "description": "Retrieve order history and item delivery status."},
                            {"name": "get_product_details", "description": "Look up product details and variants information."},
                            {"name": "list_all_product_types", "description": "Retrieve all available products and types in the store."}
                        ]
                    elif graph_id == "autonomous_return_agent":
                        desc = "Virtual background staff member executing automatic decisions to approve or reject return requests."
                        tools = [
                            {"name": "All Store Tools", "description": "Full access to inventory, users database, and order management tools."}
                        ]
                    else:
                        desc = f"LangGraph assistant graph: {graph_id}"
                        tools = []
                        
                    # Fallback default prompts if schemas list is empty
                    if not prompts_info:
                        if graph_id == "guardian_graph":
                            prompts_info = [
                                {"name": "guardian_prompt", "title": "Guardian Prompt", "value": GUARDIAN_PROMPT},
                                {"name": "customer_support_prompt", "title": "Customer Support Prompt", "value": CUSTOMER_SUPPORT_PROMPT}
                            ]
                        elif graph_id == "autonomous_return_agent":
                            prompts_info = [
                                {"name": "autonomous_return_prompt", "title": "Autonomous Return Prompt", "value": f"Instruction:\n{AUTONOMOUS_RETURN_INSTRUCTION}\n\nPolicy:\n{AUTONOMOUS_RETURN_POLICY}"}
                            ]
                            
                    agents_list.append({
                        "id": graph_id,
                        "name": name.replace("_", " ").title(),
                        "assistant_id": aid,
                        "description": desc,
                        "prompts": prompts_info,
                        "tools": tools,
                        "status": "Active"
                    })
            else:
                print(f"Failed to query assistants search: status {res.status_code}")
    except Exception as e:
        print(f"Failed to connect to LangGraph API for assistants search/schemas: {e}")

    # Fallback default hardcoded structure if API query fails completely
    if not agents_list:
        agents_list = [
            {
                "id": "guardian_graph",
                "name": "Guardian Graph",
                "assistant_id": "bea64633-ac4b-5470-a6a6-72fc05efc602",
                "description": "User-facing orchestrator containing the Safety Guard node and the Customer Support node.",
                "prompts": [
                    {"name": "guardian_prompt", "title": "Guardian Prompt", "value": GUARDIAN_PROMPT},
                    {"name": "customer_support_prompt", "title": "Customer Support Prompt", "value": CUSTOMER_SUPPORT_PROMPT}
                ],
                "tools": [
                    {"name": "transfer_to_agent", "description": "Transfer the user request to the ReAct customer support agent."},
                    {"name": "transfer_to_human_agents", "description": "Transfer the customer to human support staff."},
                    {"name": "create_return_request", "description": "Create a return or exchange request for delivered order items."},
                    {"name": "get_order_details", "description": "Retrieve order history and item delivery status."},
                    {"name": "get_product_details", "description": "Look up product details and variants information."},
                    {"name": "list_all_product_types", "description": "Retrieve all available products and types in the store."}
                ],
                "status": "Active"
            },
            {
                "id": "autonomous_return_agent",
                "name": "Autonomous Return Agent",
                "assistant_id": "7d0101db-1866-5aa9-aacc-f21cb2b2ceae",
                "description": "Virtual background staff member executing automatic decisions to approve or reject return requests.",
                "prompts": [
                    {"name": "autonomous_return_prompt", "title": "Autonomous Return Prompt", "value": f"Instruction:\n{AUTONOMOUS_RETURN_INSTRUCTION}\n\nPolicy:\n{AUTONOMOUS_RETURN_POLICY}"}
                ],
                "tools": [
                    {"name": "All Store Tools", "description": "Full access to inventory, users database, and order management tools."}
                ],
                "status": "Active"
            }
        ]

    return agents_list

@router.post("/agent/config")
async def update_agent_config(config: dict = Body(...)):
    """Update autonomous Return Agent configuration."""
    save_agent_config(config)
    try:
        from agentic_ai.persistence.events import publish_agent_update
        await publish_agent_update()
    except Exception:
        pass
    return load_agent_config()

@router.post("/agent/toggle")
async def toggle_agent():
    """Toggle the enabled status of the autonomous Return Agent."""
    status = toggle_agentic_status()
    try:
        from agentic_ai.persistence.events import publish_agent_update
        await publish_agent_update()
    except Exception:
        pass
    return {"agentic_enabled": status}


@router.get("/agent/logs")
async def get_agentic_logs():
    """Retrieve audit action logs of the autonomous agent."""
    return get_agent_logs()

from langgraph_sdk import get_client

@router.get("/agent/trace/{return_id}")
async def get_agent_trace(return_id: str):
    """Retrieve trace messages of the autonomous agent for a specific return request."""
    thread_uuid = get_thread_uuid(return_id)
    # Attempt to query from LangGraph API via SDK (Port 2024)
    try:
        client = get_client(url="http://127.0.0.1:2024")
        state_data = await client.threads.get_state(thread_id=thread_uuid)
        if state_data:
            messages = state_data.get("values", {}).get("messages", [])
            return {"messages": messages}
    except Exception as e:
        print(f"LangGraph SDK thread state query failed for uuid {thread_uuid}: {e}")
    return {"messages": []}

@router.get("/agent/queue")
async def get_agent_queue():
    """Retrieve the queue of pending return requests waiting for the agent to process."""
    try:
        from agentic_ai.infra.web_api import get_admin_return_requests
        requests = await get_admin_return_requests()
        pending = [r for r in requests if r.get("status") == "PENDING_PROCESSING"]
        return pending
    except Exception as e:
        print(f"Failed to fetch agent queue: {e}")
        return []








