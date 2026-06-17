import dataclasses
import json
from pathlib import Path
from unittest.mock import patch

import pytest

import orchestrator
from agents.claude_cli import ClaudeCliError
from agents.reviewer_agent import ReviewResult
from harness import spec_cache as spec_cache_module
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


def test_main_with_qa_loop_flag_calls_qa_loop_and_returns_zero_on_approval(capsys) -> None:
    approved_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator.qa_loop", return_value=approved_result) as mock_qa_loop:
        exit_code = orchestrator.main(["--loop", "qa"])

    mock_qa_loop.assert_called_once_with(orchestrator.REPO_ROOT / "specs" / "math-merge-10.md")
    assert exit_code == 0
    assert "✅" in capsys.readouterr().out


def test_main_with_qa_loop_flag_uses_provided_spec_path_and_returns_one_on_rejection(
    tmp_path: Path, capsys
) -> None:
    rejected_result = ReviewResult(approved=False, comments=["needs more tests"])
    spec_path = tmp_path / "custom-spec.md"

    with patch("orchestrator.qa_loop", return_value=rejected_result) as mock_qa_loop:
        exit_code = orchestrator.main(["--loop", "qa", str(spec_path)])

    mock_qa_loop.assert_called_once_with(spec_path)
    assert exit_code == 1
    out = capsys.readouterr().out
    assert "❌" in out
    assert "needs more tests" in out


def test_review_loop_happy_path_build_passes_and_review_approves(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    with patch(
        "orchestrator.coder_agent.run_coder", return_value=[Path("workspace/grid.ts")]
    ) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ) as mock_build_check, patch(
        "orchestrator.reviewer_agent.run_reviewer", return_value=review_result
    ) as mock_run_reviewer:
        result = orchestrator.review_loop(spec_path, repo_root=tmp_path)

    mock_run_coder.assert_called_once_with(spec_path, feedback=None, repo_root=tmp_path)
    mock_build_check.assert_called_once()
    mock_run_reviewer.assert_called_once_with([Path("workspace/grid.ts")], tmp_path)
    assert result == review_result


def test_review_loop_retries_run_coder_on_build_failure(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_results = [
        SandboxResult(success=False, stdout="", stderr="tsc error: foo", returncode=1),
        SandboxResult(success=True, stdout="ok", stderr="", returncode=0),
    ]
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator.coder_agent.run_coder", return_value=[]) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", side_effect=build_results
    ), patch("orchestrator.reviewer_agent.run_reviewer", return_value=review_result) as mock_run_reviewer:
        result = orchestrator.review_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_run_coder.call_count == 2
    assert mock_run_reviewer.call_count == 1

    feedback_args = [call.kwargs["feedback"] for call in mock_run_coder.call_args_list]
    assert feedback_args == [None, "tsc error: foo"]
    assert result == review_result


def test_review_loop_retries_run_coder_on_review_rejection(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    review_results = [
        ReviewResult(approved=False, comments=["Avoid `any` types"]),
        ReviewResult(approved=True, comments=[]),
    ]

    with patch("orchestrator.coder_agent.run_coder", return_value=[]) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ), patch("orchestrator.reviewer_agent.run_reviewer", side_effect=review_results) as mock_run_reviewer:
        result = orchestrator.review_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_run_coder.call_count == 2
    assert mock_run_reviewer.call_count == 2

    feedback_args = [call.kwargs["feedback"] for call in mock_run_coder.call_args_list]
    assert feedback_args == [None, "Avoid `any` types"]
    assert result == review_results[1]


def test_review_loop_returns_last_rejection_when_retries_exhausted(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    review_results = [
        ReviewResult(approved=False, comments=["C1"]),
        ReviewResult(approved=False, comments=["C2"]),
    ]

    with patch("orchestrator.coder_agent.run_coder", return_value=[]) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ), patch("orchestrator.reviewer_agent.run_reviewer", side_effect=review_results) as mock_run_reviewer:
        result = orchestrator.review_loop(spec_path, max_retries=2, repo_root=tmp_path)

    assert mock_run_coder.call_count == 2
    assert mock_run_reviewer.call_count == 2
    assert result == review_results[1]
    assert result.approved is False


