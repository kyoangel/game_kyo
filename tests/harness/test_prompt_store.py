import subprocess
from pathlib import Path

import pytest

from harness import prompt_store


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    repo_root = tmp_path
    (repo_root / "prompts").mkdir()
    (repo_root / "prompts" / "coder.txt").write_text("original coder prompt\n")

    subprocess.run(["git", "init"], cwd=repo_root, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"], cwd=repo_root, check=True
    )
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo_root, check=True)
    subprocess.run(["git", "add", "prompts/coder.txt"], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "commit", "-m", "init"], cwd=repo_root, check=True, capture_output=True
    )

    return repo_root


def test_load_returns_prompt_content(repo: Path) -> None:
    assert prompt_store.load("coder", repo_root=repo) == "original coder prompt\n"


def test_load_missing_prompt_raises_file_not_found(repo: Path) -> None:
    with pytest.raises(FileNotFoundError):
        prompt_store.load("nonexistent", repo_root=repo)
