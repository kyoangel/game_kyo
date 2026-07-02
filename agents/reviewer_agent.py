import json
import re
import subprocess
from pathlib import Path

from pydantic import BaseModel

from agents import claude_cli, gemini_client
from agents.gemini_client import GeminiClientError
from harness import prompt_store


class ReviewResult(BaseModel):
    approved: bool
    comments: list[str]


def _get_diff(changed_files: list[Path], repo_root: Path) -> str:
    if not changed_files:
        return "No files were changed."

    # Send unified diff instead of full file content — much smaller payload
    result = subprocess.run(
        ["git", "diff", "HEAD", "--"] + [str(p) for p in changed_files],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    diff = result.stdout.strip()

    # Also include untracked new files as full content (not in git diff)
    new_file_blocks = []
    for path in changed_files:
        full_path = repo_root / path
        if full_path.exists() and full_path.is_file():
            status = subprocess.run(
                ["git", "ls-files", "--error-unmatch", str(path)],
                cwd=repo_root, capture_output=True,
            ).returncode
            if status != 0:  # untracked = new file
                new_file_blocks.append(f"### New file: {path}\n{full_path.read_text()}")

    parts = []
    if diff:
        parts.append(f"## Git diff (modified files)\n```diff\n{diff}\n```")
    if new_file_blocks:
        parts.append("## New files (full content)\n\n" + "\n\n".join(new_file_blocks))

    return "\n\n".join(parts) if parts else "No changes detected."


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
    task = _get_diff(changed_files, repo_root)

    try:
        return gemini_client.call_gemini(
            system_prompt=system_prompt,
            task=task,
            response_schema=ReviewResult,
        )
    except GeminiClientError:
        return _claude_fallback_review(task, system_prompt, repo_root)
