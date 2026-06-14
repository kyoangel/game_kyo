from unittest.mock import MagicMock, patch

from harness.sandbox_runner import SandboxResult, run_build_check


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