def test_review_loop_logs_coder_and_reviewer_attempts(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_results = [
        SandboxResult(success=False, stdout="", stderr="tsc error: foo", returncode=1),
        SandboxResult(success=True, stdout="ok", stderr="", returncode=0),
    ]
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator.coder_agent.run_coder", return_value=[]), patch(
        "orchestrator.sandbox_runner.run_build_check", side_effect=build_results
    ), patch("orchestrator.reviewer_agent.run_reviewer", return_value=review_result), patch(
        "orchestrator.trace_logger.log_step"
    ) as mock_log_step:
        orchestrator.review_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_log_step.call_count == 3

    agents_logged = [call.kwargs["agent"] for call in mock_log_step.call_args_list]
    assert agents_logged == ["coder", "coder", "reviewer"]

    run_ids = {call.kwargs["run_id"] for call in mock_log_step.call_args_list}
    assert len(run_ids) == 1

    reviewer_call = mock_log_step.call_args_list[2]
    assert reviewer_call.kwargs["result"] == review_result.model_dump()


def test_qa_loop_skips_all_llm_agents_when_preflight_passes(tmp_path: Path) -> None:
    """If build+unit+e2e all pass before any LLM call, qa_loop must return approved=True
    without calling qa_agent, coder_agent, or reviewer_agent — zero tokens spent."""
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    ok = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)

    with patch("orchestrator.sandbox_runner.run_build_check", return_value=ok) as mock_build, \
         patch("orchestrator.sandbox_runner.run_unit_tests", return_value=ok) as mock_unit, \
         patch("orchestrator.sandbox_runner.run_e2e_tests", return_value=ok) as mock_e2e, \
         patch("orchestrator.qa_agent.run_qa") as mock_qa, \
         patch("orchestrator.coder_agent.run_coder") as mock_coder, \
         patch("orchestrator.reviewer_agent.run_reviewer") as mock_reviewer, \
         patch("orchestrator.trace_logger.log_step") as mock_log:
        result = orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    assert result.approved is True
    mock_qa.assert_not_called()
    mock_coder.assert_not_called()
    mock_reviewer.assert_not_called()
    # One preflight trace step should be logged
    logged_agents = [c.kwargs["agent"] for c in mock_log.call_args_list]
    assert "preflight" in logged_agents


def test_qa_loop_runs_llm_agents_when_preflight_unit_tests_fail(tmp_path: Path) -> None:
    """If unit tests fail in pre-flight, qa_loop must proceed to LLM agents."""
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    ok = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    fail = SandboxResult(success=False, stdout="1 failed", stderr="", returncode=1)
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator.sandbox_runner.run_build_check", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_unit_tests", side_effect=[fail, ok, ok]), \
         patch("orchestrator.sandbox_runner.run_e2e_tests", return_value=ok), \
         patch("orchestrator.qa_agent.run_qa", return_value=[]) as mock_qa, \
         patch("orchestrator.coder_agent.run_coder", return_value=[]) as mock_coder, \
         patch("orchestrator.reviewer_agent.run_reviewer", return_value=review_result), \
         patch("orchestrator.trace_logger.log_step"):
        result = orchestrator.qa_loop(spec_path, max_retries=1, repo_root=tmp_path)

    mock_qa.assert_called_once()
    mock_coder.assert_called_once()


