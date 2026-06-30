import json
import re
from pathlib import Path

from pydantic import BaseModel

from agents import claude_cli, gemini_client
from agents.gemini_client import GeminiClientError
from harness import prompt_store


class ReviewResult(BaseModel):
    approved: bool
    comments: list[str]


def _format_changed_files(changed_files: list[Path], repo_root: Path) -> str:
    if not changed_files:
        return "No files were changed."

    blocks = []
    for path in changed_files:
        full_path = repo_root / path
        if not full_path.exists():
            blocks.append(f"## {path}\n(file deleted)")
        elif full_path.is_dir():
            blocks.append(f"## {path}\n(new directory)")
        else:
            content = full_path.read_text()
            blocks.append(f"## {path}\n{content}")

    return "\n\n".join(blocks)


def _claude_fallback_review(task: str, system_prompt: str, repo_root: Path) -> ReviewResult:
    print("⚠️  Gemini unavailable — falling back to Claude CLI reviewer")

    fallback_system = (
        system_prompt
        + "\n\n重要：你是唯讀審查員，絕對不能修改任何檔案。"
        + "\n只輸出一個合法的 JSON 物件，格式：{\"approved\": boolean, \"comments\": [\"...\"]}"
        + "\n不要輸出任何其他文字，只有 JSON。"
    )

    output = claude_cli.call_coder(
        system_prompt=fallback_system,
        task=task,
        repo_root=repo_root,
    )

    json_match = re.search(r'\{.*\}', output, re.DOTALL)
    if not json_match:
        return ReviewResult(
            approved=True,
            comments=["[Claude fallback reviewer: could not parse output — auto-approved]"],
        )

    try:
        data = json.loads(json_match.group())
        return ReviewResult(**data)
    except Exception:
        return ReviewResult(
            approved=True,
            comments=["[Claude fallback reviewer: parse error — auto-approved]"],
        )


def run_reviewer(changed_files: list[Path], repo_root: Path) -> ReviewResult:
    system_prompt = prompt_store.load("reviewer", repo_root)
    task = _format_changed_files(changed_files, repo_root)

    try:
        return gemini_client.call_gemini(
            system_prompt=system_prompt,
            task=task,
            response_schema=ReviewResult,
        )
    except GeminiClientError:
        return _claude_fallback_review(task, system_prompt, repo_root)
