import json
from pathlib import Path

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
