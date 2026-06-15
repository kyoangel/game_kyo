import subprocess
from pathlib import Path
from unittest.mock import patch

from agents import qa_agent


def test_run_qa_loads_prompt_and_calls_claude_cli(repo: Path) -> None:
    spec_path = repo / "spec.md"
    spec_path.write_text("Build a snake game")

    with patch(
        "agents.qa_agent.prompt_store.load", return_value="QA SYSTEM PROMPT"
    ) as mock_load, patch(
        "agents.qa_agent.claude_cli.call_coder", return_value="done"
    ) as mock_call:
        qa_agent.run_qa(spec_path, repo_root=repo)

    mock_load.assert_called_once_with("qa", repo)
    mock_call.assert_called_once_with(
        system_prompt="QA SYSTEM PROMPT",
        task="Build a snake game",
        repo_root=repo,
    )


def test_run_qa_returns_changed_test_files(repo: Path) -> None:
    unit_dir = repo / "workspace" / "tests" / "unit"
    unit_dir.mkdir(parents=True)
    (unit_dir / ".gitkeep").write_text("")
    subprocess.run(["git", "add", "."], cwd=repo, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "add tests/unit dir"], cwd=repo, check=True, capture_output=True
    )

    def fake_call_coder(**kwargs):
        (unit_dir / "grid.test.ts").write_text("test('x', () => {});\n")
        return "done"

    spec_path = repo / "spec.md"
    spec_path.write_text("Add grid tests")

    with patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), patch(
        "agents.qa_agent.claude_cli.call_coder", side_effect=fake_call_coder
    ):
        changed = qa_agent.run_qa(spec_path, repo_root=repo)

    assert changed == [Path("workspace/tests/unit/grid.test.ts")]


def test_run_qa_returns_empty_list_for_preexisting_changes_only(repo: Path) -> None:
    (repo / "workspace" / "preexisting.ts").write_text("export const y = 2;\n")

    spec_path = repo / "spec.md"
    spec_path.write_text("Do nothing")

    with patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), patch(
        "agents.qa_agent.claude_cli.call_coder", return_value="done"
    ):
        changed = qa_agent.run_qa(spec_path, repo_root=repo)

    assert changed == []
