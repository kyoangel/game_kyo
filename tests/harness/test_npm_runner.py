import subprocess
from pathlib import Path
from unittest.mock import ANY, patch

import pytest

from harness.npm_runner import run_build, run_e2e_tests, run_unit_tests
from harness.sandbox_runner import SandboxResult


def _ok(stdout: str = "") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=0, stdout=stdout, stderr="")


def _fail(stderr: str = "error") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr=stderr)


def test_run_build_success(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_ok("Build OK")) as mock_run:
        result = run_build("pixel-squad", tmp_path)

    assert result.success is True
    assert result.returncode == 0
    mock_run.assert_called_once_with(
        ["npm", "run", "build"],
        cwd=tmp_path / "workspace-pixel-squad",
        capture_output=True,
        text=True,
        timeout=120,
        env=ANY,
    )


def test_run_build_failure(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_fail("TS error")):
        result = run_build("pixel-squad", tmp_path)

    assert result.success is False
    assert result.stderr == "TS error"


def test_run_build_timeout(tmp_path: Path) -> None:
    with patch(
        "harness.npm_runner.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd=[], timeout=120),
    ):
        result = run_build("pixel-squad", tmp_path)

    assert result.success is False
    assert "timeout" in result.stderr


def test_run_unit_tests_runs_in_workspace_dir(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_ok("pass")) as mock_run:
        run_unit_tests("pixel-squad", tmp_path)

    mock_run.assert_called_once_with(
        ["npm", "run", "test:unit"],
        cwd=tmp_path / "workspace-pixel-squad",
        capture_output=True,
        text=True,
        timeout=120,
        env=ANY,
    )


def test_run_unit_tests_failure(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_fail("3 failed")):
        result = run_unit_tests("pixel-squad", tmp_path)

    assert result.success is False


def test_run_e2e_tests_uses_longer_timeout(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_ok()) as mock_run:
        run_e2e_tests("pixel-squad", tmp_path)

    _, kwargs = mock_run.call_args
    assert kwargs["timeout"] == 300


def test_run_e2e_tests_runs_correct_command(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_ok()) as mock_run:
        run_e2e_tests("pixel-squad", tmp_path)

    args, _ = mock_run.call_args
    assert args[0] == ["npm", "run", "test:e2e"]


def test_run_build_returns_sandbox_result_type(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_ok()):
        result = run_build("pixel-squad", tmp_path)

    assert isinstance(result, SandboxResult)
