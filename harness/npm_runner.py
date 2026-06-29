import os
import subprocess
from pathlib import Path

from harness.sandbox_runner import SandboxResult

BUILD_TIMEOUT_S = 120
UNIT_TIMEOUT_S = 120
E2E_TIMEOUT_S = 300


def _run_npm(cmd: list[str], cwd: Path, timeout: int, extra_env: dict | None = None) -> SandboxResult:
    env = {**os.environ, **(extra_env or {})}
    try:
        result = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env
        )
    except subprocess.TimeoutExpired:
        return SandboxResult(
            success=False, stdout="", stderr=f"npm timeout after {timeout}s", returncode=-1
        )
    return SandboxResult(
        success=result.returncode == 0,
        stdout=result.stdout,
        stderr=result.stderr,
        returncode=result.returncode,
    )


def run_build(workspace: str, repo_root: Path) -> SandboxResult:
    return _run_npm(
        ["npm", "run", "build"], repo_root / f"workspace-{workspace}", BUILD_TIMEOUT_S
    )


def run_unit_tests(workspace: str, repo_root: Path) -> SandboxResult:
    return _run_npm(
        ["npm", "run", "test:unit"], repo_root / f"workspace-{workspace}", UNIT_TIMEOUT_S
    )


def run_e2e_tests(workspace: str, repo_root: Path) -> SandboxResult:
    # CI=1 forces Playwright to own the webServer lifecycle (start + kill per run)
    # Without it, reuseExistingServer=true leaves orphaned vite processes after tests
    return _run_npm(
        ["npm", "run", "test:e2e"], repo_root / f"workspace-{workspace}", E2E_TIMEOUT_S,
        extra_env={"CI": "1"},
    )
