import argparse
import dataclasses
import json
import subprocess
import sys
import uuid
from pathlib import Path

from agents import claude_cli, designer_agent, meta_reviewer_agent, reviewer_agent
from agents.claude_cli import ClaudeCliError
from harness import npm_runner, prompt_store, trace_logger, workspace_diff

REPO_ROOT = Path(__file__).resolve().parent


def _resume_path(workspace: str, repo_root: Path) -> Path:
    return repo_root / "specs" / f".{workspace}-resume.json"


def _load_resume(workspace: str, repo_root: Path) -> dict:
    p = _resume_path(workspace, repo_root)
    return json.loads(p.read_text()) if p.exists() else {}


def _save_resume(workspace: str, repo_root: Path, data: dict) -> None:
    _resume_path(workspace, repo_root).write_text(json.dumps(data))


def _clear_resume(workspace: str, repo_root: Path) -> None:
    p = _resume_path(workspace, repo_root)
    if p.exists():
        p.unlink()


def _git_commit(workspace: str, spec_path: Path, repo_root: Path, iter_n: int) -> None:
    slug = spec_path.stem
    for prefix in (f"{workspace}-", "pixel-squad-"):
        slug = slug.replace(prefix, "")
    msg = f"feat({workspace}): {slug} [autonomous loop iter {iter_n}]"

    backlog_path = repo_root / "specs" / f"{workspace}-backlog.md"
    subprocess.run(["git", "add", f"workspace-{workspace}/"], cwd=repo_root, check=True)
    subprocess.run(["git", "add", str(spec_path)], cwd=repo_root, check=True)
    if backlog_path.exists():
        subprocess.run(["git", "add", str(backlog_path)], cwd=repo_root, check=True)
    subprocess.run(["git", "commit", "-m", msg], cwd=repo_root, check=True)


def _append_meta_review(backlog_path: Path, items: list[str], spec_slug: str, repo_root: Path) -> None:
    content = backlog_path.read_text()
    section = "## 🤖 Meta-Review 建議"
    new_block = "\n".join(items)
    if section not in content:
        content = content.rstrip() + f"\n\n{section}\n\n{new_block}\n"
    else:
        # append under existing section
        content = content.rstrip() + "\n" + new_block + "\n"
    backlog_path.write_text(content)

    subprocess.run(["git", "add", str(backlog_path)], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"chore: meta-review suggestions after {spec_slug}"],
        cwd=repo_root, check=True,
    )


