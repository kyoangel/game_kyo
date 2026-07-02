import json
import subprocess
from pathlib import Path

CLAUDE_TIMEOUT_S = 600

_usage_log: list[dict] = []


class ClaudeCliError(Exception):
    pass


def reset_usage_log() -> list[dict]:
    """Return and clear accumulated usage entries."""
    global _usage_log
    snapshot = _usage_log[:]
    _usage_log = []
    return snapshot


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
                "--output-format",
                "json",
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

    try:
        parsed = json.loads(result.stdout)
        usage = parsed.get("usage", {})
        if usage:
            _usage_log.append({
                "usage": usage,
                "cost_usd": parsed.get("total_cost_usd"),
                "model": parsed.get("modelUsage", {}),
            })
        return parsed.get("result", result.stdout).strip()
    except (json.JSONDecodeError, KeyError):
        return result.stdout.strip()
