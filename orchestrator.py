from pathlib import Path

from agents import coder_agent
from harness import sandbox_runner

REPO_ROOT = Path(__file__).resolve().parent


def inner_loop(
    spec_path: Path,
    max_retries: int = 3,
    repo_root: Path | None = None,
) -> sandbox_runner.SandboxResult:
    if repo_root is None:
        repo_root = REPO_ROOT

    coder_agent.run_coder(spec_path, feedback=None, repo_root=repo_root)
    return sandbox_runner.run_build_check()
