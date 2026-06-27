from pathlib import Path

from agents import claude_cli
from harness import prompt_store


class DesignerError(Exception):
    pass


def run_designer(workspace: str, backlog_path: Path, repo_root: Path) -> Path | None:
    system_prompt = prompt_store.load("designer", repo_root, workspace=workspace)
    task = backlog_path.read_text()

    output = claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
    )

    for line in reversed(output.splitlines()):
        line = line.strip()
        if line.startswith("SPEC_PATH:"):
            value = line[len("SPEC_PATH:"):].strip()
            if value == "DONE":
                return None
            return Path(value)

    raise DesignerError(f"Designer output missing SPEC_PATH signal: {output[-200:]!r}")
