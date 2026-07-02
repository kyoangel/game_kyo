import subprocess
from pathlib import Path

from agents import claude_cli, lm_studio_client
from agents.lm_studio_client import LmStudioError
from harness import prompt_store

_MAX_NEW_FILE_LINES = 200


def _get_code_section(changed_files: list[Path], repo_root: Path) -> str:
    diff_result = subprocess.run(
        ["git", "diff", "HEAD", "--"] + [str(p) for p in changed_files],
        cwd=repo_root, capture_output=True, text=True,
    )
    diff = diff_result.stdout.strip()

    new_file_blocks = []
    for path in changed_files:
        full_path = repo_root / path
        if not full_path.exists() or not full_path.is_file():
            continue
        is_new = subprocess.run(
            ["git", "ls-files", "--error-unmatch", str(path)],
            cwd=repo_root, capture_output=True,
        ).returncode != 0
        if is_new:
            lines = full_path.read_text().splitlines()
            preview = "\n".join(lines[:_MAX_NEW_FILE_LINES])
            if len(lines) > _MAX_NEW_FILE_LINES:
                preview += f"\n... ({len(lines) - _MAX_NEW_FILE_LINES} more lines truncated)"
            new_file_blocks.append(f"### New file: {path}\n{preview}")

    parts = []
    if diff:
        parts.append(f"# 程式碼變更（git diff）\n```diff\n{diff}\n```")
    if new_file_blocks:
        parts.append("# 新增檔案\n\n" + "\n\n".join(new_file_blocks))
    return "\n\n".join(parts)


def run_meta_review(
    spec_path: Path,
    changed_files: list[Path],
    repo_root: Path,
    workspace: str | None = None,
) -> list[str]:
    system_prompt = prompt_store.load("meta-reviewer", repo_root, workspace=workspace)
    spec_content = spec_path.read_text() if spec_path.exists() else "(spec not found)"
    code_section = _get_code_section(changed_files, repo_root)
    task = f"# 規格書\n\n{spec_content}\n\n{code_section}"

    if lm_studio_client.is_available():
        print("🤖 Using LM Studio for Meta-reviewer")
        try:
            output = lm_studio_client.call_lm_studio(system_prompt, task)
            items = [l.strip() for l in output.splitlines() if l.strip().startswith("- [ ]")]
            if items:
                return items
            print("⚠️  LM Studio meta-reviewer returned no items — falling back to Claude CLI")
        except LmStudioError as e:
            print(f"⚠️  LM Studio meta-reviewer failed: {e} — falling back to Claude CLI")

    output = claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
    )
    return [l.strip() for l in output.splitlines() if l.strip().startswith("- [ ]")]
