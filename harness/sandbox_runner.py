import subprocess
from dataclasses import dataclass

BUILD_TIMEOUT_S = 300
RUN_TIMEOUT_S = 60


@dataclass(frozen=True)
class SandboxResult:
    success: bool
    stdout: str
    stderr: str
    returncode: int


def run_build_check() -> SandboxResult:
    try:
        build = subprocess.run(
            ["docker", "build", "-t", "game-sandbox", "-f", "sandbox.Dockerfile", "."],
            capture_output=True,
            text=True,
            timeout=BUILD_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return SandboxResult(success=False, stdout="", stderr="docker build timeout", returncode=-1)

    if build.returncode != 0:
        return SandboxResult(
            success=False, stdout=build.stdout, stderr=build.stderr, returncode=build.returncode
        )

    try:
        run = subprocess.run(
            ["docker", "run", "--rm", "--name", "game-sandbox-instance", "game-sandbox"],
            capture_output=True,
            text=True,
            timeout=RUN_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return SandboxResult(success=False, stdout="", stderr="docker run timeout", returncode=-1)

    return SandboxResult(
        success=run.returncode == 0,
        stdout=run.stdout,
        stderr=run.stderr,
        returncode=run.returncode,
    )
