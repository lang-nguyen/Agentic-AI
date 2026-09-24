import abc
import enum
from typing import Any, Dict, List, Union

from langchain.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from agentic_ai.prompts.rules import USER_RULES


class UserStrategy(enum.Enum):
    HUMAN = "human"
    LLM = "llm"


class BaseUserSimulationEnv(abc.ABC):
    metadata = {}

    @abc.abstractmethod
    def reset(self, instruction: str | None = None) -> str:
        raise NotImplementedError

    @abc.abstractmethod
    def step(self, content: str) -> str:
        raise NotImplementedError

    @abc.abstractmethod
    def get_total_cost(self) -> float:
        raise NotImplementedError


class HumanUserSimulationEnv(BaseUserSimulationEnv):
    def reset(self, instruction: str) -> str:
        return input(f"\n---\n{instruction}\n---\n")

    def step(self, content: str) -> str:
        return input(f"{content}\n")

    def get_total_cost(self) -> float:
        return 0


class LLMUserSimulationEnv(BaseUserSimulationEnv):
    def __init__(self, llm: BaseChatModel) -> None:
        super().__init__()
        self.messages: List[Dict[str, Any]] = []
        self.llm = llm
        self.reset()

    def reset(self, instruction: str | None = None) -> str:
        self.messages = [
            SystemMessage(self._build_system_prompt(instruction=instruction)),
            HumanMessage("Hi! How can I help you today?"),
        ]
        return self._generate_next_message(self.messages)

    def step(self, content: str) -> str:
        self.messages.append({"role": "user", "content": content})
        return self._generate_next_message(self.messages)

    def get_total_cost(self) -> float:
        return 0

    def _generate_next_message(self, messages: List[BaseMessage]) -> str:
        message = self.llm.invoke(messages)
        self.messages.append(message)
        return message.content

    def _build_system_prompt(self, instruction: str | None) -> str:
        instruction_display = (
            ("\n\nInstruction: " + instruction + "\n")
            if instruction is not None
            else ""
        )
        return (
            f"""You are a user interacting with an agent.{instruction_display}\nRules:"""
            + "\n- ".join(USER_RULES)
        )


def load_user(
    user_strategy: Union[str, UserStrategy],
    model: str | None = "gpt-4o",
    provider: str | None = None,
) -> BaseUserSimulationEnv:
    if isinstance(user_strategy, str):
        user_strategy = UserStrategy(user_strategy)
    if user_strategy == UserStrategy.HUMAN:
        return HumanUserSimulationEnv()
    elif user_strategy == UserStrategy.LLM:
        if model is None:
            raise ValueError("LLM user strategy requires a model")
        if provider is None:
            raise ValueError("LLM user strategy requires a model provider")
        return LLMUserSimulationEnv(llm=model, provider=provider)
    raise ValueError(f"Unknown user strategy {user_strategy}")
