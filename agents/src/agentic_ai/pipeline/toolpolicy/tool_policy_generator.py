from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import List, Optional, cast

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import StructuredTool
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import BaseModel, ConfigDict

from .utils import (
    find_mismatched_references,
    generate_messages,
    read_prompt_file,
    save_output,
)

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class Policy(BaseModel):
    """Policy."""

    policy_name: str
    description: str
    references: list[str]
    model_config = ConfigDict(extra="allow")


class ListPolicy(BaseModel):
    """LisPolicy."""

    policies: list[Policy]


class PolicyExample(BaseModel):
    """PolicyExample."""

    violating_examples: list[str]
    compliance_examples: list[str]


class PolicyReferences(BaseModel):
    """PolicyReferences."""

    references: list[str]


class PolicyReview(BaseModel):
    """PolicyReview."""

    policy_name: str
    description: str
    references: list[str]
    is_relevant: bool
    is_tool_specific: bool
    can_be_validated: bool
    is_actionable: bool
    is_self_contained: bool
    alternative_description: Optional[str]  # noqa
    comments: str


class ToolPolicyGenerator:
    """ToolPolicyGenrator."""

    def __init__(
        self,
        llm: BaseChatModel,
        policy_document: str,
        tools: List[StructuredTool],
        out_dir: Path,
    ) -> None:
        """Create ToolPolicyGenerator."""
        self.llm = llm
        self.policy_document = policy_document
        self.tools_descriptions = {tool.name: tool.description for tool in tools}
        self.tools_details = {tool.name: tool for tool in tools}
        self.out_dir = out_dir

    async def generate_minimal_policy(self, tool: StructuredTool) -> dict:
        """Generate minimal policy."""
        toolpolicy = await self.create_policy(tool)
        toolpolicy = await self.reference_correctness(tool, toolpolicy)
        toolpolicy = await self.create_example(tool, toolpolicy)
        return toolpolicy

    async def generate_policy(
        self, tool: StructuredTool, reflect_iter: int = 3
    ) -> dict:
        """Generate full policy."""
        toolpolicy = await self.create_policy(tool)
        for i in range(reflect_iter):
            toolpolicy = await self.add_policies(tool, toolpolicy, i)
        toolpolicy = await self.split(tool, toolpolicy)
        toolpolicy = await self.merge(tool, toolpolicy)
        toolpolicy = await self.review_policy(tool, toolpolicy)
        toolpolicy = await self.add_references(tool, toolpolicy)
        toolpolicy = await self.reference_correctness(tool, toolpolicy)
        toolpolicy = await self.create_example(tool, toolpolicy)
        for i in range(reflect_iter):
            toolpolicy = await self.add_examples(tool, toolpolicy, i)
        return toolpolicy

    async def create_policy(self, tool: StructuredTool) -> dict:
        """Create policy."""
        logger.debug("policy_creator_node")
        system_prompt = read_prompt_file("create_policy")
        system_prompt = system_prompt.replace("ToolX", tool.name)
        user_content = (
            f"Policy Document:\n{self.policy_document}\n"
            f"Tools Descriptions:\n{json.dumps(self.tools_descriptions)}\n"
            f"Target Tool:\n{convert_to_openai_tool(tool)['function']}\n"
        )
        tptd: ListPolicy = await self.llm.with_structured_output(ListPolicy).ainvoke(
            generate_messages(system_prompt, user_content)
        )
        save_output(self.out_dir, f"{tool.name}.json", tptd.model_dump())
        return tptd.model_dump()

    async def add_policies(
        self, tool: StructuredTool, tptd: dict, iteration: int = 0
    ) -> dict:
        """Add policies."""
        logger.debug("add_policy")
        system_prompt = read_prompt_file("add_policies")
        system_prompt = system_prompt.replace("ToolX", tool.name)
        user_content = (
            f"Policy Document:\n{self.policy_document}\n"
            f"Tools Descriptions:\n{json.dumps(self.tools_descriptions)}\n"
            f"Target Tool:\n{convert_to_openai_tool(tool)['function']}\n"
            f"TPTD: \n{json.dumps(tptd)}"
        )
        response: ListPolicy = await self.llm.with_structured_output(
            ListPolicy
        ).ainvoke(generate_messages(system_prompt, user_content))

        for policy in response.policies:
            cast(list, tptd["policies"]).append(policy.model_dump())

        save_output(self.out_dir, f"{tool.name}_ADD_{iteration}.json", tptd)
        return tptd

    async def split(self, tool: StructuredTool, tptd: dict) -> dict:
        """Split policy."""
        logger.debug("split")
        system_prompt = read_prompt_file("split")
        user_content = (
            f"Policy Document:\n{self.policy_document}\n"
            f"Tools Descriptions:\n{json.dumps(self.tools_descriptions)}\n"
            f"Target Tool:\n{convert_to_openai_tool(tool)['function']}\n"
            f"TPTD: \n{json.dumps(tptd)}"
        )
        tptd: ListPolicy = await self.llm.with_structured_output(ListPolicy).ainvoke(
            generate_messages(system_prompt, user_content)
        )
        tptd_dump = tptd.model_dump()
        save_output(self.out_dir, f"{tool.name}_split.json", tptd_dump)
        return tptd_dump

    async def merge(self, tool: StructuredTool, tptd: dict) -> dict:
        """Merge duplicate policy."""
        logger.debug("merge")
        system_prompt = read_prompt_file("merge")
        user_content = (
            f"Policy Document:\n{self.policy_document}\n"
            f"Tools Descriptions:\n{json.dumps(self.tools_descriptions)}\n"
            f"Target Tool:\n{convert_to_openai_tool(tool)['function']}\n"
            f"TPTD: \n{json.dumps(tptd)}"
        )
        tptd: ListPolicy = await self.llm.with_structured_output(ListPolicy).ainvoke(
            generate_messages(system_prompt, user_content)
        )
        tptd_dump = tptd.model_dump()
        save_output(self.out_dir, f"{tool.name}_merge.json", tptd_dump)
        return tptd_dump

    def _move2archive(self, reviews: list[dict]) -> tuple[bool, str]:
        """Archive policy."""
        comments = ""
        num = len(reviews)
        if num == 0:
            return False
        counts = {
            "is_relevant": 0,
            "is_tool_specific": 0,
            "can_be_validated": 0,
            "is_actionable": 0,
        }

        for r in reviews:
            logger.debug(
                f"{r['is_relevant'] if 'is_relevant' in r else ''}\t{r['is_tool_specific'] if 'is_tool_specific' in r else ''}\t{r['can_be_validated'] if 'can_be_validated' in r else ''}\t{r['is_actionable'] if 'is_actionable' in r else ''}\t{r['is_self_contained'] if 'is_self_contained' in r else ''}\t{r['score'] if 'score' in r else ''}\t"
            )

            counts["is_relevant"] += r["is_relevant"] if "is_relevant" in r else 0
            counts["is_tool_specific"] += (
                r["is_tool_specific"] if "is_tool_specific" in r else 0
            )
            counts["can_be_validated"] += (
                r["can_be_validated"] if "can_be_validated" in r else 0
            )
            counts["is_actionable"] += r["is_actionable"] if "is_actionable" in r else 0

            if not all(
                e in r
                for e in [
                    "is_relevant",
                    "is_tool_specific",
                    "can_be_validated",
                    "is_actionable",
                ]
            ) or not (
                r["is_relevant"]
                and r["is_tool_specific"]
                and r["can_be_validated"]
                and r["is_actionable"]
            ):
                comments += r["comments"] + "\n"

        return not (all(float(counts[key]) / num > 0.5 for key in counts)), comments

    async def review_policy(
        self, tool: StructuredTool, tptd: dict, iteration: int = 1
    ) -> dict:
        """Review policy."""
        logger.debug("review_policy")
        system_prompt = read_prompt_file("policy_reviewer")
        newTPTD = {"policies": []}

        if "policies" not in tptd:
            tptd["policies"] = []

        for policy in tptd["policies"]:
            reviews = []
            for iter in range(iteration):
                user_content = (
                    f"Policy Document:\n{self.policy_document}\n"
                    f"Tools Descriptions:\n{convert_to_openai_tool(tool)['function']}\n"
                    f"Target Tool:\n{json.dumps(self.tools_descriptions[tool.name])}\n"
                    f"policy:\n{json.dumps(policy)}"
                )

                response: PolicyReview = await self.llm.with_structured_output(
                    PolicyReview
                ).ainvoke(generate_messages(system_prompt, user_content))

                if response.alternative_description:
                    policy["description"] = response.alternative_description
                else:
                    logger.debug(
                        "Error: review is_self_contained is false but no alternative_description."
                    )

                reviews.append(response.model_dump())
            archive, comments = self._move2archive(reviews)
            logger.debug(archive)
            if archive:
                if "archive" not in newTPTD:
                    newTPTD["archive"] = []
                policy["comments"] = comments
                newTPTD["archive"].append(policy)
            else:
                newTPTD["policies"].append(policy)
        save_output(self.out_dir, f"{tool.name}_rev.json", newTPTD)
        return newTPTD

    async def add_references(self, tool: StructuredTool, tptd: dict) -> dict:
        """Add references."""
        logger.debug("add_ref")
        system_prompt = read_prompt_file("add_references")
        # remove old refs (used to help avoid duplications)
        for policy in tptd["policies"]:
            policy["references"] = []
            user_content = (
                f"Policy Document:{self.policy_document}\n"
                f"Tools Descriptions:{json.dumps(self.tools_descriptions)}\n"
                f"Target Tool:{convert_to_openai_tool(tool)['function']}\n"
                f"policy: {json.dumps(policy)}"
            )
            response: PolicyReferences = await self.llm.with_structured_output(
                PolicyReferences
            ).ainvoke(generate_messages(system_prompt, user_content))

            policy["references"] = response.references

        save_output(self.out_dir, f"{tool.name}_ref.json", tptd)
        return tptd

    async def reference_correctness(self, tool: StructuredTool, tptd: dict) -> dict:
        """Check reference correctneess."""
        logger.debug("reference_correctness")
        tptd, unmatched_policies = find_mismatched_references(
            self.policy_document, tptd
        )
        save_output(self.out_dir, f"{tool.name}_ref_orig_.json", unmatched_policies)
        save_output(self.out_dir, f"{tool.name}_ref_correction_.json", tptd)
        return tptd

    async def create_example(self, tool: StructuredTool, tptd: dict) -> dict:
        """Create example."""
        logger.debug("example_creator")
        system_prompt = read_prompt_file("create_examples")
        system_prompt = system_prompt.replace("ToolX", tool.name)

        for policy in tptd["policies"]:
            user_content = (
                f"Tools Descriptions:\n{json.dumps(self.tools_descriptions)}\n"
                f"Target Tool:\n{convert_to_openai_tool(tool)['function']}\n"
                f"Policy:{policy}"
            )

            response: PolicyExample = await self.llm.with_structured_output(
                PolicyExample
            ).ainvoke(generate_messages(system_prompt, user_content))

            if response.violating_examples:
                policy["violating_examples"] = response.violating_examples

            if response.compliance_examples:
                policy["compliance_examples"] = response.compliance_examples

        save_output(self.out_dir, f"{tool.name}_examples.json", tptd)

        return tptd

    async def add_examples(
        self, tool: StructuredTool, tptd: dict, iteration: int
    ) -> dict:
        """Add examples."""
        logger.debug("add_examples")
        system_prompt = read_prompt_file("add_examples")
        system_prompt = system_prompt.replace("ToolX", tool.name)
        for policy in tptd["policies"]:
            user_content = (
                f"Tools Descriptions:{json.dumps(self.tools_descriptions)}\n"
                f"Target Tool:{convert_to_openai_tool(tool)['function']}\n"
                f"Policy:{policy}"
            )
            response: PolicyExample = await self.llm.with_structured_output(
                PolicyExample
            ).ainvoke(generate_messages(system_prompt, user_content))
            if response.violating_examples:
                for vexample in response.violating_examples:
                    if "violating_examples" not in policy:
                        policy["violating_examples"] = []
                    cast(list, policy["violating_examples"]).append(vexample)
            if response.compliance_examples:
                for cexample in response.compliance_examples:
                    if "compliance_examples" not in policy:
                        policy["compliance_examples"] = []
                    cast(list, policy["compliance_examples"]).append(cexample)

        save_output(self.out_dir, f"{tool.name}_ADD_examples{iteration}.json", tptd)
        return tptd

    @staticmethod
    async def run(
        policy_text: str,
        tools: List[StructuredTool],
        output_dir: Path,
        llm: BaseChatModel,
        tools_shortlist: List[StructuredTool] | None = None,
        short=False,
    ):
        """Run full pipeline tool policy."""
        output_dir.mkdir(exist_ok=True, parents=True)
        process_dir = output_dir / "process"
        process_dir.mkdir(exist_ok=True)

        tpg = ToolPolicyGenerator(llm, policy_text, tools, process_dir)

        async def do_one_tool(tool: StructuredTool):
            if short:
                final_output = await tpg.generate_minimal_policy(tool)
            else:
                final_output = await tpg.generate_policy(tool)

            (output_dir / f"{tool.name}.json").write_text(
                json.dumps(final_output, indent=2)
            )

        await asyncio.gather(
            *[
                do_one_tool(tool)
                for tool in tools
                if ((tools_shortlist is None) or (tool in tools_shortlist))
            ]
        )
        logger.debug("Done!")
