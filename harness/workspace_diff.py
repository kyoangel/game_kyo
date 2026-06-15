import subprocess
from pathlib import Path


def changed_paths(repo_root: Path) -> set[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain", "workspace/"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=True,
    )
    return {line[3:] for line in result.stdout.splitlines() if line}
