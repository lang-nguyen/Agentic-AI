from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal, Any

class ExtraState(BaseModel):
    tools: list[str] = Field(default_factory=list)
    assignee: Literal["agent", "human"] = Field(default="agent")
    staff_thread_id: str | None = None
    customer_thread_id: str | None = None
    fork_checkpoint_id: str | None = None
    staff_joined: bool | None = False
    active: bool = True
    artifact: dict[str, Any] = Field(default_factory=dict)
    events: list[dict[str, Any]] = Field(default_factory=list)

    @classmethod
    def from_state(cls, state_val: Any) -> ExtraState:
        if state_val is None:
            return cls()
        if isinstance(state_val, dict):
            return cls.model_validate(state_val)
        return state_val

    def push_event(self, event_type: str, key: str, value: Any) -> ExtraState:
        new_events = list(self.events or [])
        new_events.append({
            "type": event_type,
            "key": key,
            "value": value
        })
        return self.model_copy(update={"events": new_events})

    def clear_events(self) -> ExtraState:
        return self.model_copy(update={"events": []})

    def update_artifact(self, key: str, value: Any) -> ExtraState:
        artifacts = {**(self.artifact or {})}
        artifacts[key] = value
        return self.push_event("new_artifact", key, value).model_copy(update={"artifact": artifacts})

    def escalate(self, customer_thread_id: str) -> ExtraState:
        return self.model_copy(update={
            "assignee": "human",
            "customer_thread_id": customer_thread_id
        })
