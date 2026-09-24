from __future__ import annotations

import abc
import enum

from hashlib import sha256
from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Tuple, Optional, Callable, Set, Union

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import StructuredTool
from langchain_ollama import ChatOllama

from agentic_ai.llm.llm_factory import get_default_llm

RESPOND_ACTION_NAME = "respond"
RESPOND_ACTION_FIELD_NAME = "content"
 
ToHashable = Union[
    str, int, float, Dict[str, "ToHashable"], List["ToHashable"], Set["ToHashable"]
]
Hashable = Union[str, int, float, Tuple["Hashable"], Tuple[Tuple[str, "Hashable"]]]

default_user_model = get_default_llm()

def to_hashable(item: ToHashable) -> Hashable:
    if isinstance(item, dict):
        return tuple((key, to_hashable(value)) for key, value in sorted(item.items()))
    elif isinstance(item, list):
        return tuple(to_hashable(element) for element in item)
    elif isinstance(item, set):
        return tuple(sorted(to_hashable(element) for element in item))
    else:
        return item

def consistent_hash(
    value: Hashable,
) -> str:
    return sha256(str(value).encode("utf-8")).hexdigest()

def load_user(user_strategy: Union[str, UserStrategy]):
    if isinstance(user_strategy, str):
        user_strategy = UserStrategy(user_strategy)
    if user_strategy == UserStrategy.HUMAN:
        return HumanUserSimulationEnv()
    elif user_strategy == UserStrategy.LLM:
        return LLMUserSimulationEnv(model=default_user_model)
    elif user_strategy == UserStrategy.LLM_WITH_PROMPT:
        return LLMWithPromptUserSimulationEnv(model=default_user_model)
    else:
        raise NotImplementedError()  

class DoneReason(enum.StrEnum):
    STOP = "stop"
    MAX_STEPS_REACHED = "max_step_reached"
    ERROR = "error"

class Action(BaseModel):
    name: str
    kwargs: Dict[str, Any]
    
    def __eq__(self, other: Action):
        return self.name == other.name and self.kwargs == other.kwargs

class SolveResult(BaseModel):
    reward: float
    done_reason: DoneReason
    info: Dict[str, Any]
    total_cost: Optional[float] = None
    messages: List[Dict[str, Any]]
    errors: Optional[list[str]] = None
    model_config = ConfigDict(extra="allow")

class Task(BaseModel):
    user_id: str
    actions: List[Action]
    instruction: str
    outputs: List[str]
    model_config = ConfigDict(extra="allow")

class ActionCorrectness(BaseModel):
    correct: list[Action]
    wrong: list[Action]
    miss: list[Action]
    extra: list[Action]
    
    @classmethod
    def stat(cls, ground_truth: list[Action], expected: list[Action]):
        correct = []
        wrong = []
        miss = []
        extra = []

        # correct + miss
        for gt in ground_truth:
            if gt in expected:
                correct.append(gt)
            else:
                miss.append(gt)

        # wrong + extra
        for e in expected:
            if e.name in [gt.name for gt in ground_truth]:
                if e not in ground_truth:
                    wrong.append(e)
            else:
                extra.append(e)

        return cls(correct=correct, wrong=wrong, miss=miss, extra=extra)
    
class RewardInfo(BaseModel):
    reward: float
    r_actions: float
    r_outputs: float
    gt_data_hash: str
    outputs: Dict[str, bool]
    correctness: ActionCorrectness | None = None

class RewardResult(BaseModel):
    reward: float
    info: RewardInfo
    actions: List[Action]

class EnvInfo(BaseModel):
    task: Task
    source: Optional[str] = None
    user_cost: Optional[float] = None
    reward_info: Optional[RewardResult] = None

class EnvResponse(BaseModel):
    observation: str
    reward: float
    done: bool
    info: EnvInfo
    
class UserStrategy(enum.Enum):
    HUMAN = "human"
    LLM = "llm"
    LLM_WITH_PROMPT = "llm_with_prompt"

class BaseUserSimulationEnv(abc.ABC):
    metadata = {}

    @abc.abstractmethod
    def reset(self, task: Optional[Task] = None) -> str:
        raise NotImplementedError

    @abc.abstractmethod
    def step(self, content: str) -> str:
        raise NotImplementedError

    @abc.abstractmethod
    def get_total_cost(self) -> float:
        raise NotImplementedError

class HumanUserSimulationEnv(BaseUserSimulationEnv):
    def reset(self, task: Task) -> str:
        return input(f"{task.instruction}\n")

    def step(self, content: str) -> str:
        return input(f"{content}\n")

    def get_total_cost(self) -> float:
        return 0