def test_qa_loop_happy_path_runs_qa_once_then_build_unit_e2e_review_pass(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    qa_changed = [Path("workspace/tests/unit/grid.test.ts")]
    coder_changed = [Path("workspace/src/grid.ts")]
    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    unit_result = SandboxResult(success=True, stdout="5 passed", stderr="", returncode=0)
    e2e_result = SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator._run_preflight", return_value=False), patch(
        "orchestrator.qa_agent.run_qa", return_value=qa_changed
    ) as mock_run_qa, patch(
        "orchestrator.coder_agent.run_coder", return_value=coder_changed
    ) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ) as mock_build_check, patch(
        "orchestrator.sandbox_runner.run_unit_tests", return_value=unit_result
    ) as mock_unit_tests, patch(
        "orchestrator.sandbox_runner.run_e2e_tests", return_value=e2e_result
    ) as mock_e2e_tests, patch(
        "orchestrator.reviewer_agent.run_reviewer", return_value=review_result
    ) as mock_run_reviewer, patch(
        "orchestrator.trace_logger.log_step"
    ) as mock_log_step:
        result = orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    mock_run_qa.assert_called_once_with(spec_path, repo_root=tmp_path)
    mock_run_coder.assert_called_once_with(spec_path, feedback=None, repo_root=tmp_path)
    mock_build_check.assert_called_once()
    mock_unit_tests.assert_called_once()
    mock_e2e_tests.assert_called_once()
    mock_run_reviewer.assert_called_once_with(coder_changed, tmp_path)
    assert result == review_result

    agents_logged = [call.kwargs["agent"] for call in mock_log_step.call_args_list]
    assert agents_logged == ["qa", "coder", "qa", "qa", "reviewer"]

    run_ids = {call.kwargs["run_id"] for call in mock_log_step.call_args_list}
    assert len(run_ids) == 1


def test_qa_loop_retries_run_coder_on_unit_test_failure(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    unit_results = [
        SandboxResult(success=False, stdout="FAIL grid.test.ts", stderr="", returncode=1),
        SandboxResult(success=True, stdout="5 passed", stderr="", returncode=0),
    ]
    e2e_result = SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    coder_changed = [Path("workspace/src/grid.ts")]

    with patch("orchestrator._run_preflight", return_value=False), patch(
        "orchestrator.qa_agent.run_qa", return_value=[]
    ), patch(
        "orchestrator.coder_agent.run_coder", return_value=coder_changed
    ) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ) as mock_build_check, patch(
        "orchestrator.sandbox_runner.run_unit_tests", side_effect=unit_results
    ) as mock_unit_tests, patch(
        "orchestrator.sandbox_runner.run_e2e_tests", return_value=e2e_result
    ) as mock_e2e_tests, patch(
        "orchestrator.reviewer_agent.run_reviewer", return_value=review_result
    ) as mock_run_reviewer:
        result = orchestrator.qa_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_run_coder.call_count == 2
    assert mock_build_check.call_count == 2
    assert mock_unit_tests.call_count == 2
    assert mock_e2e_tests.call_count == 1
    assert mock_run_reviewer.call_count == 1

    feedback_args = [call.kwargs["feedback"] for call in mock_run_coder.call_args_list]
    assert feedback_args == [None, "FAIL grid.test.ts"]
    assert result == review_result


def test_qa_loop_retries_run_coder_on_e2e_test_failure(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    unit_result = SandboxResult(success=True, stdout="5 passed", stderr="", returncode=0)
    e2e_results = [
        SandboxResult(success=False, stdout="FAIL math-merge.spec.ts", stderr="", returncode=1),
        SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0),
    ]
    review_result = ReviewResult(approved=True, comments=[])

    coder_changed = [Path("workspace/src/grid.ts")]

    with patch("orchestrator._run_preflight", return_value=False), patch(
        "orchestrator.qa_agent.run_qa", return_value=[]
    ), patch(
        "orchestrator.coder_agent.run_coder", return_value=coder_changed
    ) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ) as mock_build_check, patch(
        "orchestrator.sandbox_runner.run_unit_tests", return_value=unit_result
    ) as mock_unit_tests, patch(
        "orchestrator.sandbox_runner.run_e2e_tests", side_effect=e2e_results
    ) as mock_e2e_tests, patch(
        "orchestrator.reviewer_agent.run_reviewer", return_value=review_result
    ) as mock_run_reviewer:
        result = orchestrator.qa_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_run_coder.call_count == 2
    assert mock_build_check.call_count == 2
    assert mock_unit_tests.call_count == 2
    assert mock_e2e_tests.call_count == 2
    assert mock_run_reviewer.call_count == 1

    feedback_args = [call.kwargs["feedback"] for call in mock_run_coder.call_args_list]
    assert feedback_args == [None, "FAIL math-merge.spec.ts"]
    assert result == review_result


