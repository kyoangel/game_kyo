import dataclasses
from pathlib import Path
from unittest.mock import patch

import pytest

import orchestrator
from harness.sandbox_runner import SandboxResult


def test_inner_loop_calls_run_coder_then_run_build_check(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    success_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)

    with patch("orchestrator.coder_agent.run_coder", return_value=[]) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=success_result
    ) as mock_build_check:
        result = orchestrator.inner_loop(spec_path, repo_root=tmp_path)

    mock_run_coder.assert_called_once_with(spec_path, feedback=None, repo_root=tmp_path)
    mock_build_check.assert_called_once()
    assert result == success_result


@pytest.mark.parametrize(
    "build_results, expected_calls, expected_success",
    [
        (
            [
                SandboxResult(success=False, stdout="", stderr="tsc error: foo", returncode=1),
                SandboxResult(success=True, stdout="ok", stderr="", returncode=0),
            ],
            2,
            True,
        ),
        (
            [
                SandboxResult(success=False, stdout="", stderr="tsc error: A", returncode=1),
                SandboxResult(success=False, stdout="", stderr="tsc error: B", returncode=1),
                SandboxResult(success=False, stdout="", stderr="tsc error: C", returncode=1),
            ],
            3,
            False,
        ),
    ],
)
def test_inner_loop_retries_with_feedback_on_failure(
    tmp_path: Path, build_results, expected_calls, expected_success
) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    with patch("orchestrator.coder_agent.run_coder", return_value=[]) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", side_effect=build_results
    ) as mock_build_check:
        result = orchestrator.inner_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_run_coder.call_count == expected_calls
    assert mock_build_check.call_count == expected_calls
    assert result.success is expected_success

    feedback_args = [call.kwargs["feedback"] for call in mock_run_coder.call_args_list]
    assert feedback_args[0] is None
    for i in range(1, expected_calls):
        assert feedback_args[i] == build_results[i - 1].stderr


def test_inner_loop_logs_each_attempt(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_results = [
        SandboxResult(success=False, stdout="", stderr="tsc error: foo", returncode=1),
        SandboxResult(success=True, stdout="ok", stderr="", returncode=0),
    ]

    with patch("orchestrator.coder_agent.run_coder", return_value=[]), patch(
        "orchestrator.sandbox_runner.run_build_check", side_effect=build_results
    ), patch("orchestrator.trace_logger.log_step") as mock_log_step:
        orchestrator.inner_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_log_step.call_count == 2

    for call, sandbox_result in zip(mock_log_step.call_args_list, build_results):
        kwargs = call.kwargs
        assert kwargs["agent"] == "coder"
        assert kwargs["result"] == dataclasses.asdict(sandbox_result)

    run_ids = {call.kwargs["run_id"] for call in mock_log_step.call_args_list}
    assert len(run_ids) == 1


def test_main_resolves_default_spec_path_and_returns_zero_on_success(capsys) -> None:
    success_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)

    with patch("orchestrator.inner_loop", return_value=success_result) as mock_inner_loop:
        exit_code = orchestrator.main([])

    mock_inner_loop.assert_called_once_with(orchestrator.REPO_ROOT / "specs" / "math-merge-10.md")
    assert exit_code == 0
    assert "✅" in capsys.readouterr().out


def test_main_uses_provided_spec_path_and_returns_one_on_failure(tmp_path: Path, capsys) -> None:
    failure_result = SandboxResult(success=False, stdout="", stderr="boom", returncode=1)
    spec_path = tmp_path / "custom-spec.md"

    with patch("orchestrator.inner_loop", return_value=failure_result) as mock_inner_loop:
        exit_code = orchestrator.main([str(spec_path)])

    mock_inner_loop.assert_called_once_with(spec_path)
    assert exit_code == 1
    assert "❌" in capsys.readouterr().out
