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
