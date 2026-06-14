import subprocess
from pathlib import Path


class PromptStoreError(Exception):
    pass


def load(name: str, repo_root: Path) -> str:
    return (repo_root / "prompts" / f"{name}.txt").read_text()


def update(name: str, content: str, commit_message: str, repo_root: Path) -> str:
    rel_path = f"prompts/{name}.txt"
    (repo_root / rel_path).write_text(content)

    subprocess.run(["git", "add", rel_path], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "commit", "-m", commit_message], cwd=repo_root, check=True, capture_output=True
    )

    return subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=repo_root, capture_output=True, text=True, check=True
    ).stdout.strip()


def rollback(commit_hash: str, repo_root: Path) -> None:
    checkout = subprocess.run(
        ["git", "checkout", commit_hash, "--", "prompts/"],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    if checkout.returncode != 0:
        raise PromptStoreError(
            f"rollback to {commit_hash!r} failed: {checkout.stderr.strip()}"
        )

    subprocess.run(["git", "add", "prompts/"], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"revert: rollback prompts/ to {commit_hash}"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
