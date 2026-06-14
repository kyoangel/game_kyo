import dataclasses
import sys
import uuid
from pathlib import Path

from agents import coder_agent, reviewer_agent
from harness import sandbox_runner, trace_logger

REPO_ROOT = Path(__file__).resolve().parent


def inner_loop(
    spec_path: Path,
    max_retries: int = 3,
    repo_root: Path | None = None,
) -> sandbox_runner.SandboxResult:
    if repo_root is None:
        repo_root = REPO_ROOT

    run_id = uuid.uuid4().hex
    feedback: str | None = None
    result: sandbox_runner.SandboxResult

    for _ in range(max_retries):
        changed_files = coder_agent.run_coder(spec_path, feedback=feedback, repo_root=repo_root)
        result = sandbox_runner.run_build_check()

        trace_logger.log_step(
            run_id=run_id,
            agent="coder",
            input=feedback,
            output=[str(p) for p in changed_files],
            result=dataclasses.asdict(result),
            traces_root=repo_root / "traces",
        )

        if result.success:
            return result

        feedback = result.stderr

    return result


def review_loop(
    spec_path: Path,
    max_retries: int = 3,
    repo_root: Path | None = None,
) -> reviewer_agent.ReviewResult:
    if repo_root is None:
        repo_root = REPO_ROOT

    changed_files = coder_agent.run_coder(spec_path, feedback=None, repo_root=repo_root)
    build_result = sandbox_runner.run_build_check()

    if not build_result.success:
        return reviewer_agent.ReviewResult(approved=False, comments=[build_result.stderr])

    return reviewer_agent.run_reviewer(changed_files, repo_root)


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    spec_path = Path(argv[0]) if argv else REPO_ROOT / "specs" / "math-merge-10.md"

    result = inner_loop(spec_path)

    if result.success:
        print("✅ inner_loop succeeded")
    else:
        print("❌ inner_loop failed")
        print(result.stderr)

    return 0 if result.success else 1


if __name__ == "__main__":
    sys.exit(main())
