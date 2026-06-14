import json
from datetime import datetime
from pathlib import Path

import pytest

from harness import trace_logger


def test_log_step_appends_jsonl_lines(tmp_path: Path) -> None:
    trace_logger.log_step(
        run_id="run-test123",
        agent="coder",
        input={"task": "x"},
        output={"raw": "y"},
        result={"success": True},
        traces_root=tmp_path,
    )
    trace_logger.log_step(
        run_id="run-test123",
        agent="coder",
        input={"task": "x2"},
        output={"raw": "y2"},
        result={"success": False},
        traces_root=tmp_path,
    )

    trace_file = tmp_path / "run-test123" / "trace.jsonl"
    lines = trace_file.read_text().splitlines()

    assert len(lines) == 2
    first = json.loads(lines[0])
    second = json.loads(lines[1])
    assert first["run_id"] == "run-test123"
    assert first["agent"] == "coder"
    assert second["result"] == {"success": False}


def test_log_step_record_contains_expected_keys_and_values(tmp_path: Path) -> None:
    trace_logger.log_step(
        run_id="run-abc",
        agent="coder",
        input={"task": "do x"},
        output={"raw": "did x"},
        result={"success": True},
        traces_root=tmp_path,
    )

    record = json.loads(
        (tmp_path / "run-abc" / "trace.jsonl").read_text().splitlines()[0]
    )

    assert set(record.keys()) == {
        "run_id",
        "agent",
        "input",
        "output",
        "result",
        "timestamp",
    }
    assert record["input"] == {"task": "do x"}
    assert record["output"] == {"raw": "did x"}
    assert record["result"] == {"success": True}
    datetime.fromisoformat(record["timestamp"])  # must not raise


def test_log_step_default_traces_root_resolves_under_repo_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(trace_logger, "REPO_ROOT", tmp_path)

    trace_logger.log_step(
        run_id="run-default",
        agent="coder",
        input={},
        output={},
        result={"success": True},
    )

    assert (tmp_path / "traces" / "run-default" / "trace.jsonl").exists()
