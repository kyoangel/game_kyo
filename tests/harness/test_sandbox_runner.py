from harness.sandbox_runner import SandboxResult


def test_sandbox_result_is_comparable_dataclass() -> None:
    a = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)
    b = SandboxResult(success=True, stdout="ok", stderr="", returncode=0)

    assert a == b
    assert a.success is True
    assert a.stdout == "ok"
    assert a.stderr == ""
    assert a.returncode == 0
