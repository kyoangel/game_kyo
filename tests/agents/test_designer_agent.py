from pathlib import Path
from unittest.mock import patch

import pytest

from agents.designer_agent import DesignerError, run_designer


def _make_repo(tmp_path: Path, *, backlog_text: str = "- [ ] skill system\n") -> tuple[Path, Path]:
    """Returns (repo_root, backlog_path)."""
    (tmp_path / "prompts").mkdir()
    (tmp_path / "prompts" / "designer-pixel-squad.txt").write_text("you are a designer\n")
    (tmp_path / "specs").mkdir()
    backlog = tmp_path / "specs" / "pixel-squad-backlog.md"
    backlog.write_text(backlog_text)
    return tmp_path, backlog


def test_run_designer_returns_spec_path(tmp_path: Path) -> None:
    repo, backlog = _make_repo(tmp_path)
    output = "Designed the skill system.\nSPEC_PATH: specs/pixel-squad-skill-system.md"

    with patch("agents.designer_agent.claude_cli.call_coder", return_value=output) as mock_call:
        result = run_designer("pixel-squad", backlog, repo)

    assert result == Path("specs/pixel-squad-skill-system.md")
    mock_call.assert_called_once_with(
        system_prompt="you are a designer\n",
        task="- [ ] skill system\n",
        repo_root=repo,
    )


def test_run_designer_returns_none_when_done(tmp_path: Path) -> None:
    repo, backlog = _make_repo(tmp_path, backlog_text="- [x] all done\n")

    with patch("agents.designer_agent.claude_cli.call_coder", return_value="SPEC_PATH: DONE"):
        result = run_designer("pixel-squad", backlog, repo)

    assert result is None


def test_run_designer_parses_spec_path_from_multiline_output(tmp_path: Path) -> None:
    repo, backlog = _make_repo(tmp_path)
    output = "Line 1\nLine 2\nLine 3\nSPEC_PATH: specs/pixel-squad-archetype.md"

    with patch("agents.designer_agent.claude_cli.call_coder", return_value=output):
        result = run_designer("pixel-squad", backlog, repo)

    assert result == Path("specs/pixel-squad-archetype.md")


def test_run_designer_raises_on_missing_signal(tmp_path: Path) -> None:
    repo, backlog = _make_repo(tmp_path)

    with patch("agents.designer_agent.claude_cli.call_coder", return_value="I made a great spec"):
        with pytest.raises(DesignerError, match="missing SPEC_PATH"):
            run_designer("pixel-squad", backlog, repo)


def test_run_designer_loads_workspace_specific_prompt(tmp_path: Path) -> None:
    repo, backlog = _make_repo(tmp_path)

    with patch("agents.designer_agent.claude_cli.call_coder", return_value="SPEC_PATH: specs/x.md") as mock_call:
        run_designer("pixel-squad", backlog, repo)

    system_prompt_used = mock_call.call_args.kwargs["system_prompt"]
    assert system_prompt_used == "you are a designer\n"
