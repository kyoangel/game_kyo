import shutil
import subprocess
from unittest.mock import MagicMock, patch

import pytest

from harness.sandbox_runner import SandboxResult, run_build_check, run_e2e_tests


def test_sandbox_result_is_comparable_dataclass() -> None:
    a = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    b = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)

    assert a == b
    assert a.success is True
    assert a.stdout == "ok"
    assert a.stderr == ""
    assert a.returncode == 0


def test_run_build_check_uses_correct_name_flag_and_maps_result() -> None:
    build_result = MagicMock(returncode=0, stdout="build ok", stderr="")
    run_result = MagicMock(returncode=0, stdout="tsc ok", stderr="")

    with patch(
        "harness.sandbox_runner.subprocess.run", side_effect=[build_result, run_result]
    ) as mock_run:
        result = run_build_check()

    build_call_args = mock_run.call_args_list[0].args[0]
    run_call_args = mock_run.call_args_list[1].args[0]

    assert build_call_args == [
        "docker",
        "build",
        "-t",
        "game-sandbox",
        "-f",
        "sandbox.Dockerfile",
        ".",
    ]

    name_index = run_call_args.index("--name")
    assert run_call_args[name_index + 1]  # an instance-name token follows --name
    assert run_call_args[0:3] == ["docker", "run", "--rm"]
    assert run_call_args[-1] == "game-sandbox"

    assert result == SandboxResult(success=True, stdout="tsc ok", stderr="", returncode=0)


def test_run_build_check_short_circuits_on_build_failure() -> None:
    build_result = MagicMock(returncode=1, stdout="", stderr="tsc error")

    with patch(
        "harness.sandbox_runner.subprocess.run", side_effect=[build_result]
    ) as mock_run:
        result = run_build_check()

    assert mock_run.call_count == 1  # docker run was never called
    assert result == SandboxResult(success=False, stdout="", stderr="tsc error", returncode=1)


def test_run_build_check_passes_timeout_to_subprocess_run() -> None:
    build_result = MagicMock(returncode=0, stdout="", stderr="")
    run_result = MagicMock(returncode=0, stdout="", stderr="")

    with patch(
        "harness.sandbox_runner.subprocess.run", side_effect=[build_result, run_result]
    ) as mock_run:
        run_build_check()

    assert "timeout" in mock_run.call_args_list[0].kwargs
    assert "timeout" in mock_run.call_args_list[1].kwargs


def test_run_build_check_handles_timeout_expired() -> None:
    with patch(
        "harness.sandbox_runner.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd=["docker", "build"], timeout=300),
    ):
        result = run_build_check()

    assert result.success is False
    assert "timeout" in result.stderr.lower()


def test_run_e2e_tests_uses_e2e_dockerfile_and_distinct_container_name() -> None:
    build_result = MagicMock(returncode=0, stdout="", stderr="")
    run_result = MagicMock(returncode=0, stdout="3 passed", stderr="")

    with patch(
        "harness.sandbox_runner.subprocess.run", side_effect=[build_result, run_result]
    ) as mock_run:
        result = run_e2e_tests()

    build_call_args = mock_run.call_args_list[0].args[0]
    run_call_args = mock_run.call_args_list[1].args[0]

    assert build_call_args == [
        "docker",
        "build",
        "-t",
        "game-sandbox-e2e",
        "-f",
        "sandbox.e2e.Dockerfile",
        ".",
    ]

    name_index = run_call_args.index("--name")
    e2e_container_name = run_call_args[name_index + 1]
    assert e2e_container_name != "game-sandbox-instance"
    assert run_call_args[-1] == "game-sandbox-e2e"

    assert result == SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0)


@pytest.mark.docker
@pytest.mark.skipif(shutil.which("docker") is None, reason="Docker not available")
def test_run_build_check_real_docker_succeeds() -> None:
    result = run_build_check()

    assert result.success is True
    assert "error" not in result.stdout.lower()