def test_qa_loop_retries_run_coder_on_review_rejection(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    unit_result = SandboxResult(success=True, stdout="5 passed", stderr="", returncode=0)
    e2e_result = SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0)
    review_results = [
        ReviewResult(approved=False, comments=["Avoid `any` types"]),
        ReviewResult(approved=True, comments=[]),
    ]

    coder_changed = [Path("workspace/src/grid.ts")]

    with patch("orchestrator._run_preflight", return_value=False), patch(
        "orchestrator.qa_agent.run_qa", return_value=[]
    ), patch(
        "orchestrator.coder_agent.run_coder", return_value=coder_changed
    ) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ), patch(
        "orchestrator.sandbox_runner.run_unit_tests", return_value=unit_result
    ), patch(
        "orchestrator.sandbox_runner.run_e2e_tests", return_value=e2e_result
    ), patch(
        "orchestrator.reviewer_agent.run_reviewer", side_effect=review_results
    ) as mock_run_reviewer:
        result = orchestrator.qa_loop(spec_path, max_retries=3, repo_root=tmp_path)

    assert mock_run_coder.call_count == 2
    assert mock_run_reviewer.call_count == 2

    feedback_args = [call.kwargs["feedback"] for call in mock_run_coder.call_args_list]
    assert feedback_args == [None, "Avoid `any` types"]
    assert result == review_results[1]


def test_qa_loop_approves_without_calling_reviewer_when_coder_makes_no_changes_and_checks_pass(
    tmp_path: Path,
) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    unit_result = SandboxResult(success=True, stdout="5 passed", stderr="", returncode=0)
    e2e_result = SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0)

    with patch("orchestrator._run_preflight", return_value=False), patch(
        "orchestrator.qa_agent.run_qa", return_value=[]
    ), patch(
        "orchestrator.coder_agent.run_coder", return_value=[]
    ) as mock_run_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ), patch(
        "orchestrator.sandbox_runner.run_unit_tests", return_value=unit_result
    ), patch(
        "orchestrator.sandbox_runner.run_e2e_tests", return_value=e2e_result
    ), patch(
        "orchestrator.reviewer_agent.run_reviewer"
    ) as mock_run_reviewer, patch(
        "orchestrator.trace_logger.log_step"
    ) as mock_log_step:
        result = orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    mock_run_reviewer.assert_not_called()
    assert mock_run_coder.call_count == 1
    assert result.approved is True

    agents_logged = [call.kwargs["agent"] for call in mock_log_step.call_args_list]
    assert agents_logged == ["qa", "coder", "qa", "qa", "reviewer"]


@pytest.mark.gemini
def test_review_loop_real_gemini_review_with_no_changed_files() -> None:
    traces_root = orchestrator.REPO_ROOT / "traces"
    before = set(traces_root.iterdir()) if traces_root.exists() else set()

    with patch("orchestrator.coder_agent.run_coder", return_value=[]):
        result = orchestrator.review_loop(
            orchestrator.REPO_ROOT / "specs" / "math-merge-10.md",
            max_retries=1,
        )

    assert isinstance(result, ReviewResult)

    after = set(traces_root.iterdir())
    new_dirs = after - before
    assert len(new_dirs) == 1

    lines = (new_dirs.pop() / "trace.jsonl").read_text().strip().splitlines()
    records = [json.loads(line) for line in lines]
    agents_logged = [r["agent"] for r in records]
    assert agents_logged == ["coder", "reviewer"]


