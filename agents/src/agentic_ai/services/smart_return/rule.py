"""Rule engine implementation for Smart Return processing."""

from agentic_ai.llm.llm_factory import get_default_llm
from abc import ABC, abstractmethod
from typing import Any

from agentic_ai.services.smart_return.enums import (
    ComparisonOperator,
    LogicalOperator,
    RuleField,
)
from agentic_ai.services.smart_return.rule_action import RuleAction


class Rule(ABC):
    """Abstract base class for all rules."""

    def __init__(self, rule_id: str, name: str, condition: Any, action: RuleAction, active: bool = True) -> None:
        """Initialize the rule with basic attributes."""
        if not isinstance(action, RuleAction):
            raise TypeError("action must be an instance of RuleAction.")
        self.rule_id = rule_id
        self.name = name
        self.condition = condition
        self.action = action
        self.active = active

    @abstractmethod
    def is_match(self, request: dict) -> bool:
        """Return True if the request meets the condition, otherwise False."""
        pass

    @abstractmethod
    def run_action(self, request: dict) -> dict:
        """Execute the action and return the output JSON."""
        pass

    def handle_action(self, request: dict) -> dict:
        """Wrap run_action to execute the action, aligning sequence diagram with class diagram."""
        return self.run_action(request)


class RuleBased(Rule):
    """Rule subclass for hard-coded business logic/math-based checks."""

    def __init__(self, rule_id: str, name: str, condition: dict, action: RuleAction, active: bool = True) -> None:
        """Initialize rule-based rule with a dictionary condition."""
        if not isinstance(condition, dict):
            raise TypeError("RuleBased condition must be a dictionary.")
        super().__init__(rule_id, name, condition, action, active)

    def is_match(self, request: dict) -> bool:
        """Evaluate if the request meets the mathematical/logical condition."""
        return self._evaluate_condition(self.condition, request)

    def run_action(self, request: dict) -> dict:
        """Execute rule-based action, returning AUTO decision."""
        res = self.action.execute(request)
        res["rule_id"] = self.rule_id
        return res

    def _evaluate_rule(self, field: str, op: str, expected: Any, request: dict) -> bool:
        """Evaluate a single rule operator against the request value."""
        if field not in request:
            return False
        val = request[field]

        # Automatic type coercion for numeric comparisons
        if isinstance(expected, (int, float)) and not isinstance(val, (int, float)):
            try:
                val = float(val) if isinstance(expected, float) else int(val)
            except (ValueError, TypeError):
                pass

        norm_op = str(op).strip().lower().replace(" ", "_")
        try:
            comp_op = ComparisonOperator(norm_op)
        except ValueError:
            raise ValueError(
                f"Invalid operator '{op}': RuleBased operators must be a valid ComparisonOperator "
                f"(e.g., {[e.value for e in ComparisonOperator]})."
            )

        if comp_op in (ComparisonOperator.IS, ComparisonOperator.EQUAL, ComparisonOperator.EQUALS):
            return val == expected
        elif comp_op == ComparisonOperator.NOT_EQUAL:
            return val != expected
        elif comp_op == ComparisonOperator.GREATER_THAN:
            return val > expected
        elif comp_op == ComparisonOperator.GREATER_THAN_OR_EQUAL:
            return val >= expected
        elif comp_op == ComparisonOperator.LESS_THAN:
            return val < expected
        elif comp_op == ComparisonOperator.LESS_THAN_OR_EQUAL:
            return val <= expected
        elif comp_op == ComparisonOperator.IN:
            return val in expected if isinstance(expected, (list, tuple, set, str)) else False
        elif comp_op == ComparisonOperator.NOT_IN:
            return val not in expected if isinstance(expected, (list, tuple, set, str)) else False
        elif comp_op == ComparisonOperator.CONTAINS:
            return expected in val if isinstance(val, (list, tuple, set, str)) else False
        elif comp_op == ComparisonOperator.NOT_CONTAINS:
            return expected not in val if isinstance(val, (list, tuple, set, str)) else False
        return False

    def _evaluate_condition(self, condition: Any, request: dict) -> bool:
        """Recursively evaluate conditional structure (dict, etc.)."""
        if not condition:
            return True

        if not isinstance(condition, dict):
            raise TypeError("RuleBased condition must be a dictionary.")

        # Case 1: Structured JSON condition: {"operator": "AND", "rules": [...]}
        if "operator" in condition and "rules" in condition:
            op_str = str(condition["operator"]).strip().upper()
            try:
                log_op = LogicalOperator(op_str)
            except ValueError:
                raise ValueError(
                    f"Invalid logical operator '{condition['operator']}': must be one of "
                    f"{[e.value for e in LogicalOperator]}."
                )

            rules = condition["rules"]
            if log_op == LogicalOperator.AND:
                return all(self._evaluate_condition(r, request) for r in rules)
            elif log_op == LogicalOperator.OR:
                return any(self._evaluate_condition(r, request) for r in rules)
            elif log_op == LogicalOperator.NOT:
                if isinstance(rules, list):
                    return not any(self._evaluate_condition(r, request) for r in rules)
                return not self._evaluate_condition(rules, request)
            return False

        # Case 2: Individual rule dict e.g. {"field": "category", "operator": "==", "value": "T-shirt"}
        if "field" in condition and "operator" in condition and "value" in condition:
            return self._evaluate_rule(condition["field"], condition["operator"], condition["value"], request)

        # Case 3: Simple key-value dict: {"days_since_delivery": 7}
        results = []
        for key, expected_value in condition.items():
            val = request.get(key)
            if key == RuleField.DAYS_SINCE_DELIVERY.value:
                try:
                    val_num = float(val) if val is not None else 0.0
                except (ValueError, TypeError):
                    val_num = 0.0
                results.append(val_num > float(expected_value))
            else:
                results.append(val == expected_value)
        return all(results) if results else False


class NLPBased(Rule):
    """Rule subclass using LLM/NLP semantic evaluation."""

    def __init__(self, rule_id: str, name: str, condition: str, action: RuleAction, active: bool = True) -> None:
        """Initialize NLP-based rule with a text description condition."""
        if not isinstance(condition, str):
            raise TypeError("NLPBased condition must be a string text description.")
        super().__init__(rule_id, name, condition, action, active)

    def is_match(self, request: dict) -> bool:
        """Check if request's user_text_description matches the policy description."""
        user_text = (request.get("user_text_description") or "").strip().lower()
        if not user_text:
            return False

        condition_text = self.condition

        # LLM Invoke (LangChain)
        try:
            from langchain_core.messages import HumanMessage, SystemMessage

            from agentic_ai.llm.llm_factory import get_default_llm

            llm = get_default_llm()
            system_instruction = (
                "You are an AI assistant helping a store automate customer return checks.\n"
                "Determine if the customer's description of the issue matches the condition text.\n"
                "Respond with ONLY 1 word 'True' or 'False'. Do not explain."
            )
            user_content = (
                f"Condition Text: {condition_text}\n"
                f"Customer Description: {user_text}\n"
                "Does the customer's description match the condition text? True or False?"
            )

            messages = [
                SystemMessage(content=system_instruction),
                HumanMessage(content=user_content),
            ]
            response = llm.invoke(messages)
            response_text = str(response.content).strip().lower()
            return "true" in response_text
        except Exception:
            # safe default, do not approve
            return False

    def run_action(self, request: dict) -> dict:
        """Execute NLP-based action, returning SEMI-AUTO proposal."""
        res = self.action.execute(request)
        res["rule_id"] = self.rule_id
        res["ai_summary_for_staff"] = f"Propose {self.action.action_type.value} because AI matched description."
        return res
