import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class SandboxResult:
    success: bool
    stdout: str
    stderr: str
    returncode: int


def run_build_check() -> SandboxResult:
    subprocess.run(
        ["docker", "build", "-t", "game-sandbox", "-f", "sandbox.Dockerfile", "."],
        capture_output=True,
        text=True,
    )

    run = subprocess.run(
        ["docker", "run", "--rm", "--name", "game-sandbox-instance", "game-sandbox"],
        capture_output=True,
        text=True,
    )

    return SandboxResult(
        success=run.returncode == 0,
        stdout=run.stdout,
        stderr=run.stderr,
        returncode=run.returncode,
    )
