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

    feedback: str | None = None
    result: sandbox_runner.SandboxResult

    for _ in range(max_retries):
        coder_agent.run_coder(spec_path, feedback=feedback, repo_root=repo_root)
        result = sandbox_runner.run_build_check()

        if result.success:
            return result

        feedback = result.stderr

    return result