def test_qa_loop_logs_qa_failure_and_continues_when_run_qa_raises(tmp_path: Path) -> None:
    """ClaudeCliError from qa_agent.run_qa must be caught, logged as success=False,
    and used as initial feedback for run_coder — the loop must not crash."""
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("spec")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    unit_result = SandboxResult(success=True, stdout="5 passed", stderr="", returncode=0)
    e2e_result = SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator._run_preflight", return_value=False), patch(
        "orchestrator.qa_agent.run_qa", side_effect=ClaudeCliError("claude exited with code 1")
    ), patch(
        "orchestrator.coder_agent.run_coder", return_value=[]
    ) as mock_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ), patch(
        "orchestrator.sandbox_runner.run_unit_tests", return_value=unit_result
    ), patch(
        "orchestrator.sandbox_runner.run_e2e_tests", return_value=e2e_result
    ), patch(
        "orchestrator.reviewer_agent.run_reviewer", return_value=review_result
    ), patch(
        "orchestrator.trace_logger.log_step"
    ) as mock_log:
        result = orchestrator.qa_loop(spec_path, max_retries=1, repo_root=tmp_path)

    assert isinstance(result, ReviewResult), "qa_loop must not raise"
    first_log = mock_log.call_args_list[0]
    assert first_log.kwargs["agent"] == "qa"
    assert first_log.kwargs["result"]["success"] is False
    mock_coder.assert_called_once_with(
        spec_path, feedback="claude exited with code 1", repo_root=tmp_path
    )


def test_qa_loop_logs_coder_failure_and_retries_when_run_coder_raises(tmp_path: Path) -> None:
    """ClaudeCliError from coder_agent.run_coder must be caught, logged, and retried
    with the error message fed back as feedback on the next iteration."""
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("spec")

    build_result = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    unit_result = SandboxResult(success=True, stdout="5 passed", stderr="", returncode=0)
    e2e_result = SandboxResult(success=True, stdout="3 passed", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator._run_preflight", return_value=False), patch(
        "orchestrator.qa_agent.run_qa", return_value=[]
    ), patch(
        "orchestrator.coder_agent.run_coder",
        side_effect=[ClaudeCliError("coder crashed"), []],
    ) as mock_coder, patch(
        "orchestrator.sandbox_runner.run_build_check", return_value=build_result
    ), patch(
        "orchestrator.sandbox_runner.run_unit_tests", return_value=unit_result
    ), patch(
        "orchestrator.sandbox_runner.run_e2e_tests", return_value=e2e_result
    ), patch(
        "orchestrator.reviewer_agent.run_reviewer", return_value=review_result
    ), patch(
        "orchestrator.trace_logger.log_step"
    ) as mock_log:
        result = orchestrator.qa_loop(spec_path, max_retries=2, repo_root=tmp_path)

    assert result.approved is True, "must recover and eventually approve"
    coder_logs = [c for c in mock_log.call_args_list if c.kwargs.get("agent") == "coder"]
    assert coder_logs[0].kwargs["result"]["success"] is False
    assert mock_coder.call_args_list[1].kwargs["feedback"] == "coder crashed"


def test_qa_loop_skips_qa_agent_when_spec_hash_unchanged(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")
    ok = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator._run_preflight", return_value=False), \
         patch("orchestrator.spec_cache.load_cached_hash",
               return_value=spec_cache_module.get_spec_hash(spec_path)), \
         patch("orchestrator.spec_cache.save_cached_hash"), \
         patch("orchestrator.qa_agent.run_qa") as mock_qa, \
         patch("orchestrator.coder_agent.run_coder", return_value=[]), \
         patch("orchestrator.sandbox_runner.run_build_check", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_unit_tests", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_e2e_tests", return_value=ok), \
         patch("orchestrator.reviewer_agent.run_reviewer", return_value=review_result), \
         patch("orchestrator.trace_logger.log_step"):
        orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    mock_qa.assert_not_called()


