#!/usr/bin/env python3
"""Run qa_loop N times sequentially to build up trace data for Phase 4e."""
import pathlib
import subprocess
import sys
import traceback as tb

REPO_ROOT = pathlib.Path(__file__).parent
SPEC_PATH = REPO_ROOT / "specs" / "math-merge-10.md"
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 3


def git_commit_workspace(run_num: int) -> None:
    result = subprocess.run(
        ["git", "status", "--porcelain", "workspace/"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if result.stdout.strip():
        subprocess.run(
            ["git", "add", "workspace/"],
            cwd=REPO_ROOT,
            check=True,
        )
        subprocess.run(
            ["git", "commit", "-m", f"chore: qa_loop run {run_num} workspace changes"],
            cwd=REPO_ROOT,
            check=True,
        )
        print(f"  [committed workspace changes after run {run_num}]")
    else:
        print(f"  [no workspace changes in run {run_num}]")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(REPO_ROOT))
    from orchestrator import qa_loop

    for i in range(1, RUNS + 1):
        print(f"\n{'='*60}", flush=True)
        print(f"qa_loop run {i}/{RUNS}", flush=True)
        print('='*60, flush=True)
        try:
            result = qa_loop(SPEC_PATH, max_retries=3, repo_root=REPO_ROOT)
            print(f"  approved={result.approved}", flush=True)
            if result.comments:
                print(f"  comments[0]={result.comments[0][:120]}", flush=True)
        except Exception as e:
            print(f"  ERROR type={type(e).__name__}: {e}", flush=True)
            tb.print_exc()

        git_commit_workspace(i)

    # Summary
    import json
    print(f"\n{'='*60}", flush=True)
    traces_dir = REPO_ROOT / "traces"
    runs = sorted(traces_dir.glob("*/trace.jsonl"))
    print(f"Total trace runs now: {len(runs)}", flush=True)
    for t in runs[-5:]:
        lines = [json.loads(l) for l in t.read_text().strip().splitlines()]
        agents = [l["agent"] for l in lines]
        failures = [l for l in lines if not l.get("result", {}).get("success", True)]
        print(f"  {t.parent.name[:12]}  steps={len(lines)}  agents={agents}  failures={len(failures)}", flush=True)
    print('='*60, flush=True)
