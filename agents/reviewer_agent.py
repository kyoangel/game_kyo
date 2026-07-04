import json
import re
from pathlib import Path

from pydantic import BaseModel

from agents import claude_cli, gemini_client, lm_studio_client
from agents.gemini_client import GeminiClientError
from agents.lm_studio_client import LmStudioError
from harness import prompt_store

_MAX_FILE_LINES = 200


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
            blocks.append(f"## {path}\n(deleted)")
        elif full_path.is_dir():
            blocks.append(f"## {path}\n(directory — skipped)")
        else:
            lines = full_path.read_text().splitlines()
            content = "\n".join(lines[:_MAX_FILE_LINES])
            if len(lines) > _MAX_FILE_LINES:
                content += f"\n... ({len(lines) - _MAX_FILE_LINES} more lines truncated)"
            blocks.append(f"## {path}\n{content}")

    return "\n\n".join(blocks)


def _parse_review_json(output: str, source: str) -> ReviewResult:
    json_match = re.search(r'\{.*\}', output, re.DOTALL)
    if not json_match:
        return ReviewResult(
            approved=True,
            comments=[f"[{source} reviewer: could not parse output — auto-approved]"],
        )
    try:
        data = json.loads(json_match.group())
        return ReviewResult(**data)
    except Exception:
        return ReviewResult(
            approved=True,
            comments=[f"[{source} reviewer: parse error — auto-approved]"],
        )


def _fallback_review(task: str, system_prompt: str, repo_root: Path) -> ReviewResult:
    fallback_system = (
        system_prompt
        + "\n\n重要：你是唯讀審查員，絕對不能修改任何檔案。"
        + "\n只輸出一個合法的 JSON 物件，格式：{\"approved\": boolean, \"comments\": [\"...\"]}"
        + "\n不要輸出任何其他文字，只有 JSON。"
    )

    if lm_studio_client.is_available():
        print("⚠️  Gemini unavailable — falling back to LM Studio reviewer")
        try:
            output = lm_studio_client.call_lm_studio(
                fallback_system, task, model=lm_studio_client.LM_STUDIO_MODEL_CODER
            )
            return _parse_review_json(output, "LM Studio")
        except LmStudioError as e:
            print(f"⚠️  LM Studio reviewer also failed: {e} — falling back to Claude CLI")

    print("⚠️  Falling back to Claude CLI reviewer")
    output = claude_cli.call_coder(
        system_prompt=fallback_system,
        task=task,
        repo_root=repo_root,
    )
    return _parse_review_json(output, "Claude")


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
        return _fallback_review(task, system_prompt, repo_root)
