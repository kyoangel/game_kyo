import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from agents.claude_cli import ClaudeCliError, call_coder


def test_call_coder_invokes_claude_with_expected_args_and_cwd(tmp_path: Path) -> None:
    mock_result = MagicMock(returncode=0, stdout="done", stderr="")

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result) as mock_run:
        call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path)

    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert cmd[0] == "claude"
    assert "-p" in cmd
    assert cmd[cmd.index("-p") + 1] == "TASK"
    assert "--append-system-prompt" in cmd
    assert cmd[cmd.index("--append-system-prompt") + 1] == "SYSTEM"
    assert "--permission-mode" in cmd
    assert cmd[cmd.index("--permission-mode") + 1] == "acceptEdits"

    assert kwargs.get("shell") is not True
    assert kwargs["cwd"] == tmp_path


def test_call_coder_appends_feedback_to_prompt(tmp_path: Path) -> None:
    mock_result = MagicMock(returncode=0, stdout="done", stderr="")

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result) as mock_run:
        call_coder(
            system_prompt="SYSTEM",
            task="Implement feature X",
            feedback="tsc error: missing semicolon",
            repo_root=tmp_path,
        )

    cmd = mock_run.call_args.args[0]
    prompt = cmd[cmd.index("-p") + 1]

    assert "Implement feature X" in prompt
    assert "## Previous attempt feedback:" in prompt
    assert "tsc error: missing semicolon" in prompt


def test_call_coder_returns_stripped_stdout_on_success(tmp_path: Path) -> None:
    mock_result = MagicMock(returncode=0, stdout="  done  \n", stderr="")

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result):
        assert call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path) == "done"


def test_call_coder_raises_on_nonzero_returncode(tmp_path: Path) -> None:
    mock_result = MagicMock(returncode=1, stdout="", stderr="auth error")

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result):
        with pytest.raises(ClaudeCliError, match="auth error"):
            call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path)


def test_call_coder_raises_with_stdout_when_stderr_is_empty(tmp_path: Path) -> None:
    """When claude exits non-zero but writes nothing to stderr (common in nested sessions),
    the error should still be informative — fall back to stdout."""
    mock_result = MagicMock(returncode=1, stdout="  Permission denied by session  ", stderr="")

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result):
        with pytest.raises(ClaudeCliError, match="Permission denied by session"):
            call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path)


def test_call_coder_raises_with_returncode_when_stdout_and_stderr_both_empty(tmp_path: Path) -> None:
    """Last-resort fallback: include the exit code so the error is never a blank string."""
    mock_result = MagicMock(returncode=2, stdout="", stderr="")

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result):
        with pytest.raises(ClaudeCliError, match="2"):
            call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path)


def test_call_coder_converts_timeout_expired_to_claude_cli_error(tmp_path: Path) -> None:
    with patch(
        "agents.claude_cli.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd=["claude"], timeout=600),
    ):
        with pytest.raises(ClaudeCliError, match="timed out"):
            call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path)


@pytest.mark.claude_cli
def test_call_coder_real_claude_cli_replies_ok() -> None:
    result = call_coder(system_prompt="", task="Reply with exactly: OK")

    assert result == "OK"
