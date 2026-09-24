"""Utilities for loading TauBench dataset files."""

from __future__ import annotations
import json
import asyncio
from typing import Any
from contextvars import ContextVar, Token
from contextlib import asynccontextmanager
from agentic_ai.configs.project_paths import ROOT

dir = ROOT / "benchmarks" / "taubench" / "data"

def load_taubench_data() -> dict[str, Any]:
    """Load orders, products, and users from TauBench data files."""
    with open(dir / "orders.json", encoding="utf-8") as f:
        orders = json.load(f)
    with open(dir / "products.json", encoding="utf-8") as f:
        products = json.load(f)
    with open(dir / "users.json", encoding="utf-8") as f:
        users = json.load(f)

    return {"orders": orders, "products": products, "users": users}


current_session: ContextVar[TaubenchSession] = ContextVar("current_session")

def load_data_from_session() -> dict[str, Any]:
    return TaubenchConnection.get_session().data

class TaubenchSession:

    def __init__(self):
        self.data = load_taubench_data()    

class TaubenchConnection:
    
    @staticmethod
    def get_session() -> TaubenchSession:
        try:
            return current_session.get()
        except LookupError:
            raise RuntimeError("No active session")
    
    @staticmethod
    @asynccontextmanager
    async def async_session():
        session = await asyncio.to_thread(
            TaubenchSession
        )
        
        # set context
        token = current_session.set(session)
        try:
            yield session
        finally:
            current_session.reset(token)