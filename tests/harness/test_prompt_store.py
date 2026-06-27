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


def test_update_writes_commits_and_returns_hash(repo: Path) -> None:
    new_hash = prompt_store.update(
        "coder", "new content\n", "test: update coder prompt", repo_root=repo
    )

    assert len(new_hash) == 40
    assert all(c in "0123456789abcdef" for c in new_hash)
    assert (repo / "prompts" / "coder.txt").read_text() == "new content\n"

    head = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=repo, capture_output=True, text=True, check=True
    ).stdout.strip()
    assert new_hash == head

    status = subprocess.run(
        ["git", "status", "--porcelain"], cwd=repo, capture_output=True, text=True, check=True
    ).stdout
    assert status == ""


def test_rollback_invalid_hash_raises_prompt_store_error(repo: Path) -> None:
    with pytest.raises(prompt_store.PromptStoreError):
        prompt_store.rollback("deadbeef", repo_root=repo)


def test_rollback_restores_prior_content(repo: Path) -> None:
    h1 = prompt_store.update("coder", "version 1\n", "v1", repo_root=repo)
    prompt_store.update("coder", "version 2\n", "v2", repo_root=repo)

    prompt_store.rollback(h1, repo_root=repo)

    assert prompt_store.load("coder", repo_root=repo) == "version 1\n"

    status = subprocess.run(
        ["git", "status", "--porcelain"], cwd=repo, capture_output=True, text=True, check=True
    ).stdout
    assert status == ""


def test_load_with_workspace_returns_workspace_specific_file(repo: Path) -> None:
    (repo / "prompts" / "coder-pixel-squad.txt").write_text("pixel-squad coder\n")
    assert prompt_store.load("coder", repo_root=repo, workspace="pixel-squad") == "pixel-squad coder\n"


def test_load_with_workspace_falls_back_to_base_when_specific_missing(repo: Path) -> None:
    assert prompt_store.load("coder", repo_root=repo, workspace="pixel-squad") == "original coder prompt\n"


def test_load_without_workspace_unchanged(repo: Path) -> None:
    assert prompt_store.load("coder", repo_root=repo) == "original coder prompt\n"
