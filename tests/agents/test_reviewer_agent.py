from pathlib import Path
from unittest.mock import patch

from agents import reviewer_agent
from agents.reviewer_agent import ReviewResult, _format_changed_files


def test_review_result_has_approved_and_comments_fields() -> None:
    result = ReviewResult(approved=True, comments=["looks good"])
    assert result.approved is True
    assert result.comments == ["looks good"]


def test_format_changed_files_renders_each_file_content(tmp_path: Path) -> None:
    (tmp_path / "workspace").mkdir()
    (tmp_path / "workspace" / "grid.ts").write_text("export const x = 1;\n")
    (tmp_path / "workspace" / "game.ts").write_text("export const y = 2;\n")

    changed_files = [Path("workspace/grid.ts"), Path("workspace/game.ts")]

    formatted = _format_changed_files(changed_files, repo_root=tmp_path)

    assert "## workspace/grid.ts" in formatted
    assert "export const x = 1;" in formatted
    assert "## workspace/game.ts" in formatted
    assert "export const y = 2;" in formatted


def test_run_reviewer_loads_prompt_and_calls_gemini(tmp_path: Path) -> None:
    (tmp_path / "workspace").mkdir()
    (tmp_path / "workspace" / "grid.ts").write_text("export const x = 1;\n")

    changed_files = [Path("workspace/grid.ts")]
    expected = ReviewResult(approved=True, comments=[])

    with patch(
        "agents.reviewer_agent.prompt_store.load", return_value="REVIEWER SYSTEM PROMPT"
    ) as mock_load, patch(
        "agents.reviewer_agent.gemini_client.call_gemini", return_value=expected
    ) as mock_call:
        result = reviewer_agent.run_reviewer(changed_files, repo_root=tmp_path)

    mock_load.assert_called_once_with("reviewer", tmp_path)
    mock_call.assert_called_once_with(
        system_prompt="REVIEWER SYSTEM PROMPT",
        task=_format_changed_files(changed_files, repo_root=tmp_path),
        response_schema=ReviewResult,
    )
    assert result == expected


def test_format_changed_files_empty_list_returns_placeholder(tmp_path: Path) -> None:
    assert _format_changed_files([], repo_root=tmp_path) == "No files were changed."


def test_format_changed_files_marks_deleted_files_without_crashing(tmp_path: Path) -> None:
    (tmp_path / "workspace").mkdir()
    (tmp_path / "workspace" / "kept.ts").write_text("export const x = 1;\n")

    changed_files = [Path("workspace/kept.ts"), Path("workspace/deleted.ts")]

    formatted = _format_changed_files(changed_files, repo_root=tmp_path)

    assert "## workspace/kept.ts" in formatted
    assert "export const x = 1;" in formatted
    assert "## workspace/deleted.ts" in formatted
    assert "deleted" in formatted.lower()


def test_format_changed_files_marks_directories_without_crashing(tmp_path: Path) -> None:
    (tmp_path / "workspace" / "public").mkdir(parents=True)

    changed_files = [Path("workspace/public")]

    formatted = _format_changed_files(changed_files, repo_root=tmp_path)

    assert "## workspace/public" in formatted
    assert "directory" in formatted.lower()


def test_format_changed_files_truncates_large_files(tmp_path: Path) -> None:
    (tmp_path / "workspace").mkdir()
    lines = [f"line {i}" for i in range(300)]
    (tmp_path / "workspace" / "big.ts").write_text("\n".join(lines))

    formatted = _format_changed_files([Path("workspace/big.ts")], repo_root=tmp_path)

    assert "line 0" in formatted
    assert "line 199" in formatted
    assert "line 200" not in formatted
    assert "truncated" in formatted
