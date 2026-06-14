from pathlib import Path

from pydantic import BaseModel


class ReviewResult(BaseModel):
    approved: bool
    comments: list[str]


def _format_changed_files(changed_files: list[Path], repo_root: Path) -> str:
    blocks = []
    for path in changed_files:
        content = (repo_root / path).read_text()
        blocks.append(f"## {path}\n{content}")

    return "\n\n".join(blocks)
