import subprocess
from pathlib import Path

CLAUDE_TIMEOUT_S = 600


class ClaudeCliError(Exception):
    pass


def call_coder(
    system_prompt: str,
    task: str,
    feedback: str | None = None,
    repo_root: Path | None = None,
) -> str:
    prompt = task
    if feedback is not None:
        prompt = f"{task}\n\n## Previous attempt feedback:\n{feedback}"

    try:
        result = subprocess.run(
            [
                "claude",
                "-p",
                prompt,
                "--append-system-prompt",
                system_prompt,
                "--permission-mode",
                "acceptEdits",
            ],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=CLAUDE_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        raise ClaudeCliError(f"claude CLI timed out after {CLAUDE_TIMEOUT_S}s")

    if result.returncode != 0:
        detail = (
            result.stderr.strip()
            or result.stdout.strip()
            or f"claude exited with code {result.returncode}"
        )
        raise ClaudeCliError(detail)

    return result.stdout.strip()
