import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def log_step(
    run_id: str,
    agent: str,
    input: dict[str, Any],
    output: dict[str, Any],
    result: dict[str, Any],
    traces_root: Path,
) -> None:
    run_dir = traces_root / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    record = {
        "run_id": run_id,
        "agent": agent,
        "input": input,
        "output": output,
        "result": result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with (run_dir / "trace.jsonl").open("a") as f:
        f.write(json.dumps(record) + "\n")
