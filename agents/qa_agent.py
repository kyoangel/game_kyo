from pathlib import Path

from agents import claude_cli
from harness import prompt_store, workspace_diff


def run_qa(spec_path: Path, repo_root: Path | None = None) -> list[Path]:
    system_prompt = prompt_store.load("qa", repo_root)
    task = spec_path.read_text()

    before = workspace_diff.changed_paths(repo_root)

    claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
    )

    after = workspace_diff.changed_paths(repo_root)
    changed = after - before
    return sorted(Path(p) for p in changed)
