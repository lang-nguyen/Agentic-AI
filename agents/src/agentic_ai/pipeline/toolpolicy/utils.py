import json
import os
from pathlib import Path
from typing import Any, Dict, List


def read_prompt_file(filename: str) -> str:
    """Read prompt from file."""
    path = Path(__file__).parent / "prompts" / f"{filename}.txt"
    return path.read_text(encoding="utf-8")


def generate_messages(system_prompt: str, user_content: str) -> List[Dict[str, str]]:
    """Generate system and user messages."""
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def save_output(outdir: str, filename: str, content: Any) -> None:
    """Save output."""
    with open(os.path.join(outdir, filename), "w") as outfile:
        json.dump(content, outfile, indent=4, ensure_ascii=True)


def normalize_text(text: str) -> str:
    """Normalize text by removing punctuation, converting to lowercase, and standardizing spaces."""
    return text.lower()


def split_reference_if_both_parts_exist(reference, policy_text):
    """Split reference."""
    words = reference.split()
    for split_point in range(1, len(words)):
        part1 = " ".join(words[:split_point])
        part2 = " ".join(words[split_point:])

        normalized_part1 = normalize_text(part1)
        normalized_part2 = normalize_text(part2)
        normalized_policy_text = normalize_text(policy_text)

        if (
            normalized_part1 in normalized_policy_text
            and normalized_part2 in normalized_policy_text
        ):
            start_idx1 = normalized_policy_text.find(normalized_part1)
            end_idx1 = start_idx1 + len(part1)
            start_idx2 = normalized_policy_text.find(normalized_part2)
            end_idx2 = start_idx2 + len(part2)
            return [policy_text[start_idx1:end_idx1], policy_text[start_idx2:end_idx2]]
    return None


def find_mismatched_references(policy_text, policy_json):
    """Find mismatched references."""
    corrections = json.loads(json.dumps(policy_json))
    unmatched_policies = []
    if isinstance(corrections["policies"], str):
        return corrections, unmatched_policies

    normalized_policy_text = normalize_text(policy_text)

    for policy in corrections["policies"]:
        corrected_references = []
        has_unmatched = False

        for reference in policy["references"]:
            normalized_ref = normalize_text(reference)
            # if normalized ref in policy doc- just copy the original
            if normalized_ref in normalized_policy_text:
                start_idx = normalized_policy_text.find(normalized_ref)
                end_idx = start_idx + len(reference)
                corrected_references.append(policy_text[start_idx:end_idx])
            else:
                split_segments = split_reference_if_both_parts_exist(
                    reference, policy_text
                )
                if split_segments:
                    corrected_references.extend(split_segments)
                else:
                    corrected_references.append(
                        reference
                    )  # Keep original if no match found
                    has_unmatched = True

        policy["references"] = corrected_references
        if has_unmatched:
            unmatched_policies.append(policy["policy_name"])

    return corrections, unmatched_policies
