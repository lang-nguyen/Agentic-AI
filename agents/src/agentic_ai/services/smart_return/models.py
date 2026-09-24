"""Pydantic schema models for Smart Return request validation and responses."""

from typing import Any

from pydantic import BaseModel, Field

from agentic_ai.services.smart_return.enums import RuleMode, RuleStatus
from agentic_ai.services.smart_return.rule_action import ActionType


class ReturnRequest(BaseModel):
    """Schema for customer-submitted return request payload."""

    request_id: str = Field(..., description="Unique return request identifier")
    days_since_delivery: int = Field(..., ge=0, description="Days elapsed since the product was delivered")
    category: str = Field(..., description="Product category name")
    item_value: float = Field(..., ge=0.0, description="Price/value of the return item")
    user_text_description: str | None = Field(default=None, description="Free-text customer description of the return reason")
    callback_url: str | None = Field(default=None, description="Webhook callback URL for asynchronous evaluation results")


class ReturnEvaluationResult(BaseModel):
    """Schema for the rule engine evaluation response."""

    request_id: str = Field(..., description="Unique return request identifier")
    rule_id: str | None = Field(default=None, description="ID of the matched rule, or None if no rules matched")
    mode: RuleMode = Field(..., description="System processing mode (AUTO, SEMI-AUTO, MANUAL)")
    status: RuleStatus = Field(..., description="Evaluation status outcome")
    action: ActionType | str | None = Field(default=None, description="Triggered action outcome, or manual review reason")
    ai_summary_for_staff: str | None = Field(default=None, description="AI tóm tắt ngắn cho nhân viên (for SEMI-AUTO)")
    message_to_customer: str | None = Field(default=None, description="Message showing refund details or rejection notice")


class RuleActionSchema(BaseModel):
    """Schema for rule action detail."""

    action_type: ActionType
    mode: RuleMode


class RuleRepresentation(BaseModel):
    """Schema representing a policy rule in the system."""

    rule_id: str
    name: str
    type: str
    active: bool
    condition: Any
    action: RuleActionSchema


class ExpectedEvaluationResult(BaseModel):
    """Schema representing the expected rule engine evaluation result in a test scenario."""

    mode: RuleMode
    status: RuleStatus
    action: ActionType | str | None
    rule_id: str | None


class TestScenarioRepresentation(BaseModel):
    """Schema representing a smart return test scenario."""

    scenario_name: str
    description: str | None = None
    request: ReturnRequest
    expected_result: ExpectedEvaluationResult


class ScenarioExperimentResult(BaseModel):
    """Schema representing the outcome of a single test scenario in an experiment."""

    scenario_name: str
    request: ReturnRequest
    expected_result: ExpectedEvaluationResult
    actual_result: ReturnEvaluationResult
    status: str  # "PASS" or "FAIL"


class ExperimentRequest(BaseModel):
    """Schema for custom experiment input (rules and scenarios)."""

    rules: list[RuleRepresentation]
    scenarios: list[TestScenarioRepresentation]


class ExperimentResponse(BaseModel):
    """Schema for custom experiment evaluation output."""

    results: list[ScenarioExperimentResult]

