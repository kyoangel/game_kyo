from pathlib import Path

from agents import claude_cli
from harness import prompt_store


def run_coder(
    spec_path: Path,
    feedback: str | None = None,
    repo_root: Path | None = None,
) -> list[Path]:
    system_prompt = prompt_store.load("coder", repo_root)
    task = spec_path.read_text()

    claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        feedback=feedback,
        repo_root=repo_root,
    )

    return []
