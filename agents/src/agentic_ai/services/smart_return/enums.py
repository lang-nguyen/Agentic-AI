from enum import StrEnum


class RuleField(StrEnum):
    """Enums for fields that rules can evaluate."""

    DAYS_SINCE_DELIVERY = "days_since_delivery"
    CATEGORY = "category"
    ITEM_VALUE = "item_value"


class LogicalOperator(StrEnum):
    """Enums for logical operators in nested rule groups."""

    AND = "AND"
    OR = "OR"
    NOT = "NOT"


class ComparisonOperator(StrEnum):
    """Enums for comparison operators in individual rules."""

    IS = "is"
    EQUAL = "equal"
    EQUALS = "equals"
    NOT_EQUAL = "not_equal"
    GREATER_THAN = "greater_than"
    GREATER_THAN_OR_EQUAL = "greater_than_or_equal"
    LESS_THAN = "less_than"
    LESS_THAN_OR_EQUAL = "less_than_or_equal"
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"



class RuleMode(StrEnum):
    """Enums for processing modes."""

    AUTO = "AUTO"
    SEMI_AUTO = "SEMI-AUTO"
    MANUAL = "MANUAL"


class RuleStatus(StrEnum):
    """Enums for return request processing status."""

    PENDING_PROCESSING = "PENDING_PROCESSING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
