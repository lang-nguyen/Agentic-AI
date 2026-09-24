# Copyright Sierra

from typing import Any, Dict, List

from pydantic import BaseModel


class Action(BaseModel):
    name: str
    kwargs: Dict[str, Any]


class Task(BaseModel):
    user_id: str
    annotator: str | None = None
    actions: List[Action]
    instruction: str
    outputs: List[str]


class EvaluatorConfig(BaseModel):
    # agent
    agent_strategy: str
    model_provider: str = "groq"
    model: str = "qwen/qwen3-32b"
    temperature: float = 0.0
    # user
    user_strategy: str = "human"
    user_model_provider: str = "google_genai"
    user_model: str = "gemini-3.1-flash-lite-preview"
    # tasks
    task_split: str = "test"
    start_index: int = 0
    end_index: int = 1
    task_indexes: List[int] | None = None
    # run
    num_trials: int = 1
    max_concurrency: int = 1
    max_num_steps: int = 10
    # checkpoint
    log_dir: str = "results"


class EvaluateResult(BaseModel):
    task_index: int
    predicted: List[Dict[str, Any]]
    expected: List[Dict[str, Any]]
    steps: List[Dict[str, Any]]
    messages: List[Dict[str, Any]]
