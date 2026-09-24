from unittest.mock import patch

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from agentic_ai.services.smart_return.enums import RuleMode, RuleStatus
from agentic_ai.services.smart_return.rule import NLPBased, RuleBased
from agentic_ai.services.smart_return.rule_action import ActionType, RuleAction
from agentic_ai.services.smart_return.rule_manager import RuleManager


def test_rule_based_is_match_days_since_delivery() -> None:
    # Test Case 1: RuleBased.is_match() returns TRUE when condition exceeds
    rule = RuleBased(
        rule_id="R001",
        name="Delivery date limit",
        condition={"field": "days_since_delivery", "operator": "greater_than", "value": 7},
        action=RuleAction(ActionType.REJECT_REFUND, RuleMode.AUTO)
    )
    
    # Matching request
    request_match = {"request_id": "REQ001", "days_since_delivery": 10}
    assert rule.is_match(request_match) is True
    
    # Non-matching request
    request_no_match = {"request_id": "REQ002", "days_since_delivery": 5}
    assert rule.is_match(request_no_match) is False


def test_rule_based_run_action_auto() -> None:
    # Test Case 2: RuleBased.run_action() returns correct AUTO result
    rule = RuleBased(
        rule_id="R002",
        name="T-shirt Refund Rule",
        condition={"field": "category", "operator": "equal", "value": "T-shirt"},
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO)
    )
    
    request = {
        "request_id": "R002",
        "category": "T-shirt"
    }
    
    result = rule.run_action(request)
    assert result["mode"] == RuleMode.AUTO.value
    assert result["status"] == RuleStatus.APPROVED.value
    assert result["action"] == ActionType.REFUND_IMMEDIATELY.value
    assert ActionType.REFUND_IMMEDIATELY.value in result["message_to_customer"]
    
    # Test with REJECT action to check status logic
    rule_reject = RuleBased(
        rule_id="R002_REJ",
        name="T-shirt Reject Rule",
        condition={"field": "category", "operator": "equal", "value": "T-shirt"},
        action=RuleAction(ActionType.REJECT_REFUND, RuleMode.AUTO)
    )
    result_reject = rule_reject.run_action(request)
    assert result_reject["status"] == RuleStatus.REJECTED.value


@patch("agentic_ai.llm.llm_factory.get_default_llm")
def test_nlp_based_is_match_and_run_action_mocked(mock_get_llm) -> None:
    # Set up the fake chat model
    fake_llm = FakeListChatModel(responses=["True"])
    mock_get_llm.return_value = fake_llm

    # Test Case 3 with mocked LLM path
    rule = NLPBased(
        rule_id="R003",
        name="Torn Product Rule",
        condition="Product is torn or ripped",
        action=RuleAction(ActionType.REFUND_AND_RETURN, RuleMode.SEMI_AUTO)
    )
    
    request = {
        "request_id": "R003",
        "user_text_description": "áo bị rách"
    }
    
    # Verify is_match returns True (using fast heuristic matcher)
    assert rule.is_match(request) is True
    
    # Verify run_action returns SEMI-AUTO layout
    result = rule.run_action(request)
    assert result["mode"] == RuleMode.SEMI_AUTO.value
    assert result["status"] == RuleStatus.PENDING_PROCESSING.value
    assert result["action"] == ActionType.WAIT_FOR_APPROVAL.value
    assert "ai_summary_for_staff" in result
    assert ActionType.REFUND_AND_RETURN.value in result["ai_summary_for_staff"]


@patch("agentic_ai.llm.llm_factory.get_default_llm")
def test_nlp_based_llm_match(mock_get_llm) -> None:
    # Set up the fake chat model to return True
    fake_llm = FakeListChatModel(responses=["True"])
    mock_get_llm.return_value = fake_llm

    rule = NLPBased(
        rule_id="R003_LLM",
        name="Damaged Product Rule",
        condition="Product is damaged",
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.SEMI_AUTO)
    )

    request = {
        "request_id": "R003_1",
        "user_text_description": "sản phẩm bị hư hại nghiêm trọng"
    }

    # Should call the LLM and match True
    assert rule.is_match(request) is True
    mock_get_llm.assert_called_once()


