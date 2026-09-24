"""Rule manager implementation for Smart Return processing."""

from typing import List

from agentic_ai.services.smart_return.enums import RuleMode, RuleStatus
from agentic_ai.services.smart_return.rule import NLPBased, RuleBased


class RuleManager:
    """Manager to chain rule execution according to precedence logic."""

    def __init__(self, rule_based_rules: List[RuleBased] | None = None, nlp_rules: List[NLPBased] | None = None, nlp_batch_size: int = 10) -> None:
        """Initialize RuleManager with optional rule sets and batch size."""
        self.rule_based_rules = rule_based_rules or []
        self.nlp_rules = nlp_rules or []
        self.nlp_batch_size = nlp_batch_size

    def add_rule_based_rule(self, rule: RuleBased) -> None:
        """Add a rule-based rule."""
        self.rule_based_rules.append(rule)

    def add_nlp_rule(self, rule: NLPBased) -> None:
        """Add an NLP-based rule."""
        self.nlp_rules.append(rule)

    def _evaluate_nlp_rules_batched(self, request: dict, batch: List[NLPBased]) -> NLPBased | None:
        """Evaluate a batch of active NLP rules in a single LLM call."""
        if not batch:
            return None

        user_text = (request.get("user_text_description") or "").strip().lower()
        if not user_text:
            return None

        # Build list of options for the prompt
        options_text = ""
        for rule in batch:
            options_text += f"- Rule ID: {rule.rule_id}\n  Condition: {rule.condition}\n"

        try:
            from langchain_core.messages import HumanMessage, SystemMessage

            from agentic_ai.llm.llm_factory import get_default_llm

            llm = get_default_llm()
            system_instruction = (
                "You are an AI assistant helping a store automate customer return checks.\n"
                "Determine which of the store policy conditions the customer's description matches.\n"
                "Respond with ONLY the exact matching Rule ID. If none of the conditions match, respond with 'NONE'. Do not explain."
            )
            user_content = (
                f"Customer Description: {user_text}\n\n"
                f"Store Policy Conditions:\n{options_text}\n"
                "Which Rule ID does the customer's description match? (Respond with the Rule ID or 'NONE')"
            )

            messages = [
                SystemMessage(content=system_instruction),
                HumanMessage(content=user_content),
            ]
            response = llm.invoke(messages)
            response_text = str(response.content).strip().upper()

            # Find matching rule in the batch
            for rule in batch:
                if response_text == rule.rule_id.upper():
                    return rule

            return None
        except Exception:
            # safe default, fail-safe fallback
            return None

    def process_request(self, request: dict) -> dict:
        for rb_rule in self.rule_based_rules:
            if not rb_rule.active:
                continue
            if rb_rule.is_match(request):
                return rb_rule.handle_action(request)

        active_nlp_rules = [rule for rule in self.nlp_rules if rule.active]
        for i in range(0, len(active_nlp_rules), self.nlp_batch_size):
            batch = active_nlp_rules[i:i + self.nlp_batch_size]
            matched_rule = self._evaluate_nlp_rules_batched(request, batch)
            if matched_rule:
                return matched_rule.handle_action(request)

        # No match found -> MANUAL_REVIEW
        return {
            "request_id": request.get("request_id"),
            "rule_id": None,
            "mode": RuleMode.MANUAL.value,
            "status": RuleStatus.PENDING_PROCESSING.value,
            "message_to_customer": "No matching policy found. Routed to manual support review.",
        }
