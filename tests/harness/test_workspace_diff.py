import subprocess
from pathlib import Path

import pytest

from harness import workspace_diff


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, check=True, capture_output=True)

    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "README.md").write_text("placeholder\n")

    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "initial commit"], cwd=tmp_path, check=True, capture_output=True)

    return tmp_path


def test_changed_paths_returns_empty_set_for_clean_workspace(repo: Path) -> None:
    assert workspace_diff.changed_paths(repo) == set()


def test_changed_paths_detects_new_and_modified_files(repo: Path) -> None:
    (repo / "workspace" / "new_file.ts").write_text("export const x = 1;\n")
    (repo / "workspace" / "README.md").write_text("changed\n")

    assert workspace_diff.changed_paths(repo) == {"workspace/new_file.ts", "workspace/README.md"}


def test_changed_paths_expands_new_untracked_directory_to_its_files(repo: Path) -> None:
    icons_dir = repo / "workspace" / "public" / "icons"
    icons_dir.mkdir(parents=True)
    (repo / "workspace" / "public" / "manifest.json").write_text("{}\n")
    (icons_dir / "icon.svg").write_text("<svg></svg>\n")

    assert workspace_diff.changed_paths(repo) == {
        "workspace/public/manifest.json",
        "workspace/public/icons/icon.svg",
    }


def test_changed_paths_uses_custom_workspace_dir(repo: Path) -> None:
    alt_workspace = repo / "workspace-pixel-squad"
    alt_workspace.mkdir()
    (alt_workspace / "new_file.ts").write_text("export const x = 1;\n")

    result = workspace_diff.changed_paths(repo, workspace_dir="workspace-pixel-squad/")
    assert result == {"workspace-pixel-squad/new_file.ts"}


def test_changed_paths_default_workspace_dir_unchanged(repo: Path) -> None:
    (repo / "workspace" / "new_file.ts").write_text("export const y = 2;\n")
    result = workspace_diff.changed_paths(repo)
    assert "workspace/new_file.ts" in result
