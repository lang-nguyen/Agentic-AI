from typing import Annotated, Literal, Sequence, TypedDict
from dataclasses import dataclass, field
from langchain_core.messages import BaseMessage
from langgraph.graph import add_messages
from agentic_ai.prompts import TAUBENCH_WIKI, GUARDIAN_PROMPT, REACT_PROMPT, CUSTOMER_SUPPORT_PROMPT, AUTONOMOUS_RETURN_INSTRUCTION, AUTONOMOUS_RETURN_POLICY
from agentic_ai.model import ExtraState

@dataclass
class Configuration():
    guardian_prompt: str = field(
        default=GUARDIAN_PROMPT,
        metadata={
            "json_schema_extra": {
                "langgraph_nodes": ["guardian"],
                "langgraph_type": "prompt",
            }
        },
    )
    
    customer_support_prompt: str = field(
        default=(
            "<instruction>\n"
            "You need to act as an agent that use the above tools to help the user according to the policy. Respond in short and concise way like a real customer service agent. Never response table format.\n"
            "</instruction>\n"
            f"<policy>\n{CUSTOMER_SUPPORT_PROMPT}\n</policy>\n"
        ),
        metadata={
            "json_schema_extra": {
                "langgraph_nodes": ["agent"],
                "langgraph_type": "prompt",
            }
        },
    )

    autonomous_return_prompt: str = field(
        default=(
            "<instruction>\n"
            f"{AUTONOMOUS_RETURN_INSTRUCTION}\n"
            "</instruction>\n"
            f"<policy>\n{AUTONOMOUS_RETURN_POLICY}\n</policy>\n"
        ),
        metadata={
            "json_schema_extra": {
                "langgraph_nodes": ["autonomous_return_agent"],
                "langgraph_type": "prompt",
            }
        },
    )

    reasoning: bool = field(
        default=True,
        metadata={
            "json_schema_extra": {
                "langgraph_nodes": ["agent"],
            }
        },
    )


class State(TypedDict):
    """State container for ReAct agent message history."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    extra: ExtraState | None
