from dataclasses import dataclass
from typing import Any

@dataclass
class User:
    user_id: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    zip: str | None = None
    email: str | None = None
    issue: str | None = None