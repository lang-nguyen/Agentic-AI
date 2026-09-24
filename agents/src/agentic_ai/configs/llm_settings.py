"""Environment-backed settings for LLM configuration."""

import os

from dotenv import load_dotenv

load_dotenv()

LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen3.5:0.8b")
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")
LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", 1))
