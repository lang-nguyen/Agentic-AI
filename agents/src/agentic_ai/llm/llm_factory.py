"""Factory functions for initializing LLM instances."""
import os
from functools import lru_cache

from langchain.chat_models import BaseChatModel
from langchain_ollama import ChatOllama

from agentic_ai.configs.llm_settings import LLM_MODEL, LLM_TEMPERATURE


@lru_cache
def get_default_llm() -> BaseChatModel:
    """Return the cached default chat model."""
    return ChatOllama(
        model=LLM_MODEL, 
        temperature=LLM_TEMPERATURE, 
        keep_alive=-1, 
        num_ctx=16 * 1024,
        reasoning=True,
        client_kwargs={
            "headers": {
                "Authorization": os.getenv("OLLAMA_API_KEY","secret")
            }
        },
    )
