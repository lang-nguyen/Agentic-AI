import abc
from typing import Any
from base import (
    Env,
    SolveResult,
    DoneReason,
    Action,
    RESPOND_ACTION_NAME,
    RESPOND_ACTION_FIELD_NAME,
    EnvResponse,
    EnvInfo,
)
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, ToolMessage, messages_to_dict
from langchain_core.messages.tool import ToolCall
from freeform_plan_and_execute_agent import FreeformPlanAndExecuteAgent
from plan_and_execute_agent import PlanAndExecuteAgent
from react_agent import ReActAgent

class BaseRunner(abc.ABC):
    @abc.abstractmethod
    def run(
        self,
        agent: Any,
        env: Env,
        max_num_steps: int = 10,
        verbose: bool = False,
    ) -> SolveResult:
        """Solves the environment with the agent and returns a SolveResult."""
        pass

class ReActRunner(BaseRunner):
    def run(
        self,
        agent: ReActAgent,
        env: Env,
        max_num_steps: int = 10,
        verbose: bool = False,
    ) -> SolveResult:
        errors = []
        messages = []
        done = False
        reward = 0.0
        info = EnvInfo(task=env.task)
        try:
            observation = env.user.reset(task=env.task)
        except Exception as e:
            print("ERROR: ", str(e), flush=True)
            observation = "Hi." # fallback
            
        messages: list[BaseMessage] = [
            AIMessage(content="Hi! how can I help you today?"),
            HumanMessage(content=observation),
        ]
    
        if verbose:
            print("INSTRUCTION:", env.task.instruction, flush=True)
            print(messages[0].pretty_repr(), flush=True)
            print(messages[1].pretty_repr(), flush=True)
        
        for step in range(max_num_steps):
            try:
                if done: break
                agent_state = agent.invoke(
                    {
                        "messages": messages
                    },
                )
                
                agent_actions = []
                output_messages = agent_state["messages"][len(messages):]
                for msg in output_messages:
                    if verbose:
                        print(msg.pretty_repr(), flush=True)
                    if msg.type == "ai" and msg.tool_calls:
                        for tc in msg.tool_calls:
                            agent_actions.append(
                                Action(name=tc["name"], kwargs=tc["args"])
                            )
                    else:
                        agent_actions.append(
                            Action(name=RESPOND_ACTION_NAME, kwargs={RESPOND_ACTION_FIELD_NAME: msg.content})
                        )        

                messages += output_messages
                env.agent_actions += agent_actions

                if agent_actions[-1].name == RESPOND_ACTION_NAME:
                    user_response = env.user.step(agent_actions[-1].kwargs['content'])
                    done = "###STOP###" in user_response
                    messages.append(HumanMessage(user_response))
                    
                    if verbose:
                        print(messages[-1].pretty_repr(), flush=True)
            except Exception as e:
                errors.append(str(e))
                continue
                  
        if done:
            done_reason = DoneReason.STOP
        else:
            done_reason = DoneReason.MAX_STEPS_REACHED
                    
        reward_res = env.calculate_reward()
        reward = reward_res.reward
        info.reward_info = reward_res
        info.user_cost = env.user.get_total_cost() 
        
        return SolveResult(
            messages=messages_to_dict(messages),
            reward=reward,
            info=info.model_dump(),
            done_reason=done_reason,
            errors = errors
        )

