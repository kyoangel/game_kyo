from pathlib import Path

from agents import claude_cli
from harness import prompt_store

_MAX_FILES = 10  # cap to avoid token explosion


def run_meta_review(
    spec_path: Path,
    changed_files: list[Path],
    repo_root: Path,
    workspace: str | None = None,
) -> list[str]:
    system_prompt = prompt_store.load("meta-reviewer", repo_root, workspace=workspace)

    spec_content = spec_path.read_text() if spec_path.exists() else "(spec not found)"

    file_blocks = []
    for path in changed_files[:_MAX_FILES]:
        full_path = repo_root / path
        if full_path.exists() and full_path.is_file():
            file_blocks.append(f"## {path}\n{full_path.read_text()}")

    task = (
        f"# 規格書\n\n{spec_content}"
        + ("\n\n# 本次修改的檔案\n\n" + "\n\n".join(file_blocks) if file_blocks else "")
    )

    output = claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
    )

    return [line.strip() for line in output.splitlines() if line.strip().startswith("- [ ]")]