def autonomous_loop(
    workspace: str,
    max_iter: int = 20,
    repo_root: Path | None = None,
) -> None:
    if repo_root is None:
        repo_root = REPO_ROOT

    backlog_path = repo_root / "specs" / f"{workspace}-backlog.md"
    run_id = uuid.uuid4().hex
    workspace_dir = f"workspace-{workspace}/"

    for i in range(max_iter):
        resume = _load_resume(workspace, repo_root)
        backlog_snapshot = backlog_path.read_text() if backlog_path.exists() else ""

        # --- Designer (skip if resuming with an existing spec) ---
        if "spec_path" in resume:
            spec_path = Path(resume["spec_path"])
            print(f"↩️  Resuming spec: {spec_path.name} (Designer skipped)")
        else:
            try:
                spec_path = designer_agent.run_designer(workspace, backlog_path, repo_root)
            except ClaudeCliError as e:
                trace_logger.log_step(
                    run_id=run_id, agent="designer",
                    input={"backlog": str(backlog_path)}, output={},
                    result={"success": False, "error": str(e)},
                    traces_root=repo_root / "traces",
                )
                print(f"⚠️  Designer failed (iter {i}): {e}")
                continue
            trace_logger.log_step(
                run_id=run_id, agent="designer",
                input={"backlog": str(backlog_path)},
                output={"spec_path": str(spec_path) if spec_path else "DONE"},
                result={"iter": i, "done": spec_path is None},
                traces_root=repo_root / "traces",
            )
            if spec_path is None:
                _clear_resume(workspace, repo_root)
                print("✅ Backlog empty — loop complete")
                break
            _save_resume(workspace, repo_root, {"spec_path": str(spec_path), "qa_done": False})

        # --- QA (skip if already done for this spec) ---
        if resume.get("qa_done", False):
            print(f"↩️  QA already done for {spec_path.name} (QA skipped)")
        else:
            qa_prompt = prompt_store.load("qa", repo_root, workspace=workspace)
            try:
                claude_cli.call_coder(
                    system_prompt=qa_prompt,
                    task=spec_path.read_text(),
                    repo_root=repo_root,
                )
            except ClaudeCliError as e:
                trace_logger.log_step(
                    run_id=run_id, agent="qa",
                    input={"spec": str(spec_path)}, output={},
                    result={"success": False, "error": str(e)},
                    traces_root=repo_root / "traces",
                )
                # QA failed before writing tests — only restore backlog if Designer just ran
                if "spec_path" not in resume:
                    backlog_path.write_text(backlog_snapshot)
                    _clear_resume(workspace, repo_root)
                continue
            trace_logger.log_step(
                run_id=run_id, agent="qa",
                input={"spec": str(spec_path)}, output={},
                result={"success": True},
                traces_root=repo_root / "traces",
            )
            _save_resume(workspace, repo_root, {"spec_path": str(spec_path), "qa_done": True})

        # --- Coder + validate loop ---
        coder_prompt = prompt_store.load("coder", repo_root, workspace=workspace)
        feedback: str | None = None

        for attempt in range(6):
            before = workspace_diff.changed_paths(repo_root, workspace_dir=workspace_dir)

            try:
                claude_cli.call_coder(
                    system_prompt=coder_prompt,
                    task=spec_path.read_text(),
                    feedback=feedback,
                    repo_root=repo_root,
                )
            except ClaudeCliError as e:
                feedback = str(e)
                trace_logger.log_step(
                    run_id=run_id, agent="coder",
                    input={"feedback": feedback, "attempt": attempt}, output={},
                    result={"success": False, "error": str(e)},
                    traces_root=repo_root / "traces",
                )
                continue

            changed = sorted(workspace_diff.changed_paths(repo_root, workspace_dir=workspace_dir) - before)
            changed_paths_list = [Path(p) for p in changed]

            build = npm_runner.run_build(workspace, repo_root)
            trace_logger.log_step(
                run_id=run_id, agent="build",
                input={"attempt": attempt}, output={"changed": changed},
                result=dataclasses.asdict(build),
                traces_root=repo_root / "traces",
            )
            if not build.success:
                feedback = (build.stdout + "\n" + build.stderr).strip()
                continue

            unit = npm_runner.run_unit_tests(workspace, repo_root)
            trace_logger.log_step(
                run_id=run_id, agent="unit",
                input={"attempt": attempt}, output={},
                result=dataclasses.asdict(unit),
                traces_root=repo_root / "traces",
            )
            if not unit.success:
                feedback = (unit.stdout + "\n" + unit.stderr).strip()
                continue

            e2e = npm_runner.run_e2e_tests(workspace, repo_root)
            trace_logger.log_step(
                run_id=run_id, agent="e2e",
                input={"attempt": attempt}, output={},
                result=dataclasses.asdict(e2e),
                traces_root=repo_root / "traces",
            )
            if not e2e.success:
                feedback = (e2e.stdout + "\n" + e2e.stderr).strip()
                continue

            review = reviewer_agent.run_reviewer(changed_paths_list, repo_root)
            trace_logger.log_step(
                run_id=run_id, agent="reviewer",
                input={"changed": changed}, output={"comments": review.comments},
                result=review.model_dump(),
                traces_root=repo_root / "traces",
            )

            if review.approved:
                _git_commit(workspace, spec_path, repo_root, i)
                _clear_resume(workspace, repo_root)
                try:
                    meta_items = meta_reviewer_agent.run_meta_review(
                        spec_path, changed_paths_list, repo_root, workspace=workspace
                    )
                    if meta_items:
                        _append_meta_review(backlog_path, meta_items, spec_path.stem, repo_root)
                        print(f"🤖 Meta-review: {len(meta_items)} suggestions added to backlog")
                except Exception as e:
                    print(f"⚠️  Meta-review failed (non-fatal): {e}")
                break

            feedback = "\n".join(review.comments)
        else:
            print(f"⚠️  All Coder retries failed for iter {i} — skipping spec")
            backlog_path.write_text(backlog_snapshot)
            _clear_resume(workspace, repo_root)


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
    parser = argparse.ArgumentParser(
        description="Autonomous development loop — runs until backlog is empty."
    )
    parser.add_argument("--workspace", required=True, help="Workspace name (e.g. pixel-squad)")
    parser.add_argument("--max-iter", type=int, default=20, help="Safety cap on iterations")
    args = parser.parse_args(argv)
    autonomous_loop(args.workspace, args.max_iter)
    return 0


if __name__ == "__main__":
    sys.exit(main())
