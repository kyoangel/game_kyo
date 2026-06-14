from pathlib import Path

from pydantic import BaseModel

from agents import gemini_client
from harness import prompt_store


class ReviewResult(BaseModel):
    approved: bool
    comments: list[str]


def _format_changed_files(changed_files: list[Path], repo_root: Path) -> str:
    if not changed_files:
        return "No files were changed."

    blocks = []
    for path in changed_files:
        content = (repo_root / path).read_text()
        blocks.append(f"## {path}\n{content}")

    return "\n\n".join(blocks)


def run_reviewer(changed_files: list[Path], repo_root: Path) -> ReviewResult:
    system_prompt = prompt_store.load("reviewer", repo_root)
    task = _format_changed_files(changed_files, repo_root)

    return gemini_client.call_gemini(
        system_prompt=system_prompt,
        task=task,
        response_schema=ReviewResult,
    )