@patch("agentic_ai.llm.llm_factory.get_default_llm")
def test_nlp_based_llm_no_match(mock_get_llm) -> None:
    # Set up the fake chat model to return False
    fake_llm = FakeListChatModel(responses=["False"])
    mock_get_llm.return_value = fake_llm

    rule = NLPBased(
        rule_id="R003_LLM_NO",
        name="Damaged Product Rule",
        condition="Product is damaged",
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.SEMI_AUTO)
    )

    request = {
        "request_id": "R003_2",
        "user_text_description": "sản phẩm vẫn hoàn hảo"
    }

    assert rule.is_match(request) is False
    mock_get_llm.assert_called_once()


@patch("agentic_ai.llm.llm_factory.get_default_llm")
def test_rule_manager_precedence_and_fallback(mock_get_llm) -> None:
    # Set up the fake chat model
    fake_llm = FakeListChatModel(responses=["NLP1", "NONE"])
    mock_get_llm.return_value = fake_llm

    # Initialize rules
    rule_based = RuleBased(
        rule_id="RB1",
        name="Under 7 days",
        condition={"field": "days_since_delivery", "operator": "less_than_or_equal", "value": 7},
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO)
    )
    nlp_rule = NLPBased(
        rule_id="NLP1",
        name="Stained Product",
        condition="Product is stained or dirty",
        action=RuleAction(ActionType.REFUND_AND_RETURN, RuleMode.SEMI_AUTO)
    )
    
    manager = RuleManager(rule_based_rules=[rule_based], nlp_rules=[nlp_rule])
    
    # Case A: Rule-based matches first (should bypass NLP)
    request_a = {
        "request_id": "REQ_A",
        "days_since_delivery": 5,
        "user_text_description": "bẩn quá"
    }
    result_a = manager.process_request(request_a)
    assert result_a["mode"] == RuleMode.AUTO.value
    assert result_a["action"] == ActionType.REFUND_IMMEDIATELY.value
    assert result_a["rule_id"] == "RB1"
    
    # Case B: Rule-based mismatches, NLP matches
    request_b = {
        "request_id": "REQ_B",
        "days_since_delivery": 10,
        "user_text_description": "vết bẩn dơ"
    }
    result_b = manager.process_request(request_b)
    assert result_b["mode"] == RuleMode.SEMI_AUTO.value
    assert result_b["status"] == RuleStatus.PENDING_PROCESSING.value
    assert result_b["rule_id"] == "NLP1"
    
    # Case C: Neither matches -> MANUAL_REVIEW fallback to PENDING_PROCESSING
    request_c = {
        "request_id": "REQ_C",
        "days_since_delivery": 12,
        "user_text_description": "tôi không thích sản phẩm này nữa"
    }
    result_c = manager.process_request(request_c)
    assert result_c["status"] == RuleStatus.PENDING_PROCESSING.value
    assert result_c["rule_id"] is None


def test_rule_based_multiple_conditions() -> None:
    # Test multiple conditions: {"operator": "AND", "rules": [...]}
    rule_and = RuleBased(
        rule_id="R004_AND",
        name="Cheap T-shirts under 10 USD",
        condition={
            "operator": "AND",
            "rules": [
                {"field": "category", "operator": "equal", "value": "T-shirt"},
                {"field": "item_value", "operator": "less_than", "value": 10}
            ]
        },
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO)
    )
    
    # Matches both conditions
    req_match = {"request_id": "REQ004_1", "category": "T-shirt", "item_value": 8}
    assert rule_and.is_match(req_match) is True
    
    # Matches category but item_value is >= 10
    req_no_match_value = {"request_id": "REQ004_2", "category": "T-shirt", "item_value": 12}
    assert rule_and.is_match(req_no_match_value) is False
    
    # Matches value but different category
    req_no_match_cat = {"request_id": "REQ004_3", "category": "Shoes", "item_value": 5}
    assert rule_and.is_match(req_no_match_cat) is False

    # Test OR operator: {"operator": "OR", "rules": [...]}
    rule_or = RuleBased(
        rule_id="R004_OR",
        name="T-shirt OR cheap item",
        condition={
            "operator": "OR",
            "rules": [
                {"field": "category", "operator": "equal", "value": "T-shirt"},
                {"field": "item_value", "operator": "less_than", "value": 10}
            ]
        },
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO)
    )
    
    # Matches Category only
    assert rule_or.is_match({"category": "T-shirt", "item_value": 20}) is True
    # Matches cheap item value only
    assert rule_or.is_match({"category": "Shoes", "item_value": 5}) is True
    # Matches neither
    assert rule_or.is_match({"category": "Shoes", "item_value": 20}) is False