class LLMUserSimulationEnv(BaseUserSimulationEnv):
    def __init__(self, model: BaseChatModel) -> None:
        super().__init__()
        self.messages: List[Dict[str, Any]] = []
        self.model = model
        self.total_cost = 0.0

    def generate_next_message(self, messages: List[Dict[str, Any]]) -> str:
        ai_msg = self.model.invoke(messages)
        self.messages.append(ai_msg.model_dump())
        self.total_cost = ai_msg.usage_metadata["total_tokens"]
        return ai_msg.content

    def build_system_prompt(self, instruction: Optional[str]) -> str:
        instruction_display = (
            ("\n\nInstruction: " + instruction + "\n")
            if instruction is not None
            else ""
        )
        return f"""   
You are simulating a real human user in a conversation with an AI agent.
Instruction: 
{instruction_display}
Rules:
- You are ONLY a user, not an assistant.
- Just generate one line at a time to simulate the user's message.
- Do not give away all the instruction at once. Only provide the information that is necessary for the current step.
- Do not hallucinate information that is not provided in the instruction. For example, if the agent asks for the order id but it is not mentioned in the instruction, do not make up an order id, just say you do not remember or have it.
- If the instruction goal is satisified, generate '###STOP###' as a standalone message without anything else to end the conversation.
- Do not repeat the exact instruction in the conversation. Instead, use your own words to convey the same information.
- Try to make the conversation as natural as possible, and stick to the personalities in the instruction.
- Never create fake IDs, names, numbers, or any data not given in the instruction.
- Keep the conversation natural and consistent with the given personality.
- Respond like a real human in a casual conversation.
- Keep responses short and concise (prefer 1 sentence or less).
"""

    def reset(self, task: Optional[Task] = None) -> str:
        self.messages = [
            {
                "role": "system",
                "content": self.build_system_prompt(instruction=task.instruction),
            },
            {"role": "user", "content": "Hi! How can I help you today?"},
        ]
        return self.generate_next_message(self.messages)

    def step(self, content: str) -> str:
        self.messages.append(
            {"role": "user", "content": content + "\nNow simulate a user response."}
        )
        return self.generate_next_message(self.messages)

    def get_total_cost(self) -> float:
        return self.total_cost

class LLMWithPromptUserSimulationEnv(LLMUserSimulationEnv):
    def reset(self, task = None):
        self.messages = [
            {
                "role": "system",
                "content": self.build_system_prompt(instruction=task.instruction),
            },
            {"role": "user", "content": "Hi! How can I help you today?"},
        ]
        return task.prompt # extra

class Env(object):
    
    def __init__(self, task: Task, user_strategy: str, tools: list[StructuredTool], data_load_func: Callable, data: dict):
        self.agent_actions: List[Action] = []
        self.task_actions: List[Action] = []
        self.task = task
        self.user = load_user(user_strategy)
        self.tools = tools
        self.tools_map: Dict[str, StructuredTool] = {
            tool.name: tool for tool in tools
        }
        self.data_load_func = data_load_func
        self.data = data
        self.terminate_tools = []
    
    def reset(self) -> EnvResponse:
        initial_observation = self.user.reset(task=self.task)
        return EnvResponse(
            observation=initial_observation, info=EnvInfo(task=self.task, source="user"), reward=0, done=False
        )

    def step(self, action: Action) -> EnvResponse:
        info = EnvInfo(task=self.task)
        reward = 0
        done = False
        if action.name == RESPOND_ACTION_NAME:
            tool_result = self.user.step(f"{action.kwargs['content']}")
            info.source = "user"
            done = "###STOP###" in tool_result
        elif action.name in self.tools_map:
            try:
                tool_result = self.tools_map[action.name].invoke(
                    {"data": self.data, **action.kwargs}
                )
            except Exception as e:
                tool_result = f"Error: {e}"
            info.source = action.name
            if action.name in self.terminate_tools:
                done = True
        else:
            tool_result = f"Unknown action {action.name}"
            info.source = action.name

        if done:
            reward_res = self.calculate_reward()
            reward = reward_res.reward
            info.reward_info = reward_res
            info.user_cost = self.user.get_total_cost()
        return EnvResponse(observation=tool_result, reward=reward, done=done, info=info)

    def get_data_hash(self) -> str:
        return consistent_hash(to_hashable(self.data))

    def calculate_reward(self) -> RewardResult:
        data_hash = self.get_data_hash()

        # Check if the database changes are correct. If they are not correct, then we set the reward to 0.
        # TODO: cache gt_data_hash in tasks.py (low priority)
        self.data = self.data_load_func()
        for action in self.task.actions:
            if action.name not in self.terminate_tools:
                _ = self.step(action)
                self.task_actions.append(action) # ground truth actions
        gt_data_hash = self.get_data_hash()
        
        outputs = {}
        if len(self.task.outputs) > 0:
            # check outputs
            for output in self.task.outputs:
                found = False
                for action in self.agent_actions:
                    if (
                        action.name == RESPOND_ACTION_NAME
                        and output.lower()
                        in action.kwargs["content"].lower().replace(",", "")
                    ):
                        found = True
                        break
                outputs[output] = found
            
        r_actions = float(data_hash == gt_data_hash)
        r_outputs = float(all(outputs.values()))
            
        correctness = ActionCorrectness.stat(
            ground_truth=self.task_actions,
            expected=self.agent_actions
        )
        
        # https://drive.google.com/file/d/1_4NG37AdHyParjiUyYugjzPN-85pcfzl/edit?disco=AAAB_3HW71w
        reward = r_actions * r_outputs 
        
        info = RewardInfo(
            r_actions=r_actions,
            r_outputs=r_outputs,
            reward=reward,
            gt_data_hash=gt_data_hash,
            outputs=outputs,
            correctness=correctness
        )
        
        return RewardResult(reward=reward, info=info, actions=self.agent_actions)
