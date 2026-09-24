"""Module Prompts."""

from .taubench import WIKI as TAUBENCH_WIKI
from .guardian_prompt import GUARDIAN_PROMPT
from .react_prompt import REACT_PROMPT
from .customer_support_prompt import CUSTOMER_SUPPORT_PROMPT
from .autonomous_return_prompt import AUTONOMOUS_RETURN_INSTRUCTION, AUTONOMOUS_RETURN_POLICY

__all__ = ["GUARDIAN_PROMPT", "TAUBENCH_WIKI", "CUSTOMER_SUPPORT_PROMPT", "AUTONOMOUS_RETURN_INSTRUCTION", "AUTONOMOUS_RETURN_POLICY"]