def test_rule_based_invalid_operator_raises_error() -> None:
    # Verify that symbol operators or unknown operators raise ValueError
    rule = RuleBased(
        rule_id="R005_ERR",
        name="Symbol operator",
        condition={"field": "days_since_delivery", "operator": ">", "value": 7},
        action=RuleAction(ActionType.REJECT_REFUND, RuleMode.AUTO)
    )
    
    request = {"days_since_delivery": 10}
    with pytest.raises(ValueError) as exc_info:
        rule.is_match(request)
    
    assert "Invalid operator '>'" in str(exc_info.value)


def test_rule_based_invalid_logical_operator_raises_error() -> None:
    # Verify that invalid logical operators raise ValueError
    rule = RuleBased(
        rule_id="R006_ERR",
        name="Invalid Logical Operator",
        condition={
            "operator": "XOR",
            "rules": [
                {"field": "category", "operator": "equal", "value": "T-shirt"}
            ]
        },
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO)
    )
    
    request = {"category": "T-shirt"}
    with pytest.raises(ValueError) as exc_info:
        rule.is_match(request)
    
    assert "Invalid logical operator 'XOR'" in str(exc_info.value)


def test_rule_invalid_action_type_raises_error() -> None:
    # Verify that rule raises TypeError if action is not RuleAction instance
    with pytest.raises(TypeError) as exc_info:
        RuleBased(
            rule_id="R007_ERR",
            name="Invalid action type",
            condition={"field": "category", "operator": "equal", "value": "T-shirt"},
            action="REFUND_IMMEDIATELY"  # type: ignore
        )
    assert "action must be an instance of RuleAction" in str(exc_info.value)


def test_rule_action_invalid_mode_raises_error() -> None:
    # Verify that RuleAction raises TypeError if mode is invalid
    with pytest.raises(TypeError) as exc_info:
        RuleAction(ActionType.REFUND_IMMEDIATELY, "INVALID_MODE")
    assert "mode must be a valid RuleMode Enum" in str(exc_info.value)


def test_rule_active_flag() -> None:
    # Rule 1 is active, Rule 2 is inactive but would match
    rb_active = RuleBased(
        rule_id="RB_ACTIVE",
        name="Active rule",
        condition={"field": "days_since_delivery", "operator": "less_than_or_equal", "value": 7},
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO),
        active=True
    )
    rb_inactive = RuleBased(
        rule_id="RB_INACTIVE",
        name="Inactive rule",
        condition={"field": "days_since_delivery", "operator": "less_than_or_equal", "value": 14},
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO),
        active=False
    )

    manager = RuleManager(rule_based_rules=[rb_inactive, rb_active])

    # Request: days_since_delivery is 10.
    # It meets the condition for rb_inactive (10 <= 14) but NOT for rb_active (10 <= 7).
    # Since rb_inactive is active=False, it should skip it and fallback to MANUAL_REVIEW.
    request = {
        "request_id": "REQ_ACTIVE_TEST",
        "days_since_delivery": 10
    }

    result = manager.process_request(request)
    assert result["mode"] == RuleMode.MANUAL.value
    assert result["status"] == RuleStatus.PENDING_PROCESSING.value


@patch("agentic_ai.llm.llm_factory.get_default_llm")
def test_rule_manager_nlp_batch_evaluation_mocked(mock_get_llm) -> None:
    fake_llm = FakeListChatModel(responses=["NLP_DAMAGED"])
    mock_get_llm.return_value = fake_llm

    nlp_damaged = NLPBased(
        rule_id="NLP_DAMAGED",
        name="Damaged item check",
        condition="Product is damaged",
        action=RuleAction(ActionType.REFUND_AND_RETURN, RuleMode.SEMI_AUTO)
    )
    nlp_incorrect = NLPBased(
        rule_id="NLP_INCORRECT",
        name="Incorrect item check",
        condition="Product is incorrect",
        action=RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.SEMI_AUTO)
    )

    manager = RuleManager(nlp_rules=[nlp_damaged, nlp_incorrect], nlp_batch_size=2)
    request = {
        "request_id": "REQ_BATCH_1",
        "user_text_description": "áo bị rách"
    }

    result = manager.process_request(request)
    assert result["rule_id"] == "NLP_DAMAGED"
    assert result["mode"] == RuleMode.SEMI_AUTO.value
    assert result["status"] == RuleStatus.PENDING_PROCESSING.value


