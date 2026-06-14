from pathlib import Path
from unittest.mock import patch

from agents import coder_agent


def test_run_coder_loads_prompt_and_passes_feedback(repo: Path) -> None:
    spec_path = repo / "spec.md"
    spec_path.write_text("Build a snake game")

    with patch(
        "agents.coder_agent.prompt_store.load", return_value="SYSTEM PROMPT"
    ) as mock_load, patch(
        "agents.coder_agent.claude_cli.call_coder", return_value="done"
    ) as mock_call:
        coder_agent.run_coder(spec_path, feedback="fix this", repo_root=repo)

    mock_load.assert_called_once_with("coder", repo)
    mock_call.assert_called_once_with(
        system_prompt="SYSTEM PROMPT",
        task="Build a snake game",
        feedback="fix this",
        repo_root=repo,
    )


def test_run_coder_returns_changed_workspace_files(repo: Path) -> None:
    def fake_call_coder(**kwargs):
        (repo / "workspace" / "new_file.ts").write_text("export const x = 1;\n")
        return "done"

    spec_path = repo / "spec.md"
    spec_path.write_text("Add new_file.ts")

    with patch("agents.coder_agent.prompt_store.load", return_value="SYSTEM"), patch(
        "agents.coder_agent.claude_cli.call_coder", side_effect=fake_call_coder
    ):
        changed = coder_agent.run_coder(spec_path, repo_root=repo)

    assert changed == [Path("workspace/new_file.ts")]


def test_run_coder_returns_empty_list_for_preexisting_changes_only(repo: Path) -> None:
    (repo / "workspace" / "preexisting.ts").write_text("export const y = 2;\n")

    spec_path = repo / "spec.md"
    spec_path.write_text("Do nothing")

    with patch("agents.coder_agent.prompt_store.load", return_value="SYSTEM"), patch(
        "agents.coder_agent.claude_cli.call_coder", return_value="done"
    ):
        changed = coder_agent.run_coder(spec_path, repo_root=repo)

    assert changed == []