def test_qa_loop_calls_qa_agent_when_spec_hash_changed(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")
    ok = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator._run_preflight", return_value=False), \
         patch("orchestrator.spec_cache.load_cached_hash", return_value="stale_hash"), \
         patch("orchestrator.spec_cache.save_cached_hash"), \
         patch("orchestrator.qa_agent.run_qa", return_value=[]) as mock_qa, \
         patch("orchestrator.coder_agent.run_coder", return_value=[]), \
         patch("orchestrator.sandbox_runner.run_build_check", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_unit_tests", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_e2e_tests", return_value=ok), \
         patch("orchestrator.reviewer_agent.run_reviewer", return_value=review_result), \
         patch("orchestrator.trace_logger.log_step"):
        orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    mock_qa.assert_called_once()


def test_qa_loop_saves_spec_hash_on_approval(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")
    ok = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator._run_preflight", return_value=False), \
         patch("orchestrator.spec_cache.load_cached_hash", return_value=None), \
         patch("orchestrator.spec_cache.save_cached_hash") as mock_save, \
         patch("orchestrator.qa_agent.run_qa", return_value=[]), \
         patch("orchestrator.coder_agent.run_coder", return_value=[]), \
         patch("orchestrator.sandbox_runner.run_build_check", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_unit_tests", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_e2e_tests", return_value=ok), \
         patch("orchestrator.reviewer_agent.run_reviewer", return_value=review_result), \
         patch("orchestrator.trace_logger.log_step"):
        orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    mock_save.assert_called_once_with(spec_path, tmp_path)


def test_qa_loop_skips_reviewer_when_all_changed_files_are_test_files(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("spec")
    ok = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    test_only = [Path("workspace/tests/unit/grid.test.ts")]

    with patch("orchestrator._run_preflight", return_value=False), \
         patch("orchestrator.spec_cache.load_cached_hash", return_value=None), \
         patch("orchestrator.spec_cache.save_cached_hash"), \
         patch("orchestrator.qa_agent.run_qa", return_value=[]), \
         patch("orchestrator.coder_agent.run_coder", return_value=test_only), \
         patch("orchestrator.sandbox_runner.run_build_check", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_unit_tests", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_e2e_tests", return_value=ok), \
         patch("orchestrator.reviewer_agent.run_reviewer") as mock_reviewer, \
         patch("orchestrator.trace_logger.log_step"):
        result = orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    mock_reviewer.assert_not_called()
    assert result.approved is True


def test_qa_loop_calls_reviewer_when_src_files_are_changed(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("spec")
    ok = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    src_files = [Path("workspace/src/grid.ts")]
    review_result = ReviewResult(approved=True, comments=[])

    with patch("orchestrator._run_preflight", return_value=False), \
         patch("orchestrator.spec_cache.load_cached_hash", return_value=None), \
         patch("orchestrator.spec_cache.save_cached_hash"), \
         patch("orchestrator.qa_agent.run_qa", return_value=[]), \
         patch("orchestrator.coder_agent.run_coder", return_value=src_files), \
         patch("orchestrator.sandbox_runner.run_build_check", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_unit_tests", return_value=ok), \
         patch("orchestrator.sandbox_runner.run_e2e_tests", return_value=ok), \
         patch("orchestrator.reviewer_agent.run_reviewer", return_value=review_result) as mock_reviewer, \
         patch("orchestrator.trace_logger.log_step"):
        orchestrator.qa_loop(spec_path, repo_root=tmp_path)

    mock_reviewer.assert_called_once()


@pytest.mark.docker
def test_qa_loop_real_sandbox_with_no_changed_files_auto_approves() -> None:
    traces_root = orchestrator.REPO_ROOT / "traces"
    before = set(traces_root.iterdir()) if traces_root.exists() else set()

    with patch("orchestrator.qa_agent.run_qa", return_value=[]), patch(
        "orchestrator.coder_agent.run_coder", return_value=[]
    ):
        result = orchestrator.qa_loop(
            orchestrator.REPO_ROOT / "specs" / "math-merge-10.md",
            max_retries=1,
        )

    assert result.approved is True

    after = set(traces_root.iterdir())
    new_dirs = after - before
    assert len(new_dirs) == 1

    lines = (new_dirs.pop() / "trace.jsonl").read_text().strip().splitlines()
    records = [json.loads(line) for line in lines]
    agents_logged = [r["agent"] for r in records]
    assert agents_logged == ["qa", "coder", "qa", "qa", "reviewer"]