@patch("agentic_ai.llm.llm_factory.get_default_llm")
def test_rule_manager_nlp_batch_evaluation_multiple_batches(mock_get_llm) -> None:
    # First batch (rules 1-2): returns "NONE"
    # Second batch (rules 3-4): returns "NLP_MATCH"
    fake_llm = FakeListChatModel(responses=["NONE", "NLP_MATCH"])
    mock_get_llm.return_value = fake_llm

    nlp1 = NLPBased("NLP1", "Rule 1", "Condition 1", RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO))
    nlp2 = NLPBased("NLP2", "Rule 2", "Condition 2", RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO))
    nlp_match = NLPBased("NLP_MATCH", "Rule 3", "Condition 3", RuleAction(ActionType.REFUND_AND_RETURN, RuleMode.SEMI_AUTO))
    nlp4 = NLPBased("NLP4", "Rule 4", "Condition 4", RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO))

    manager = RuleManager(nlp_rules=[nlp1, nlp2, nlp_match, nlp4], nlp_batch_size=2)
    request = {
        "request_id": "REQ_BATCH_2",
        "user_text_description": "áo bị rách"
    }

    result = manager.process_request(request)
    # Should evaluate first batch (nlp1, nlp2) -> NONE
    # Should evaluate second batch (nlp_match, nlp4) -> matches NLP_MATCH
    assert result["rule_id"] == "NLP_MATCH"
    assert result["mode"] == RuleMode.SEMI_AUTO.value
    assert result["status"] == RuleStatus.PENDING_PROCESSING.value
    assert mock_get_llm.call_count == 2


@patch("agentic_ai.llm.llm_factory.get_default_llm")
def test_rule_manager_nlp_batch_evaluation_exception_safety(mock_get_llm) -> None:
    # LLM raises an exception
    mock_get_llm.side_effect = Exception("LLM connection error")

    nlp1 = NLPBased("NLP1", "Rule 1", "Condition 1", RuleAction(ActionType.REFUND_IMMEDIATELY, RuleMode.AUTO))
    manager = RuleManager(nlp_rules=[nlp1], nlp_batch_size=10)

    request = {
        "request_id": "REQ_BATCH_3",
        "user_text_description": "áo bị rách"
    }

    result = manager.process_request(request)
    assert result["rule_id"] is None
    assert result["mode"] == RuleMode.MANUAL.value
    assert result["status"] == RuleStatus.PENDING_PROCESSING.value


def test_api_experiment_endpoint() -> None:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from agentic_ai.services.smart_return.router import router

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    payload = {
        "rules": [
            {
                "rule_id": "EXP_RULE_1",
                "name": "Exp Rule 1",
                "type": "RuleBased",
                "active": True,
                "condition": {"field": "days_since_delivery", "operator": "less_than_or_equal", "value": 7},
                "action": {
                    "action_type": "REFUND_IMMEDIATELY",
                    "mode": "AUTO"
                }
            }
        ],
        "scenarios": [
            {
                "scenario_name": "Exp Scenario 1",
                "request": {
                    "request_id": "REQ_EXP_1",
                    "days_since_delivery": 5,
                    "category": "Shoes",
                    "item_value": 100.0,
                    "user_text_description": None
                },
                "expected_result": {
                    "mode": "AUTO",
                    "status": "APPROVED",
                    "action": "REFUND_IMMEDIATELY",
                    "rule_id": "EXP_RULE_1"
                }
            }
        ]
    }

    response = client.post("/api/smart-return/experiment", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert len(res_data["results"]) == 1
    assert res_data["results"][0]["scenario_name"] == "Exp Scenario 1"
    assert res_data["results"][0]["status"] == "PASS"
    assert res_data["results"][0]["actual_result"]["rule_id"] == "EXP_RULE_1"