class FreeformPlanAndExecuteRunner(BaseRunner):
    def run(
        self,
        agent: FreeformPlanAndExecuteAgent,
        env: Env,
        max_num_steps: int = 10,
        verbose: bool = False,
    ) -> SolveResult:
        errors: list[str] = []
        messages: list[BaseMessage] = []
        done: bool = False
        reward: float = 0.0
        info: EnvInfo = EnvInfo(task=env.task)
        try:
            observation = env.user.reset(task=env.task)
        except Exception as e:
            print("ERROR:", str(e), flush=True)
            observation = "Hi." # fallback
            
        messages = [
            AIMessage(content="Hi, how can I help you today?"),
            HumanMessage(content=observation)
        ]
        
        if verbose:
            print("INSTRUCTION:", env.task.instruction, flush=True)
            print(messages[-2].pretty_repr(), flush=True)
            print(messages[-1].pretty_repr(), flush=True)

        meta_tools = {"write_task_specification", "write_plan", "continue_execution", "read_policy"}
        for step in range(max_num_steps):
            try:
                if done: break
                agent_state = agent.invoke({
                    "messages": messages
                })
                
                agent_actions = []
                output_messages = agent_state["messages"][len(messages):]
                for msg in output_messages:
                    if verbose:
                        print(msg.pretty_repr(), flush=True)
                    if msg.type == "ai" and msg.tool_calls:
                        for tc in msg.tool_calls:
                            if tc["name"] in meta_tools: continue
                            agent_actions.append(
                                Action(name=tc["name"], kwargs=tc["args"])
                            )
                    else:
                        agent_actions.append(
                            Action(name=RESPOND_ACTION_NAME, kwargs={RESPOND_ACTION_FIELD_NAME: msg.content})
                        )
                
                messages += output_messages
                env.agent_actions += agent_actions
                
                if agent_actions and agent_actions[-1].name == RESPOND_ACTION_NAME:
                    user_response = env.user.step(agent_actions[-1].kwargs['content'])
                    done = "###STOP###" in user_response
                    messages.append(HumanMessage(user_response))
                    
                    if verbose:
                        print(messages[-1].pretty_repr(), flush=True)  
                                      
            except Exception as e:
                errors.append(str(e))
                continue
    
        if done:
            done_reason = DoneReason.STOP
        else:
            done_reason = DoneReason.MAX_STEPS_REACHED
            
        reward_res = env.calculate_reward()
        reward = reward_res.reward
        info.reward_info = reward_res
        info.user_cost = env.user.get_total_cost() 
        
        return SolveResult(
            messages=messages_to_dict(messages),
            reward=reward,
            info=info.model_dump(),
            done_reason=done_reason,
            errors = errors
        )

class PlanAndExecuteRunner(BaseRunner):
    def run(
        self,
        agent: PlanAndExecuteAgent,
        env: Env,
        max_num_steps: int = 10,
        verbose: bool = False,
    ) -> SolveResult:
        errors: list[str] = []
        messages: list[BaseMessage] = []
        done: bool = False
        reward: float = 0.0
        info: EnvInfo = EnvInfo(task=env.task)
        try:
            observation = env.user.reset(task=env.task)
        except Exception as e:
            print("ERROR:", str(e), flush=True)
            observation = "Hi." # fallback
            
        messages = [
            AIMessage(content="Hi, how can I help you today?"),
            HumanMessage(content=observation)
        ]
        
        if verbose:
            print("INSTRUCTION:", env.task.instruction, flush=True)
            print(messages[-2].pretty_repr(), flush=True)
            print(messages[-1].pretty_repr(), flush=True)

        meta_tools = {"create_tasks", "update_task"}
        agent_state = {
            "messages": messages
        }
        for step in range(max_num_steps):
            try:
                if done: break
                
                agent_state = agent.invoke(agent_state)
                
                agent_actions = []
                output_messages = agent_state["messages"][len(messages):]
                for msg in output_messages:
                    if verbose:
                        print(msg.pretty_repr(), flush=True)
                    if msg.type == "ai" and msg.tool_calls:
                        for tc in msg.tool_calls:
                            if tc["name"] in meta_tools: continue
                            agent_actions.append(
                                Action(name=tc["name"], kwargs=tc["args"])
                            )
                    elif msg.type == "ai":
                        agent_actions.append(
                            Action(name=RESPOND_ACTION_NAME, kwargs={RESPOND_ACTION_FIELD_NAME: msg.content})
                        )
                
                messages += output_messages
                env.agent_actions += agent_actions
                
                if agent_actions and agent_actions[-1].name == RESPOND_ACTION_NAME:
                    user_response = env.user.step(agent_actions[-1].kwargs['content'])
                    done = "###STOP###" in user_response
                    
                    user_msg = HumanMessage(user_response)
                    agent_state["messages"].append(user_msg)
                    messages.append(user_msg)
                    
                    if verbose:
                        print(messages[-1].pretty_repr(), flush=True)  
                                      
            except Exception as e:
                errors.append(str(e))
                continue
    
        if done:
            done_reason = DoneReason.STOP
        else:
            done_reason = DoneReason.MAX_STEPS_REACHED
            
        reward_res = env.calculate_reward()
        reward = reward_res.reward
        info.reward_info = reward_res
        info.user_cost = env.user.get_total_cost() 
        
        return SolveResult(
            messages=messages_to_dict(messages),
            reward=reward,
            info=info.model_dump(),
            done_reason=done_reason,
            errors = errors
        )
        
