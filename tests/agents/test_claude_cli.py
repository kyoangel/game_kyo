from pathlib import Path
from unittest.mock import MagicMock, patch

from agents.claude_cli import call_coder


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
