from enum import StrEnum


class ActionType(StrEnum):
    """Enums for actions that rules can trigger."""

    REFUND_IMMEDIATELY = "REFUND_IMMEDIATELY" # Hoàn tiền ngay (không trả hàng)
    REFUND_AND_RETURN = "REFUND_AND_RETURN" # Hoàn tiền và trả hàng
    PARTIAL_REFUND = "PARTIAL_REFUND" # Hoàn tiền một phần (không trả hàng)
    REJECT_REFUND = "REJECT_REFUND" # Từ chối hoàn tiền
    WAIT_FOR_APPROVAL = "WAIT_FOR_APPROVAL" # Chờ duyệt thủ công


class RuleAction:
    """Class to handle action logic in rules."""

    def __init__(self, action_type: ActionType, mode: str) -> None:
        """Initialize RuleAction with an ActionType and a RuleMode."""
        from agentic_ai.services.smart_return.enums import RuleMode

        if not isinstance(action_type, ActionType):
            raise TypeError("action_type must be a valid ActionType Enum.")
        
        # Resolve mode from string or Enum
        try:
            resolved_mode = RuleMode(mode)
        except ValueError:
            raise TypeError(f"mode must be a valid RuleMode Enum or string value: {[e.value for e in RuleMode]}")

        self.action_type = action_type
        self.mode = resolved_mode

    def execute(self, request: dict) -> dict:
        """Execute the action logic based on configured mode and action type."""
        from agentic_ai.services.smart_return.enums import RuleMode, RuleStatus

        request_id = request.get("request_id")

        if self.mode == RuleMode.AUTO:
            status = (
                RuleStatus.APPROVED.value
                if self.action_type != ActionType.REJECT_REFUND
                else RuleStatus.REJECTED.value
            )
            return {
                "request_id": request_id,
                "mode": RuleMode.AUTO.value,
                "status": status,
                "action": self.action_type.value,
                "message_to_customer": f"System executed: {self.action_type.value}",
            }
        elif self.mode == RuleMode.SEMI_AUTO:
            return {
                "request_id": request_id,
                "mode": RuleMode.SEMI_AUTO.value,
                "status": RuleStatus.PENDING_PROCESSING.value,
                "action": ActionType.WAIT_FOR_APPROVAL.value,
            }
        else:
            # Manual fallback
            return {
                "request_id": request_id,
                "mode": RuleMode.MANUAL.value,
                "status": RuleStatus.PENDING_PROCESSING.value,
                "action": "MANUAL_REVIEW",
                "message_to_customer": "No matching policy found. Routed to manual support review.",
            }
