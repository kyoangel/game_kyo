import argparse
import dataclasses
import sys
import uuid
from pathlib import Path

from agents import coder_agent, qa_agent, reviewer_agent
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

    run_id = uuid.uuid4().hex
    feedback: str | None = None
    review: reviewer_agent.ReviewResult

    for _ in range(max_retries):
        changed_files = coder_agent.run_coder(spec_path, feedback=feedback, repo_root=repo_root)
        build_result = sandbox_runner.run_build_check()

        trace_logger.log_step(
            run_id=run_id,
            agent="coder",
            input=feedback,
            output=[str(p) for p in changed_files],
            result=dataclasses.asdict(build_result),
            traces_root=repo_root / "traces",
        )

        if not build_result.success:
            feedback = build_result.stderr
            review = reviewer_agent.ReviewResult(approved=False, comments=[build_result.stderr])
            continue

        review = reviewer_agent.run_reviewer(changed_files, repo_root)

        trace_logger.log_step(
            run_id=run_id,
            agent="reviewer",
            input=[str(p) for p in changed_files],
            output=review.comments,
            result=review.model_dump(),
            traces_root=repo_root / "traces",
        )

        if review.approved:
            return review

        feedback = "\n".join(review.comments)

    return review


def qa_loop(
    spec_path: Path,
    max_retries: int = 3,
    repo_root: Path | None = None,
) -> reviewer_agent.ReviewResult:
    if repo_root is None:
        repo_root = REPO_ROOT

    run_id = uuid.uuid4().hex
    feedback: str | None = None
    review: reviewer_agent.ReviewResult

    qa_changed = qa_agent.run_qa(spec_path, repo_root=repo_root)
    trace_logger.log_step(
        run_id=run_id,
        agent="qa",
        input=None,
        output=[str(p) for p in qa_changed],
        result={"changed_files": [str(p) for p in qa_changed]},
        traces_root=repo_root / "traces",
    )

    for _ in range(max_retries):
        changed_files = coder_agent.run_coder(spec_path, feedback=feedback, repo_root=repo_root)
        build_result = sandbox_runner.run_build_check()

        trace_logger.log_step(
            run_id=run_id,
            agent="coder",
            input=feedback,
            output=[str(p) for p in changed_files],
            result=dataclasses.asdict(build_result),
            traces_root=repo_root / "traces",
        )

        if not build_result.success:
            feedback = build_result.stderr
            review = reviewer_agent.ReviewResult(approved=False, comments=[build_result.stderr])
            continue

        unit_result = sandbox_runner.run_unit_tests()

        trace_logger.log_step(
            run_id=run_id,
            agent="qa",
            input=None,
            output=[],
            result=dataclasses.asdict(unit_result),
            traces_root=repo_root / "traces",
        )

        if not unit_result.success:
            feedback = unit_result.stdout
            review = reviewer_agent.ReviewResult(approved=False, comments=[unit_result.stdout])
            continue

        e2e_result = sandbox_runner.run_e2e_tests()

        trace_logger.log_step(
            run_id=run_id,
            agent="qa",
            input=None,
            output=[],
            result=dataclasses.asdict(e2e_result),
            traces_root=repo_root / "traces",
        )

        if not e2e_result.success:
            feedback = e2e_result.stdout
            review = reviewer_agent.ReviewResult(approved=False, comments=[e2e_result.stdout])
            continue

        review = reviewer_agent.run_reviewer(changed_files, repo_root)

        trace_logger.log_step(
            run_id=run_id,
            agent="reviewer",
            input=[str(p) for p in changed_files],
            output=review.comments,
            result=review.model_dump(),
            traces_root=repo_root / "traces",
        )

        if review.approved:
            return review

        feedback = "\n".join(review.comments)

    return review


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    parser = argparse.ArgumentParser()
    parser.add_argument("spec", nargs="?", default=None)
    parser.add_argument("--loop", choices=["inner", "qa"], default="inner")
    args = parser.parse_args(argv)

    spec_path = Path(args.spec) if args.spec else REPO_ROOT / "specs" / "math-merge-10.md"

    if args.loop == "qa":
        result = qa_loop(spec_path)
        success = result.approved
        detail = "\n".join(result.comments)
    else:
        result = inner_loop(spec_path)
        success = result.success
        detail = result.stderr

    if success:
        print(f"✅ {args.loop}_loop succeeded")
    else:
        print(f"❌ {args.loop}_loop failed")
        print(detail)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
