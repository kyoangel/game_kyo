import subprocess
from pathlib import Path


def call_coder(
    system_prompt: str,
    task: str,
    feedback: str | None = None,
    repo_root: Path | None = None,
) -> str:
    result = subprocess.run(
        [
            "claude",
            "-p",
            task,
            "--append-system-prompt",
            system_prompt,
            "--permission-mode",
            "acceptEdits",
        ],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    return result.stdout
