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

    paths: set[str] = set()
    for line in result.stdout.splitlines():
        if not line:
            continue

        status = line[:2]
        path = line[3:]
        full_path = repo_root / path

        if status == "??" and full_path.is_dir():
            for file_path in full_path.rglob("*"):
                if file_path.is_file():
                    paths.add(str(file_path.relative_to(repo_root)))
        else:
            paths.add(path)

    return paths
