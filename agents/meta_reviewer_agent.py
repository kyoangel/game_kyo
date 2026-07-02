import subprocess
from pathlib import Path

from agents import claude_cli
from harness import prompt_store

_MAX_NEW_FILE_LINES = 200  # cap new files to avoid token explosion


def run_meta_review(
    spec_path: Path,
    changed_files: list[Path],
    repo_root: Path,
    workspace: str | None = None,
) -> list[str]:
    system_prompt = prompt_store.load("meta-reviewer", repo_root, workspace=workspace)

    spec_content = spec_path.read_text() if spec_path.exists() else "(spec not found)"

    # Use git diff for modified files; full content (capped) for new files
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

    code_section = ""
    if diff:
        code_section += f"\n\n# 程式碼變更（git diff）\n```diff\n{diff}\n```"
    if new_file_blocks:
        code_section += "\n\n# 新增檔案\n\n" + "\n\n".join(new_file_blocks)

    task = f"# 規格書\n\n{spec_content}{code_section}"

    output = claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
    )

    return [line.strip() for line in output.splitlines() if line.strip().startswith("- [ ]")]
