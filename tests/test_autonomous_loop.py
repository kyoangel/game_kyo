import subprocess
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

from autonomous_loop import autonomous_loop, _git_commit
from agents.reviewer_agent import ReviewResult
from harness.sandbox_runner import SandboxResult

APPROVED = ReviewResult(approved=True, comments=["LGTM"])
REJECTED = ReviewResult(approved=False, comments=["fix this"])
BUILD_OK = SandboxResult(success=True, stdout="", stderr="", returncode=0)
BUILD_FAIL = SandboxResult(success=False, stdout="", stderr="build error", returncode=1)
UNIT_OK = SandboxResult(success=True, stdout="103 pass", stderr="", returncode=0)
UNIT_FAIL = SandboxResult(success=False, stdout="1 fail", stderr="", returncode=1)
E2E_OK = SandboxResult(success=True, stdout="", stderr="", returncode=0)
_CHANGED = {"workspace-pixel-squad/changed.ts"}


def _make_alternating_paths():
    """Factory: returns empty set on odd calls (before-coder), non-empty on even calls (after-coder)."""
    state = {"n": 0}

    def side_effect(*args, **kwargs):
        state["n"] += 1
        return _CHANGED if state["n"] % 2 == 0 else set()

    return side_effect


def _make_repo(tmp_path: Path) -> tuple[Path, Path]:
    (tmp_path / "specs").mkdir()
    (tmp_path / "prompts").mkdir()
    (tmp_path / "prompts" / "qa-pixel-squad.txt").write_text("qa prompt\n")
    (tmp_path / "prompts" / "coder-pixel-squad.txt").write_text("coder prompt\n")
    backlog = tmp_path / "specs" / "pixel-squad-backlog.md"
    backlog.write_text("- [ ] skill system\n")
    return tmp_path, backlog


def test_loop_stops_immediately_when_designer_returns_none(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)

    with patch("autonomous_loop.designer_agent.run_designer", return_value=None) as mock_designer, \
         patch("autonomous_loop.claude_cli.call_coder") as mock_coder, \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_designer.assert_called_once()
    mock_coder.assert_not_called()


def test_loop_runs_full_cycle_on_success(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_OK), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit") as mock_commit, \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_commit.assert_called_once()


def test_loop_retries_coder_on_build_failure(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    call_count = 0

    def build_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return BUILD_FAIL if call_count < 3 else BUILD_OK

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", side_effect=build_side_effect), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    assert call_count == 3


def test_loop_respects_max_iter(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    designer_calls = []

    def designer_side_effect(*args, **kwargs):
        designer_calls.append(1)
        return spec

    # Patch resume helpers so each iteration starts fresh (no cross-iteration resume)
    with patch("autonomous_loop.designer_agent.run_designer", side_effect=designer_side_effect), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_FAIL), \
         patch("autonomous_loop.workspace_diff.changed_paths", return_value=set()), \
         patch("autonomous_loop.trace_logger.log_step"), \
         patch("autonomous_loop._load_resume", return_value={}), \
         patch("autonomous_loop._save_resume"), \
         patch("autonomous_loop._clear_resume"):
        autonomous_loop("pixel-squad", max_iter=2, repo_root=repo)

    assert len(designer_calls) == 2


def test_loop_skips_commit_when_all_retries_fail(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_FAIL), \
         patch("autonomous_loop._git_commit") as mock_commit, \
         patch("autonomous_loop.workspace_diff.changed_paths", return_value=set()), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_commit.assert_not_called()


def test_reviewer_not_called_when_no_files_changed(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_OK), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer") as mock_reviewer, \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.workspace_diff.changed_paths", return_value=set()), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_reviewer.assert_not_called()


def test_meta_reviewer_not_called_by_default(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_OK), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.workspace_diff.changed_paths", return_value=set()), \
         patch("autonomous_loop.trace_logger.log_step"), \
         patch("autonomous_loop.meta_reviewer_agent.run_meta_review") as mock_meta:
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_meta.assert_not_called()


def test_meta_reviewer_called_when_flag_enabled(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_OK), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step"), \
         patch("autonomous_loop.meta_reviewer_agent.run_meta_review", return_value=[]) as mock_meta:
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo, meta_review=True)

    mock_meta.assert_called_once()


def test_git_commit_runs_correct_commands(tmp_path: Path) -> None:
    repo = tmp_path
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@t.com"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True, capture_output=True)

    (repo / "workspace-pixel-squad").mkdir()
    (repo / "workspace-pixel-squad" / "new.ts").write_text("export const x = 1;\n")
    (repo / "specs").mkdir()
    spec = repo / "specs" / "pixel-squad-skill-system.md"
    spec.write_text("# spec\n")
    backlog = repo / "specs" / "pixel-squad-backlog.md"
    backlog.write_text("- [x] skill system\n")

    subprocess.run(["git", "add", "specs/pixel-squad-backlog.md"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init backlog"], cwd=repo, check=True, capture_output=True)

    _git_commit("pixel-squad", spec, repo, iter_n=0)

    log = subprocess.run(
        ["git", "log", "--oneline", "-1"], cwd=repo, capture_output=True, text=True, check=True
    ).stdout
    assert "feat(pixel-squad)" in log
    assert "iter 0" in log
