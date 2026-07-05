# Autonomous Loop — Budget Efficiency & Observability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce wasted Claude Code usage in `autonomous_loop.py` across three independent problems: QA burns a full Claude CLI call every time even though Designer already has a cheap LM-Studio-first path; the Coder retry loop attempts a failing spec up to 6 times with no early exit, and abandoning a spec today silently reverts the backlog item so it can be re-picked and re-attempted indefinitely across loop iterations; and usage/cost visibility is broken because the per-iteration summary only fires on the success branch, discarding exactly the failed/abandoned runs where wasted quota goes, with no per-agent breakdown and nothing persisted for later analysis.

**Architecture:** Mirror the existing Designer LM-Studio-first pattern (`designer_agent.run_designer`) for QA: gate on `lm_studio_client.is_available()` plus a workspace-specific `qa-lm-{workspace}.txt` prompt file, regex-extract `<test_file path="...">` blocks, enforce path safety in Python (LM Studio output isn't tool-permission-sandboxed the way Claude CLI's `acceptEdits` session is), validate with a new `run_typecheck` harness helper rather than running the tests (which are supposed to fail red under TDD), and fall back to full Claude CLI QA on any parse or typecheck failure. Cut the Coder retry loop from `range(6)` to `range(2)`, and — so the lower cap actually saves budget instead of just making each failed cycle cheaper while the same hard spec gets reselected forever — encode a strike counter directly in the backlog checkbox marker (`- [ ]` → `- [!]` → `- [!!]`, the latter physically relocated to a blocked section and never reselected), widening Designer's selection/completion regexes to recognize the `[!]` retry-eligible state. Finally, thread an `agent: str` label through every `claude_cli.call_coder()` call site so usage entries can be attributed per agent, print/persist a usage summary on **every** iteration exit path (not just the success branch, which is where today's summary silently drops failed/abandoned spend), and attach the accumulated usage to each step's `trace_logger.log_step()` call so `traces/{run_id}/trace.jsonl` becomes a durable, per-agent-attributed cost record.

**Tech Stack:** Python 3.12+, pytest with `unittest.mock.patch`, the existing `agents/*` module family (`claude_cli`, `lm_studio_client`, `designer_agent`, `qa_agent`, `reviewer_agent`, `meta_reviewer_agent`), `harness/npm_runner.py` (shells out to the pixel-squad workspace's `npm`/`npx` scripts), and `harness/trace_logger.py` for the persisted JSONL trace.

**Out of scope:**
- Live rolling 5-hour-quota visibility (no API exists for this from a script).
- A dedicated historical usage report/CLI (deferred — revisit once trace data accumulates).
- `--max-budget-usd` per-call hard spend cap (discovered as an available `claude -p` flag; not requested, noted here for future reference).

---

### Task 1: `run_typecheck` harness helper

**Files:**
- Modify: `harness/npm_runner.py`
- Test: `tests/harness/test_npm_runner.py`

Pure infrastructure — a `run_typecheck` function shaped exactly like `run_build`/`run_unit_tests`/`run_e2e_tests`, with no LM logic. Task 2 is what actually calls it from QA.

- [ ] **Step 1: Write the failing tests**

Open `tests/harness/test_npm_runner.py`. First, add `run_typecheck` to the existing import on line 7:

```python
from harness.npm_runner import run_build, run_e2e_tests, run_typecheck, run_unit_tests
```

Then append these tests at the end of the file (after `test_run_build_returns_sandbox_result_type`, line 96):

```python
def test_run_typecheck_runs_in_workspace_dir(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_ok("no errors")) as mock_run:
        result = run_typecheck("pixel-squad", tmp_path)

    assert result.success is True
    mock_run.assert_called_once_with(
        ["npx", "tsc", "--noEmit"],
        cwd=tmp_path / "workspace-pixel-squad",
        capture_output=True,
        text=True,
        timeout=120,
        env=ANY,
    )


def test_run_typecheck_failure(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_fail("TS2322: bad type")):
        result = run_typecheck("pixel-squad", tmp_path)

    assert result.success is False
    assert "TS2322" in result.stderr


def test_run_typecheck_appends_explicit_paths_when_given(tmp_path: Path) -> None:
    # QA's validation gate (Task 2) needs to check only the files it just wrote,
    # not the whole project — see this task's Deviation note below for why.
    with patch("harness.npm_runner.subprocess.run", return_value=_ok()) as mock_run:
        run_typecheck("pixel-squad", tmp_path, paths=["tests/unit/Foo.test.ts", "tests/unit/support/bar.ts"])

    args, _ = mock_run.call_args
    assert args[0] == ["npx", "tsc", "--noEmit", "tests/unit/Foo.test.ts", "tests/unit/support/bar.ts"]


def test_run_typecheck_returns_sandbox_result_type(tmp_path: Path) -> None:
    with patch("harness.npm_runner.subprocess.run", return_value=_ok()):
        result = run_typecheck("pixel-squad", tmp_path)

    assert isinstance(result, SandboxResult)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m pytest tests/harness/test_npm_runner.py -v`
Expected: FAIL — `ImportError: cannot import name 'run_typecheck' from 'harness.npm_runner'`.

- [ ] **Step 3: Implement the minimal change**

In `harness/npm_runner.py`, add a timeout constant after `E2E_TIMEOUT_S` (line 9):

```python
TYPECHECK_TIMEOUT_S = 120
```

Then append the function at the end of the file (after `run_e2e_tests`, line 48):

```python
def run_typecheck(workspace: str, repo_root: Path, paths: list[str] | None = None) -> SandboxResult:
    # `paths`, when given, overrides tsc's project-wide `include` for this one
    # invocation — see this task's Deviation note for why that's necessary.
    return _run_npm(
        ["npx", "tsc", "--noEmit", *(paths or [])],
        repo_root / f"workspace-{workspace}", TYPECHECK_TIMEOUT_S,
    )
```

**Deviation:** The design doc says `run_typecheck` "reuses existing tsconfig, no bundling," implying a bare `npx tsc --noEmit` is enough to catch broken LM-generated test output. Checked `workspace-pixel-squad/tsconfig.json`: `"include": ["src/**/*.ts"]` — it does not cover `tests/` at all. Verified empirically: writing a deliberately-broken file (`const x: string = 123;`) into `workspace-pixel-squad/tests/unit/` and running `npx tsc --noEmit` from that directory exits `0` — tsc never even looks at it. Passing the file explicitly as a CLI argument (`npx tsc --noEmit tests/unit/__tmp_broken.test.ts`) does correctly override `include` for that invocation while still honoring `compilerOptions` (confirmed it raises `TS2322` on the same fixture, and exits `0` once the fixture is fixed). So `run_typecheck` gains an optional `paths: list[str] | None = None` parameter: called with no `paths` it behaves exactly as literally specified (bare `npx tsc --noEmit`), and Task 2's QA validation gate calls it with the explicit list of test files it just wrote — this is the only way the gate actually validates anything.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m pytest tests/harness/test_npm_runner.py -v`
Expected: PASS — all 12 tests green (8 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add harness/npm_runner.py tests/harness/test_npm_runner.py
git commit -m "feat: add run_typecheck harness helper for QA's LM validation gate"
```

---

### Task 2: QA agent LM-first path

**Files:**
- Modify: `agents/qa_agent.py`
- Create: `prompts/qa-lm-pixel-squad.txt`
- Test: `tests/agents/test_qa_agent.py`

**Deviation:** Two things diverge from a literal "same shape as `designer_agent.run_designer`" reading, both confirmed by reading `designer_agent.py` line-by-line:
1. **`run_designer`'s fallback never actually fires on a tag-parse failure.** `_run_lm_designer` raises `DesignerError` (line 53 of `agents/designer_agent.py`) when `<spec_slug>`/`<spec_content>` are missing, but `run_designer`'s `try/except` (lines 73–76) only catches `LmStudioError` — a parse failure propagates *uncaught* out of `run_designer` and crashes the loop; it does not fall back to Claude CLI today. The design doc explicitly requires QA's fallback to work ("zero matches → `QaLmError` → fallback"), so `run_qa` below deliberately catches `(LmStudioError, QaLmError)` — implementing the *intended* shape rather than reproducing the existing bug. Fixing Designer's own bug is out of scope here (§3's `designer_agent.py` changes are the regex widening only).
2. **`run_qa` needs a `workspace: str` parameter it didn't have.** The gate (`prompts/qa-lm-{workspace}.txt` exists) and the typecheck step (`run_typecheck(workspace, repo_root)`) both require the workspace name, but `qa_agent.run_qa(spec_path, repo_root)` never took one — it hardcoded the generic `workspace/` directory for its before/after diff, which doesn't even match production (`autonomous_loop.py`'s coder step tracks `workspace-pixel-squad/`). This task changes the signature to `run_qa(workspace, spec_path, repo_root)` (same argument order as `designer_agent.run_designer(workspace, ...)`), fixes the diff-tracking directory to `workspace-{workspace}/`, and updates all 3 existing tests accordingly. Task 3 is what starts actually passing `workspace` in from the loop.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `tests/agents/test_qa_agent.py` with:

```python
import inspect
import subprocess
from pathlib import Path
from unittest.mock import patch

from agents import lm_studio_client, qa_agent
from harness.sandbox_runner import SandboxResult

LM_MULTI_FILE_OUTPUT = (
    '<test_file path="tests/unit/Foo.test.ts">\n'
    "import { describe, it, expect } from 'vitest';\n"
    "describe('adds', () => { it('works', () => { expect(1 + 1).toBe(2); }); });\n"
    "</test_file>\n"
    '<test_file path="tests/unit/support/bar.ts">\n'
    "export const helper = () => 1;\n"
    "</test_file>\n"
)


def _prep_lm(repo: Path, *, prompt: bool = True) -> None:
    (repo / "prompts").mkdir(exist_ok=True)
    if prompt:
        (repo / "prompts" / "qa-lm-pixel-squad.txt").write_text("you are a QA agent (LM)\n")
    (repo / "workspace-pixel-squad").mkdir(exist_ok=True)


# --- Claude CLI path (existing behavior, updated for the new `workspace` param) ---

def test_run_qa_loads_prompt_and_calls_claude_cli(repo: Path) -> None:
    spec_path = repo / "spec.md"
    spec_path.write_text("Build a snake game")

    with patch("agents.qa_agent.lm_studio_client.is_available", return_value=False), \
         patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM PROMPT") as mock_load, \
         patch("agents.qa_agent.claude_cli.call_coder", return_value="done") as mock_call:
        qa_agent.run_qa("pixel-squad", spec_path, repo)

    mock_load.assert_called_once_with("qa", repo, workspace="pixel-squad")
    mock_call.assert_called_once_with(
        system_prompt="QA SYSTEM PROMPT",
        task="Build a snake game",
        repo_root=repo,
    )


def test_run_qa_returns_changed_test_files(repo: Path) -> None:
    unit_dir = repo / "workspace-pixel-squad" / "tests" / "unit"
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

    with patch("agents.qa_agent.lm_studio_client.is_available", return_value=False), \
         patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), \
         patch("agents.qa_agent.claude_cli.call_coder", side_effect=fake_call_coder):
        changed = qa_agent.run_qa("pixel-squad", spec_path, repo)

    assert changed == [Path("workspace-pixel-squad/tests/unit/grid.test.ts")]


def test_run_qa_returns_empty_list_for_preexisting_changes_only(repo: Path) -> None:
    (repo / "workspace-pixel-squad").mkdir()
    (repo / "workspace-pixel-squad" / "preexisting.ts").write_text("export const y = 2;\n")

    spec_path = repo / "spec.md"
    spec_path.write_text("Do nothing")

    with patch("agents.qa_agent.lm_studio_client.is_available", return_value=False), \
         patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), \
         patch("agents.qa_agent.claude_cli.call_coder", return_value="done"):
        changed = qa_agent.run_qa("pixel-squad", spec_path, repo)

    assert changed == []


# --- LM Studio path ---

def test_run_qa_lm_path_writes_multiple_files_and_passes_typecheck(repo: Path) -> None:
    _prep_lm(repo)
    spec_path = repo / "spec.md"
    spec_path.write_text("Add Foo tests")

    with patch("agents.qa_agent.lm_studio_client.is_available", return_value=True), \
         patch("agents.qa_agent.lm_studio_client.call_lm_studio", return_value=LM_MULTI_FILE_OUTPUT) as mock_lm, \
         patch("agents.qa_agent.prompt_store.load", return_value="QA LM SYSTEM"), \
         patch("agents.qa_agent.npm_runner.run_typecheck", return_value=SandboxResult(True, "", "", 0)), \
         patch("agents.qa_agent.claude_cli.call_coder") as mock_claude:
        changed = qa_agent.run_qa("pixel-squad", spec_path, repo)

    foo = repo / "workspace-pixel-squad" / "tests" / "unit" / "Foo.test.ts"
    bar = repo / "workspace-pixel-squad" / "tests" / "unit" / "support" / "bar.ts"
    assert foo.exists() and "describe" in foo.read_text()
    assert bar.exists() and "helper" in bar.read_text()
    assert changed == sorted([
        Path("workspace-pixel-squad/tests/unit/Foo.test.ts"),
        Path("workspace-pixel-squad/tests/unit/support/bar.ts"),
    ])
    mock_claude.assert_not_called()
    assert mock_lm.call_args.kwargs["model"] == lm_studio_client.LM_STUDIO_MODEL_CODER


def test_run_qa_lm_path_falls_back_on_zero_tag_matches(repo: Path) -> None:
    _prep_lm(repo)
    spec_path = repo / "spec.md"
    spec_path.write_text("Add Foo tests")

    with patch("agents.qa_agent.lm_studio_client.is_available", return_value=True), \
         patch("agents.qa_agent.lm_studio_client.call_lm_studio", return_value="I refuse to use tags"), \
         patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), \
         patch("agents.qa_agent.claude_cli.call_coder", return_value="done") as mock_claude:
        qa_agent.run_qa("pixel-squad", spec_path, repo)

    mock_claude.assert_called_once()


def test_run_qa_lm_path_falls_back_and_cleans_up_on_typecheck_failure(repo: Path) -> None:
    _prep_lm(repo)
    existing = repo / "workspace-pixel-squad" / "tests" / "unit" / "support" / "bar.ts"
    existing.parent.mkdir(parents=True, exist_ok=True)
    existing.write_text("export const helper = 'original';\n")

    spec_path = repo / "spec.md"
    spec_path.write_text("Add Foo tests")

    with patch("agents.qa_agent.lm_studio_client.is_available", return_value=True), \
         patch("agents.qa_agent.lm_studio_client.call_lm_studio", return_value=LM_MULTI_FILE_OUTPUT), \
         patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), \
         patch("agents.qa_agent.npm_runner.run_typecheck", return_value=SandboxResult(False, "", "TS2322: bad", 1)), \
         patch("agents.qa_agent.claude_cli.call_coder", return_value="done") as mock_claude:
        qa_agent.run_qa("pixel-squad", spec_path, repo)

    foo = repo / "workspace-pixel-squad" / "tests" / "unit" / "Foo.test.ts"
    assert not foo.exists()  # newly-written file deleted
    assert existing.read_text() == "export const helper = 'original';\n"  # overwritten file restored
    mock_claude.assert_called_once()


def test_run_qa_lm_path_rejects_traversal_and_absolute_paths(repo: Path) -> None:
    _prep_lm(repo)
    spec_path = repo / "spec.md"
    spec_path.write_text("Add Foo tests")

    traversal_output = '<test_file path="../../etc/passwd">pwned</test_file>'
    absolute_output = '<test_file path="/etc/passwd">pwned</test_file>'

    for bad_output in (traversal_output, absolute_output):
        with patch("agents.qa_agent.lm_studio_client.is_available", return_value=True), \
             patch("agents.qa_agent.lm_studio_client.call_lm_studio", return_value=bad_output), \
             patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), \
             patch("agents.qa_agent.claude_cli.call_coder", return_value="done") as mock_claude:
            qa_agent.run_qa("pixel-squad", spec_path, repo)

            mock_claude.assert_called_once()

    assert not (repo / "etc" / "passwd").exists()


def test_run_qa_no_lm_prompt_goes_straight_to_claude_cli_without_error(repo: Path) -> None:
    _prep_lm(repo, prompt=False)  # deliberately no prompts/qa-lm-pixel-squad.txt
    spec_path = repo / "spec.md"
    spec_path.write_text("Add Foo tests")

    with patch("agents.qa_agent.lm_studio_client.is_available", return_value=True), \
         patch("agents.qa_agent.lm_studio_client.call_lm_studio") as mock_lm, \
         patch("agents.qa_agent.prompt_store.load", return_value="QA SYSTEM"), \
         patch("agents.qa_agent.claude_cli.call_coder", return_value="done") as mock_claude:
        qa_agent.run_qa("pixel-squad", spec_path, repo)

    mock_lm.assert_not_called()
    mock_claude.assert_called_once()


def test_run_qa_is_the_only_public_entry_point() -> None:
    public_functions = [
        name for name, obj in vars(qa_agent).items()
        if inspect.isfunction(obj) and obj.__module__ == qa_agent.__name__ and not name.startswith("_")
    ]
    assert public_functions == ["run_qa"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m pytest tests/agents/test_qa_agent.py -v`
Expected: FAIL — `TypeError: run_qa() takes 2 positional arguments but 3 were given` (and `AttributeError: module 'agents.qa_agent' has no attribute 'lm_studio_client'`) for every test.

- [ ] **Step 3: Write the minimal implementation**

Replace the entire contents of `agents/qa_agent.py` with:

```python
import re
from pathlib import Path

from agents import claude_cli, lm_studio_client
from agents.lm_studio_client import LmStudioError
from harness import npm_runner, prompt_store, workspace_diff


class QaLmError(Exception):
    pass


# Expected LM Studio QA output format — one <test_file> block per file,
# `path` relative to the workspace root (e.g. `workspace-pixel-squad/`):
#
#   <test_file path="tests/unit/Foo.test.ts">
#   ...content...
#   </test_file>
#   <test_file path="tests/unit/support/bar.ts">
#   ...content...
#   </test_file>
#
# Every path must resolve inside `tests/` — see `_safe_target`.
_TEST_FILE_RE = re.compile(r'<test_file path="(.*?)">(.*?)</test_file>', re.DOTALL)


def _safe_target(path: str, workspace_dir: Path) -> Path:
    raw = Path(path)
    if raw.is_absolute() or ".." in raw.parts:
        raise QaLmError(f"LM Studio QA wrote an unsafe path: {path!r}")

    tests_root = (workspace_dir / "tests").resolve()
    target = (workspace_dir / raw).resolve()
    if not target.is_relative_to(tests_root):
        raise QaLmError(f"LM Studio QA wrote outside tests/: {path!r}")
    return target


def _run_lm_qa(workspace: str, spec_path: Path, repo_root: Path) -> list[Path]:
    system_prompt = prompt_store.load("qa-lm", repo_root, workspace=workspace)
    task = spec_path.read_text()

    output = lm_studio_client.call_lm_studio(
        system_prompt, task, model=lm_studio_client.LM_STUDIO_MODEL_CODER
    )

    matches = _TEST_FILE_RE.findall(output)
    if not matches:
        raise QaLmError(f"LM Studio QA output missing <test_file> tags: {output[-300:]!r}")

    workspace_dir = repo_root / f"workspace-{workspace}"
    # Validate every path before writing anything — one bad path in the batch
    # shouldn't leave earlier, valid files behind on disk.
    targets = [(_safe_target(path.strip(), workspace_dir), content) for path, content in matches]

    backups: dict[Path, str | None] = {}
    for target, content in targets:
        backups[target] = target.read_text() if target.exists() else None
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content.strip() + "\n")

    written = sorted(backups)
    relative_paths = [str(p.relative_to(workspace_dir)) for p in written]
    check = npm_runner.run_typecheck(workspace, repo_root, paths=relative_paths)
    if not check.success:
        for target, original in backups.items():
            if original is None:
                target.unlink()
            else:
                target.write_text(original)
        raise QaLmError(f"LM Studio QA output failed typecheck:\n{check.stdout}\n{check.stderr}")

    return sorted(p.relative_to(repo_root) for p in written)


def _run_claude_qa(workspace: str, spec_path: Path, repo_root: Path) -> list[Path]:
    system_prompt = prompt_store.load("qa", repo_root, workspace=workspace)
    task = spec_path.read_text()
    workspace_dir = f"workspace-{workspace}/"

    before = workspace_diff.changed_paths(repo_root, workspace_dir=workspace_dir)

    claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
    )

    after = workspace_diff.changed_paths(repo_root, workspace_dir=workspace_dir)
    changed = after - before
    return sorted(Path(p) for p in changed)


def run_qa(workspace: str, spec_path: Path, repo_root: Path) -> list[Path]:
    lm_prompt_path = repo_root / "prompts" / f"qa-lm-{workspace}.txt"
    if lm_studio_client.is_available() and lm_prompt_path.exists():
        print("🤖 Using LM Studio for QA")
        try:
            return _run_lm_qa(workspace, spec_path, repo_root)
        except (LmStudioError, QaLmError) as e:
            print(f"⚠️  LM Studio QA failed, falling back to Claude CLI: {e}")

    return _run_claude_qa(workspace, spec_path, repo_root)
```

Create `prompts/qa-lm-pixel-squad.txt`:

```
You are a QA engineer writing tests FIRST for pixel-squad, a Phaser 3 turn-based RPG built with TypeScript.

You will receive the implementation spec for the feature to test.

Your task:
1. Write failing unit tests that cover every acceptance criterion in the spec.
2. Tests must fail because the feature is not yet implemented (not because of syntax errors).
3. Use vitest syntax (describe, it, expect).
4. Keep tests focused on business logic (pure functions) — avoid testing Phaser scene rendering.
5. If a test needs a shared helper (e.g. tests/unit/support/*.ts), write it as its own <test_file> block alongside the test(s) that use it.

Output format (strict — do not add anything outside these tags):

<test_file path="tests/unit/YourFeature.test.ts">
import { describe, it, expect } from 'vitest';
...
</test_file>
<test_file path="tests/unit/support/optionalHelper.ts">
...
</test_file>

Rules:
- Every path must start with "tests/unit/" — do not write anywhere outside tests/.
- Do not use .skip, .todo, xfail, or any way to make a test pass without actually verifying behavior.
- Do not modify src/ files or implement production code — you are QA, not Coder.
- Do not include any text outside the <test_file> tags.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m pytest tests/agents/test_qa_agent.py -v`
Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add agents/qa_agent.py prompts/qa-lm-pixel-squad.txt tests/agents/test_qa_agent.py
git commit -m "feat: give QA agent a local-LM-first path with typecheck validation"
```

---

### Task 3: Wire `autonomous_loop.py`'s QA step to `qa_agent.run_qa(...)`

**Files:**
- Modify: `autonomous_loop.py`
- Test: `tests/test_autonomous_loop.py`

**Deviation:** The exploration brief assumed an existing test in `tests/test_autonomous_loop.py` asserts on the QA step calling `claude_cli.call_coder` directly and would need rewriting to target `qa_agent.run_qa` instead. Scanning the file line-by-line found no such test: every test that reaches the QA step patches `autonomous_loop.claude_cli.call_coder` as one shared mock covering *both* the QA and Coder steps, with no call-count or call-args assertion tied specifically to QA, and separately patches `autonomous_loop.workspace_diff.changed_paths` at the module-attribute level (which — since `autonomous_loop.workspace_diff` and `agents.qa_agent.workspace_diff` are the same module object — transparently covers `qa_agent.run_qa`'s internal Claude-CLI-fallback diff tracking too). That means every pre-existing test keeps passing unmodified after this change, but that's a weak guarantee: a test suite in that shape would pass whether QA called Claude CLI directly (today) or via `qa_agent.run_qa` (after this task) — it doesn't actually verify the wiring. So instead of leaving that gap, this task adds three new tests that directly assert the new call shape and the preserved failure-handling behavior (see Step 1).

- [ ] **Step 1: Write the failing tests**

First, add `ClaudeCliError` to the imports at the top of `tests/test_autonomous_loop.py` (line 7-9 currently reads):

```python
from autonomous_loop import autonomous_loop, _git_commit
from agents.reviewer_agent import ReviewResult
from harness.sandbox_runner import SandboxResult
```

Change to:

```python
from autonomous_loop import autonomous_loop, _git_commit
from agents.claude_cli import ClaudeCliError
from agents.reviewer_agent import ReviewResult
from harness.sandbox_runner import SandboxResult
```

Then append these tests at the end of the file (after `test_git_commit_runs_correct_commands`, line 223):

```python
def test_qa_step_delegates_to_qa_agent_run_qa(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.qa_agent.run_qa") as mock_qa, \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_OK), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_qa.assert_called_once_with("pixel-squad", spec, repo)


def test_qa_session_limit_stops_loop_without_retry(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", return_value=spec), \
         patch("autonomous_loop.qa_agent.run_qa", side_effect=ClaudeCliError("5-hour session limit reached")), \
         patch("autonomous_loop.claude_cli.call_coder") as mock_coder, \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_coder.assert_not_called()


def test_qa_failure_reverts_backlog_when_designer_just_ran(tmp_path: Path) -> None:
    # NOTE: deliberately not using _make_repo's returned `backlog` (it lives at
    # specs/pixel-squad-backlog.md, a legacy path unrelated to what
    # autonomous_loop() actually reads/writes). The loop computes its own
    # backlog_path as docs/specs/{workspace}/backlog.md — that's the file this
    # test must write to and assert against, or the assertion would silently
    # check a file the loop never touches.
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    backlog_path = repo / "docs" / "specs" / "pixel-squad" / "backlog.md"
    backlog_path.parent.mkdir(parents=True)
    backlog_path.write_text("- [ ] skill system\n")

    def designer_side_effect(*args, **kwargs):
        spec.write_text("# Skill spec\n")
        backlog_path.write_text("- [x] skill system\n")
        return spec

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=designer_side_effect), \
         patch("autonomous_loop.qa_agent.run_qa", side_effect=ClaudeCliError("boom")), \
         patch("autonomous_loop.claude_cli.call_coder") as mock_coder, \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=1, repo_root=repo)

    assert backlog_path.read_text() == "- [ ] skill system\n"
    mock_coder.assert_not_called()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m pytest tests/test_autonomous_loop.py -v`
Expected: FAIL — `test_qa_step_delegates_to_qa_agent_run_qa` fails with `AttributeError: <module 'autonomous_loop'> does not have the attribute 'qa_agent'` (or `mock_qa.assert_called_once` failing with 0 calls); the other two fail because `autonomous_loop.qa_agent.run_qa` doesn't exist to patch.

- [ ] **Step 3: Write the minimal implementation**

In `autonomous_loop.py`, change the import on line 9 from:

```python
from agents import claude_cli, designer_agent, meta_reviewer_agent, reviewer_agent
```

to:

```python
from agents import claude_cli, designer_agent, meta_reviewer_agent, qa_agent, reviewer_agent
```

Then replace the QA step (currently lines 142-174):

```python
        # --- QA (skip if already done for this spec) ---
        if resume.get("qa_done", False):
            print(f"↩️  QA already done for {spec_path.name} (QA skipped)")
        else:
            qa_prompt = prompt_store.load("qa", repo_root, workspace=workspace)
            try:
                claude_cli.call_coder(
                    system_prompt=qa_prompt,
                    task=spec_path.read_text(),
                    repo_root=repo_root,
                )
            except ClaudeCliError as e:
                trace_logger.log_step(
                    run_id=run_id, agent="qa",
                    input={"spec": str(spec_path)}, output={},
                    result={"success": False, "error": str(e)},
                    traces_root=repo_root / "traces",
                )
                if "session limit" in str(e).lower():
                    print(f"⛔ Session limit hit — stopping loop (retry is pointless)")
                    return
                # QA failed before writing tests — only restore backlog if Designer just ran
                if "spec_path" not in resume:
                    backlog_path.write_text(backlog_snapshot)
                    _clear_resume(workspace, repo_root)
                continue
            trace_logger.log_step(
                run_id=run_id, agent="qa",
                input={"spec": str(spec_path)}, output={},
                result={"success": True},
                traces_root=repo_root / "traces",
            )
            _save_resume(workspace, repo_root, {"spec_path": str(spec_path), "qa_done": True})
```

with:

```python
        # --- QA (skip if already done for this spec) ---
        if resume.get("qa_done", False):
            print(f"↩️  QA already done for {spec_path.name} (QA skipped)")
        else:
            try:
                qa_agent.run_qa(workspace, spec_path, repo_root)
            except ClaudeCliError as e:
                trace_logger.log_step(
                    run_id=run_id, agent="qa",
                    input={"spec": str(spec_path)}, output={},
                    result={"success": False, "error": str(e)},
                    traces_root=repo_root / "traces",
                )
                if "session limit" in str(e).lower():
                    print(f"⛔ Session limit hit — stopping loop (retry is pointless)")
                    return
                # QA failed before writing tests — only restore backlog if Designer just ran
                if "spec_path" not in resume:
                    backlog_path.write_text(backlog_snapshot)
                    _clear_resume(workspace, repo_root)
                continue
            trace_logger.log_step(
                run_id=run_id, agent="qa",
                input={"spec": str(spec_path)}, output={},
                result={"success": True},
                traces_root=repo_root / "traces",
            )
            _save_resume(workspace, repo_root, {"spec_path": str(spec_path), "qa_done": True})
```

This removes the inline `qa_prompt = prompt_store.load(...)` + `claude_cli.call_coder(...)` duplication (now owned by `qa_agent.run_qa`'s own Claude-CLI-fallback path) while preserving every existing behavior: session-limit early `return`, backlog-revert-only-when-Designer-just-ran, `qa_done` resume flag, and the trace log shape on both branches. `prompt_store` remains imported/used elsewhere in this file (the Coder step's `prompt_store.load("coder", ...)` on line 177), so no import needs removing.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m pytest tests/test_autonomous_loop.py -v`
Expected: PASS — all 12 tests green (9 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add autonomous_loop.py tests/test_autonomous_loop.py
git commit -m "refactor: wire autonomous loop's QA step through qa_agent.run_qa"
```

---

### Task 4: Coder retry cap

**Files:**
- Modify: `autonomous_loop.py`
- Modify: `tests/test_autonomous_loop.py`

- [ ] **Step 1: Write the failing test**

The current Coder + validate loop runs `for attempt in range(6):`, so a spec whose Coder output never builds burns up to 6 build/unit/e2e cycles before the `for...else` abandonment block gives up and reverts the backlog item. Add a test that pins the cap at 2 attempts and confirms abandonment never reaches `_git_commit`. Append to `tests/test_autonomous_loop.py`:

```python
def test_loop_abandons_coder_after_2_attempts_not_6(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    build_calls = {"n": 0}

    def build_side_effect(*args, **kwargs):
        build_calls["n"] += 1
        return BUILD_FAIL

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.qa_agent.run_qa", return_value=[]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", side_effect=build_side_effect), \
         patch("autonomous_loop._git_commit") as mock_commit, \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    assert build_calls["n"] == 2
    mock_commit.assert_not_called()
```

```python
def test_loop_retries_coder_on_build_failure(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    call_count = 0

    def build_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return BUILD_FAIL if call_count < 2 else BUILD_OK

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.qa_agent.run_qa", return_value=[]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", side_effect=build_side_effect), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    assert call_count == 2
```

Note: this rewritten existing test does not itself go "red" against the pre-change code (a cap of 6 also satisfies "succeeds on the 2nd of ≤6 attempts"), so it's a consistency fix rather than a red test — the genuinely red test for this task is `test_loop_abandons_coder_after_2_attempts_not_6` above, which fails hard against the old cap of 6 (`build_calls["n"]` would reach 6, not 2).

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/test_autonomous_loop.py -v`
Expected: `test_loop_abandons_coder_after_2_attempts_not_6` FAILS — `assert 6 == 2`. `test_loop_retries_coder_on_build_failure` passes even before Step 3 (as noted above) — confirm it still passes after Step 3 too.

- [ ] **Step 3: Write the minimal implementation**

In `autonomous_loop.py`, in the Coder + validate loop, change:
```python
        for attempt in range(6):
```
to:
```python
        for attempt in range(2):
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/test_autonomous_loop.py -v`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add autonomous_loop.py tests/test_autonomous_loop.py
git commit -m "feat(loop): cap Coder retries at 2 attempts (was 6)"
```

---

### Task 5: Designer selection regex — `[!]` eligible, `[!!]` excluded

**Files:**
- Modify: `agents/designer_agent.py`
- Test: `tests/agents/test_designer_agent.py`

Widens the 3 places `designer_agent.py` currently hardcodes `- [ ]` so that 1-strike (`- [!]`) items remain selectable and 2-strike (`- [!!]`) items are never sent to Designer at all (their 2-char marker naturally fails a `[ !]` single-char class match — no separate skip logic needed).

- [ ] **Step 1: Write the failing tests**

Append to `tests/agents/test_designer_agent.py`:

```python
from agents.designer_agent import _build_lm_context, _run_lm_designer


def test_run_designer_includes_one_strike_items_and_excludes_blocked_items(tmp_path: Path) -> None:
    repo, backlog = _make_repo(
        tmp_path,
        backlog_text="- [!] retry-me\n- [!!] blocked-item\n- [ ] fresh-item\n",
    )
    with patch("agents.designer_agent.lm_studio_client.is_available", return_value=False), \
         patch("agents.designer_agent.claude_cli.call_coder", return_value="SPEC_PATH: specs/x.md") as mock_call:
        run_designer("pixel-squad", backlog, repo)

    task_sent = mock_call.call_args.kwargs["task"]
    assert "- [!] retry-me" in task_sent
    assert "- [ ] fresh-item" in task_sent
    assert "- [!!] blocked-item" not in task_sent


def test_build_lm_context_includes_one_strike_and_excludes_blocked(tmp_path: Path) -> None:
    (tmp_path / "docs" / "specs" / "pixel-squad").mkdir(parents=True)
    backlog = tmp_path / "docs" / "specs" / "pixel-squad" / "backlog.md"
    backlog.write_text("- [!] retry-me\n- [!!] blocked-item\n- [ ] fresh-item\n")

    context = _build_lm_context(backlog, tmp_path)

    assert "- [!] retry-me" in context
    assert "- [ ] fresh-item" in context
    assert "- [!!] blocked-item" not in context


def test_run_lm_designer_marks_one_strike_item_as_done_on_success(tmp_path: Path) -> None:
    repo, backlog = _make_repo(tmp_path, backlog_text="- [!] retry-me\n")
    (repo / "prompts" / "designer-lm-pixel-squad.txt").write_text("designer lm prompt\n")
    output = "<spec_slug>retry-me</spec_slug>\n<spec_content>\n# Retry Me\n</spec_content>\n"

    with patch("agents.designer_agent.lm_studio_client.call_lm_studio", return_value=output):
        _run_lm_designer("pixel-squad", backlog, repo)

    content = backlog.read_text()
    assert "- [x] retry-me" in content
    assert "- [!] retry-me" not in content
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/agents/test_designer_agent.py -v`
Expected: FAIL — `- [!] retry-me` missing from `task_sent` / `context` (current code's `.startswith("- [ ]")` check excludes it), and the mark-as-done test fails because `re.sub(r"- \[ \] (.+?)...")` doesn't match a `- [!]` line at all, so the backlog is left unchanged (`"- [!] retry-me" not in content` assertion fails).

- [ ] **Step 3: Write the minimal implementation**

In `agents/designer_agent.py`, three changes (regex already imported at line 1):

Line 21 (in `_build_lm_context`), change:
```python
    unchecked = [l for l in backlog_full.splitlines() if l.strip().startswith("- [ ]")]
```
to:
```python
    unchecked = [l for l in backlog_full.splitlines() if re.match(r"^- \[[ !]\]", l.strip())]
```

Line 64 (in `_run_lm_designer`, mark-as-done substitution), change:
```python
    updated = re.sub(r"- \[ \] (.+?)(?=\n|$)", lambda m: f"- [x] {m.group(1)}", backlog_text, count=1)
```
to:
```python
    updated = re.sub(r"- \[[ !]\] (.+?)(?=\n|$)", lambda m: f"- [x] {m.group(1)}", backlog_text, count=1)
```

Line 80 (in `run_designer`, Claude-CLI fallback context builder) — same change as line 21:
```python
    unchecked = [l for l in backlog_full.splitlines() if re.match(r"^- \[[ !]\]", l.strip())]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/agents/test_designer_agent.py -v`
Expected: PASS — all tests green (6 pre-existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add agents/designer_agent.py tests/agents/test_designer_agent.py
git commit -m "feat(designer): widen backlog selection regex to keep [!] items eligible"
```

---

### Task 6: Backlog strike escalation + prompt updates

**Files:**
- Modify: `autonomous_loop.py`
- Modify (prose, non-TDD): `prompts/designer.txt`, `prompts/designer-lm-pixel-squad.txt`, `prompts/designer-pixel-squad.txt`
- Test: `tests/test_autonomous_loop.py`

**Deviation:** the design doc's file table for this change only names `prompts/designer.txt` and `prompts/designer-lm-pixel-squad.txt`. Reading `harness/prompt_store.py::load()` shows workspace-specific prompts are always preferred over the generic ones, and `prompts/designer-pixel-squad.txt` exists — so it, not `designer.txt`, is the prompt actually used at runtime for the exercised `pixel-squad` workspace's Claude-CLI fallback path. `designer-pixel-squad.txt` is added to this task's prompt updates too, since skipping it would leave the prompt that's actually exercised inconsistent with the strike system, defeating the design's own stated rationale.

- [ ] **Step 1: Write the failing tests**

Add this import to `tests/test_autonomous_loop.py`:
```python
from autonomous_loop import _escalate_backlog_strike
```

Append these tests:

```python
def test_escalate_backlog_strike_first_failure_adds_one_strike(tmp_path: Path) -> None:
    backlog = tmp_path / "backlog.md"
    snapshot = "- [ ] hard-item\n- [ ] other-item\n"
    backlog.write_text("- [x] hard-item\n- [ ] other-item\n")  # Designer just checked it off

    _escalate_backlog_strike(backlog, snapshot)

    assert backlog.read_text() == "- [!] hard-item\n- [ ] other-item\n"


def test_escalate_backlog_strike_second_failure_blocks_and_relocates(tmp_path: Path) -> None:
    backlog = tmp_path / "backlog.md"
    snapshot = "- [!] hard-item\n- [ ] other-item\n"
    backlog.write_text("- [x] hard-item\n- [ ] other-item\n")

    _escalate_backlog_strike(backlog, snapshot)

    content = backlog.read_text()
    assert "- [!] hard-item" not in content
    assert "- [x] hard-item" not in content
    assert "- [ ] other-item" in content
    assert "## ⚠️ 已封鎖（需人工介入）" in content
    assert "- [!!] hard-item" in content


def test_escalate_backlog_strike_falls_back_to_full_revert_when_no_change_detected(tmp_path: Path) -> None:
    backlog = tmp_path / "backlog.md"
    snapshot = "- [ ] untouched-item\n"
    backlog.write_text("- [ ] untouched-item\n")  # e.g. a resumed iteration where Designer was skipped

    _escalate_backlog_strike(backlog, snapshot)

    assert backlog.read_text() == snapshot


def test_loop_abandonment_calls_escalate_not_raw_revert(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.qa_agent.run_qa", return_value=[]), \
         patch("autonomous_loop.claude_cli.call_coder", return_value="done"), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_FAIL), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step"), \
         patch("autonomous_loop._escalate_backlog_strike") as mock_escalate:
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    mock_escalate.assert_called_once()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/test_autonomous_loop.py -v`
Expected: FAIL — `ImportError: cannot import name '_escalate_backlog_strike' from 'autonomous_loop'`.

- [ ] **Step 3: Write the minimal implementation**

In `autonomous_loop.py`, add `import re` to the top import block (after `import json`, before `import subprocess`):
```python
import re
```

Add this helper after `_append_meta_review` (currently ending at line 71), before `_print_usage_summary`:

```python
_BLOCKED_SECTION = "## ⚠️ 已封鎖（需人工介入）"


def _escalate_backlog_strike(backlog_path: Path, backlog_snapshot: str) -> None:
    """Called when Coder exhausts all retry attempts on the spec Designer
    just picked. Instead of silently reverting the backlog to its
    pre-Designer state (which lets the same hard item be reselected forever),
    escalate its strike marker: `- [ ]` -> `- [!]` (still retry-eligible next
    time), or `- [!]` -> relocated under a blocked section as `- [!!]`
    (never reselected again).
    """
    if not backlog_path.exists():
        return

    snapshot_lines = backlog_snapshot.splitlines()
    current_lines = backlog_path.read_text().splitlines()
    marker_re = re.compile(r"^(- \[[ !]\]) (.*)$")

    picked_index = None
    for idx, (before, after) in enumerate(zip(snapshot_lines, current_lines)):
        match = marker_re.match(before.strip())
        after_stripped = after.strip()
        if match and after_stripped.startswith("- [x] ") and after_stripped[6:] == match.group(2):
            picked_index = idx
            break

    if picked_index is None:
        # Nothing identifiable changed this iteration (e.g. a resumed run
        # where Designer was skipped) — fall back to the old unconditional
        # revert rather than guess.
        backlog_path.write_text(backlog_snapshot)
        return

    marker, text = marker_re.match(snapshot_lines[picked_index].strip()).groups()

    if marker == "- [ ]":
        snapshot_lines[picked_index] = f"- [!] {text}"
        backlog_path.write_text("\n".join(snapshot_lines) + "\n")
        return

    # Second strike: remove from the active list, relocate under the blocked section.
    del snapshot_lines[picked_index]
    content = "\n".join(snapshot_lines).rstrip() + "\n"
    blocked_line = f"- [!!] {text}"
    if _BLOCKED_SECTION not in content:
        content = content.rstrip() + f"\n\n{_BLOCKED_SECTION}\n\n{blocked_line}\n"
    else:
        content = content.rstrip() + "\n" + blocked_line + "\n"
    backlog_path.write_text(content)
```

Then in the Coder loop's `for...else` abandonment branch, change:
```python
        else:
            print(f"⚠️  All Coder retries failed for iter {i} — skipping spec")
            backlog_path.write_text(backlog_snapshot)
            _clear_resume(workspace, repo_root)
```
to:
```python
        else:
            print(f"⚠️  All Coder retries failed for iter {i} — skipping spec")
            _escalate_backlog_strike(backlog_path, backlog_snapshot)
            _clear_resume(workspace, repo_root)
```

Now the prompt updates (no test — plain prose):

In `prompts/designer-pixel-squad.txt`, change step 2 from:
```
2. Find the FIRST unchecked [ ] item.
```
to:
```
2. Find the FIRST unchecked item — this includes both `- [ ]` (untried) and `- [!]` (failed once, still eligible for one retry). Skip any `- [!!]` item entirely — those are blocked and require human intervention.
```

In `prompts/designer-lm-pixel-squad.txt`, change step 1 from:
```
1. Find the FIRST unchecked [ ] item in the backlog.
```
to:
```
1. Find the FIRST unchecked item in the backlog — this includes both `- [ ]` (untried) and `- [!]` (failed once, still eligible for one retry). Skip any `- [!!]` item entirely — those are blocked and require human intervention.
```

In `prompts/designer.txt`, add a new section after the existing "規格書輸出慣例" block (after the line ending `...方便 Coder Agent 解析。`):
```

Backlog 項目狀態慣例：
- `- [ ]`：尚未嘗試。
- `- [!]`：已失敗一次，仍可重新嘗試一次。
- `- [!!]`：已失敗兩次，已封鎖，不會再被選取（會被移到「已封鎖」區塊）。
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/test_autonomous_loop.py -v`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add autonomous_loop.py prompts/designer.txt prompts/designer-lm-pixel-squad.txt prompts/designer-pixel-squad.txt tests/test_autonomous_loop.py
git commit -m "feat(loop): escalate backlog strikes instead of reverting on Coder abandonment"
```

---

### Task 7: Usage attribution — `call_coder` gains an `agent` parameter

**Files:**
- Modify: `agents/claude_cli.py`, `agents/designer_agent.py`, `agents/qa_agent.py`, `agents/reviewer_agent.py`, `agents/meta_reviewer_agent.py`, `autonomous_loop.py`
- Test: `tests/agents/test_claude_cli.py`, `tests/agents/test_designer_agent.py`, `tests/agents/test_qa_agent.py`, `tests/agents/test_reviewer_agent.py`, `tests/agents/test_meta_reviewer_agent.py` (new file)

**Deviation:** `agents/coder_agent.py` also calls `claude_cli.call_coder`, but it's dead code — `autonomous_loop.py`'s Coder step calls `claude_cli.call_coder` inline (same pattern QA used to have), never through `coder_agent.run_coder`. The design doc's file list never mentions `coder_agent.py`, confirming it's intentionally out of scope; it is not touched by this task.

- [ ] **Step 1: Write the failing tests**

In `tests/agents/test_claude_cli.py`, add `import json` to the imports, then append:

```python
def test_call_coder_records_usage_entry_tagged_with_agent(tmp_path: Path) -> None:
    mock_result = MagicMock(
        returncode=0,
        stdout=json.dumps({
            "result": "done",
            "usage": {"input_tokens": 10, "output_tokens": 5},
            "total_cost_usd": 0.01,
        }),
        stderr="",
    )
    from agents import claude_cli as claude_cli_module
    claude_cli_module.reset_usage_log()

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result):
        call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path, agent="qa")

    entries = claude_cli_module.reset_usage_log()
    assert len(entries) == 1
    assert entries[0]["agent"] == "qa"


def test_call_coder_defaults_agent_to_unknown_when_not_specified(tmp_path: Path) -> None:
    mock_result = MagicMock(
        returncode=0,
        stdout=json.dumps({"result": "done", "usage": {"input_tokens": 1}}),
        stderr="",
    )
    from agents import claude_cli as claude_cli_module
    claude_cli_module.reset_usage_log()

    with patch("agents.claude_cli.subprocess.run", return_value=mock_result):
        call_coder(system_prompt="SYSTEM", task="TASK", repo_root=tmp_path)

    entries = claude_cli_module.reset_usage_log()
    assert entries[0]["agent"] == "unknown"
```

In `tests/agents/test_designer_agent.py`, update `test_run_designer_returns_spec_path`'s assertion from:
```python
    mock_call.assert_called_once_with(
        system_prompt="you are a designer\n",
        task="- [ ] skill system\n",
        repo_root=repo,
    )
```
to:
```python
    mock_call.assert_called_once_with(
        system_prompt="you are a designer\n",
        task="- [ ] skill system\n",
        repo_root=repo,
        agent="designer",
    )
```

In `tests/agents/test_qa_agent.py`, update `test_run_qa_loads_prompt_and_calls_claude_cli`'s assertion from:
```python
    mock_call.assert_called_once_with(
        system_prompt="QA SYSTEM PROMPT",
        task="Build a snake game",
        repo_root=repo,
    )
```
to:
```python
    mock_call.assert_called_once_with(
        system_prompt="QA SYSTEM PROMPT",
        task="Build a snake game",
        repo_root=repo,
        agent="qa",
    )
```

Append to `tests/agents/test_reviewer_agent.py`:
```python
def test_fallback_review_calls_claude_cli_tagged_as_reviewer(tmp_path: Path) -> None:
    with patch("agents.reviewer_agent.lm_studio_client.is_available", return_value=False), \
         patch("agents.reviewer_agent.claude_cli.call_coder",
               return_value='{"approved": true, "comments": []}') as mock_call:
        reviewer_agent._fallback_review("task", "system", tmp_path)

    assert mock_call.call_args.kwargs["agent"] == "reviewer"
```

Create `tests/agents/test_meta_reviewer_agent.py`:
```python
from pathlib import Path
from unittest.mock import patch

from agents import meta_reviewer_agent


def test_run_meta_review_calls_claude_cli_tagged_as_meta_reviewer(tmp_path: Path) -> None:
    (tmp_path / "prompts").mkdir()
    (tmp_path / "prompts" / "meta-reviewer.txt").write_text("meta reviewer prompt\n")
    spec = tmp_path / "spec.md"
    spec.write_text("# spec\n")

    with patch("agents.meta_reviewer_agent.lm_studio_client.is_available", return_value=False), \
         patch("agents.meta_reviewer_agent.claude_cli.call_coder", return_value="- [ ] follow up") as mock_call, \
         patch("agents.meta_reviewer_agent._get_code_section", return_value=""):
        meta_reviewer_agent.run_meta_review(spec, [], tmp_path)

    assert mock_call.call_args.kwargs["agent"] == "meta-reviewer"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/agents/test_claude_cli.py tests/agents/test_designer_agent.py tests/agents/test_qa_agent.py tests/agents/test_reviewer_agent.py tests/agents/test_meta_reviewer_agent.py -v`
Expected: FAIL — the two new `test_claude_cli.py` tests raise `TypeError: call_coder() got an unexpected keyword argument 'agent'`; the others raise `KeyError: 'agent'` (mocks recorded calls made without that kwarg).

- [ ] **Step 3: Write the minimal implementation**

In `agents/claude_cli.py`, change the signature (lines 22–27):
```python
def call_coder(
    system_prompt: str,
    task: str,
    feedback: str | None = None,
    repo_root: Path | None = None,
    agent: str = "unknown",
) -> str:
```

And in the usage-append block (lines 63–69):
```python
        usage = parsed.get("usage", {})
        if usage:
            _usage_log.append({
                "agent": agent,
                "usage": usage,
                "cost_usd": parsed.get("total_cost_usd"),
                "model": parsed.get("modelUsage", {}),
            })
```

In `agents/designer_agent.py`, add `agent="designer"` to the `claude_cli.call_coder(...)` call (lines 83–87):
```python
    output = claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
        agent="designer",
    )
```

In `agents/qa_agent.py`, add `agent="qa"` to its Claude-CLI fallback call:
```python
    claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
        agent="qa",
    )
```

In `agents/reviewer_agent.py`, add `agent="reviewer"` to `_fallback_review`'s call (lines 77–81):
```python
    output = claude_cli.call_coder(
        system_prompt=fallback_system,
        task=task,
        repo_root=repo_root,
        agent="reviewer",
    )
```

In `agents/meta_reviewer_agent.py`, add `agent="meta-reviewer"` to its call (lines 64–68):
```python
    output = claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
        agent="meta-reviewer",
    )
```

In `autonomous_loop.py`, add `agent="coder"` to the Coder step's call:
```python
                claude_cli.call_coder(
                    system_prompt=coder_prompt,
                    task=spec_path.read_text(),
                    feedback=feedback,
                    repo_root=repo_root,
                    agent="coder",
                )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/agents/test_claude_cli.py tests/agents/test_designer_agent.py tests/agents/test_qa_agent.py tests/agents/test_reviewer_agent.py tests/agents/test_meta_reviewer_agent.py tests/test_autonomous_loop.py -v`
Expected: PASS — all tests green. (Re-run `test_autonomous_loop.py` too — its `claude_cli.call_coder` mocks use `return_value=...`, which accepts arbitrary kwargs freely, so the new `agent="coder"` kwarg doesn't break anything there.)

- [ ] **Step 5: Commit**

```bash
git add agents/claude_cli.py agents/designer_agent.py agents/qa_agent.py agents/reviewer_agent.py agents/meta_reviewer_agent.py autonomous_loop.py tests/agents/test_claude_cli.py tests/agents/test_designer_agent.py tests/agents/test_qa_agent.py tests/agents/test_reviewer_agent.py tests/agents/test_meta_reviewer_agent.py
git commit -m "feat(usage): attribute every Claude CLI call to an agent role"
```

---

### Task 8: Usage summary printed + persisted on every iteration exit path

**Files:**
- Modify: `agents/claude_cli.py`, `autonomous_loop.py`
- Test: `tests/agents/test_claude_cli.py`, `tests/test_autonomous_loop.py`

This is the core observability fix: `_print_usage_summary` currently only fires from the `review.approved` success branch, so every failure/abandonment/session-limit exit silently discards accumulated usage via the next iteration's `reset_usage_log()`. This task also fixes a related bug found during exploration: the existing success-path summary is printed *before* the optional meta-review call, so meta-reviewer's own Claude CLI usage for that iteration is currently lost too — this task moves the summary to fire after meta-review instead.

- [ ] **Step 1: Write the failing tests**

In `tests/agents/test_claude_cli.py`, append:
```python
def test_current_usage_log_returns_snapshot_without_clearing(tmp_path: Path) -> None:
    from agents import claude_cli as claude_cli_module
    mock_result = MagicMock(
        returncode=0,
        stdout=json.dumps({"result": "done", "usage": {"input_tokens": 1}}),
        stderr="",
    )
    claude_cli_module.reset_usage_log()
    with patch("agents.claude_cli.subprocess.run", return_value=mock_result):
        call_coder(system_prompt="S", task="T", repo_root=tmp_path, agent="qa")

    snapshot = claude_cli_module.current_usage_log()
    assert len(snapshot) == 1
    assert claude_cli_module.current_usage_log() == snapshot  # still there, not cleared
```

In `tests/test_autonomous_loop.py`, add these imports:
```python
from agents import claude_cli
from agents.claude_cli import ClaudeCliError
from autonomous_loop import _escalate_backlog_strike
```
(the `ClaudeCliError`/`_escalate_backlog_strike` imports may already be present from Task 6 — add only what's missing.)

Add this shared helper near the top of the file (after `_make_alternating_paths`):
```python
def _fake_call_coder(*, agent: str = "unknown", **kwargs) -> str:
    """Shared claude_cli.call_coder stand-in: records a usage entry tagged
    with whichever agent= the real call site passes (Designer/QA/Coder all
    share the same claude_cli.call_coder function), so tests can assert on
    per-agent usage attribution end-to-end without touching the real CLI."""
    claude_cli._usage_log.append({
        "agent": agent,
        "usage": {"input_tokens": 10, "output_tokens": 5},
        "cost_usd": 0.01,
    })
    return "done"


def _fake_meta_review(*args, **kwargs) -> list:
    _fake_call_coder(agent="meta-reviewer")
    return []
```

Append these tests:

```python
def test_usage_summary_groups_by_agent_on_success(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", side_effect=_fake_call_coder), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_OK), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step") as mock_log:
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    summary_calls = [c for c in mock_log.call_args_list if c.kwargs["agent"] == "usage-summary"]
    assert len(summary_calls) == 1
    by_agent = summary_calls[0].kwargs["result"]["by_agent"]
    assert "qa" in by_agent
    assert "coder" in by_agent


def test_usage_summary_includes_meta_reviewer_cost_when_enabled(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", side_effect=_fake_call_coder), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_OK), \
         patch("autonomous_loop.npm_runner.run_unit_tests", return_value=UNIT_OK), \
         patch("autonomous_loop.npm_runner.run_e2e_tests", return_value=E2E_OK), \
         patch("autonomous_loop.reviewer_agent.run_reviewer", return_value=APPROVED), \
         patch("autonomous_loop._git_commit"), \
         patch("autonomous_loop.meta_reviewer_agent.run_meta_review", side_effect=_fake_meta_review), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step") as mock_log:
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo, meta_review=True)

    summary_calls = [c for c in mock_log.call_args_list if c.kwargs["agent"] == "usage-summary"]
    assert len(summary_calls) == 1
    assert "meta-reviewer" in summary_calls[0].kwargs["result"]["by_agent"]


def test_usage_summary_persisted_on_coder_abandonment(tmp_path: Path) -> None:
    repo, _ = _make_repo(tmp_path)
    spec = tmp_path / "specs" / "pixel-squad-skill.md"
    spec.write_text("# Skill spec\n")

    with patch("autonomous_loop.designer_agent.run_designer", side_effect=[spec, None]), \
         patch("autonomous_loop.claude_cli.call_coder", side_effect=_fake_call_coder), \
         patch("autonomous_loop.npm_runner.run_build", return_value=BUILD_FAIL), \
         patch("autonomous_loop.workspace_diff.changed_paths", side_effect=_make_alternating_paths()), \
         patch("autonomous_loop.trace_logger.log_step") as mock_log:
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    summary_calls = [c for c in mock_log.call_args_list if c.kwargs["agent"] == "usage-summary"]
    assert len(summary_calls) == 1
    by_agent = summary_calls[0].kwargs["result"]["by_agent"]
    assert by_agent["coder"]["calls"] == 2
    assert by_agent.get("qa", {}).get("calls", 0) == 1


def test_usage_summary_persisted_on_qa_failure_after_designer_success(tmp_path: Path) -> None:
    repo = tmp_path
    (repo / "docs" / "specs" / "pixel-squad").mkdir(parents=True)
    backlog = repo / "docs" / "specs" / "pixel-squad" / "backlog.md"
    backlog.write_text("- [ ] skill system\n")
    (repo / "prompts").mkdir()
    (repo / "prompts" / "designer-pixel-squad.txt").write_text("designer prompt\n")
    (repo / "prompts" / "qa-pixel-squad.txt").write_text("qa prompt\n")
    spec_path = repo / "docs" / "specs" / "pixel-squad" / "skill.md"
    spec_path.write_text("# Skill spec\n")

    def call_coder_side_effect(*, agent="unknown", **kwargs):
        if agent == "qa":
            raise ClaudeCliError("qa exploded")
        _fake_call_coder(agent=agent)
        return f"Designed it.\nSPEC_PATH: {spec_path}"

    with patch("autonomous_loop.claude_cli.call_coder", side_effect=call_coder_side_effect), \
         patch("autonomous_loop.trace_logger.log_step") as mock_log:
        autonomous_loop("pixel-squad", max_iter=1, repo_root=repo)

    summary_calls = [c for c in mock_log.call_args_list if c.kwargs["agent"] == "usage-summary"]
    assert len(summary_calls) == 1
    by_agent = summary_calls[0].kwargs["result"]["by_agent"]
    assert by_agent["designer"]["calls"] == 1
    assert "qa" not in by_agent


def test_grand_total_printed_even_when_session_limit_hit(tmp_path: Path, capsys) -> None:
    repo, _ = _make_repo(tmp_path)

    with patch("autonomous_loop.designer_agent.run_designer",
               side_effect=ClaudeCliError("session limit reached")), \
         patch("autonomous_loop.trace_logger.log_step"):
        autonomous_loop("pixel-squad", max_iter=5, repo_root=repo)

    captured = capsys.readouterr()
    assert "grand total" in captured.out.lower()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/agents/test_claude_cli.py tests/test_autonomous_loop.py -v`
Expected: FAIL — `AttributeError: <module 'agents.claude_cli'> does not have the attribute 'current_usage_log'`; the `usage-summary`-tagged tests find zero matching `trace_logger.log_step` calls (`assert len(summary_calls) == 1` → `assert 0 == 1`); `test_grand_total_printed_even_when_session_limit_hit` finds no "grand total" text printed.

- [ ] **Step 3: Write the minimal implementation**

In `agents/claude_cli.py`, add after `reset_usage_log`:
```python
def current_usage_log() -> list[dict]:
    """Non-destructive snapshot of accumulated usage entries (does not clear
    them, unlike reset_usage_log()). Lets callers attach a step's own usage
    to a trace record without disturbing the running per-iteration total.
    """
    return _usage_log[:]
```

In `autonomous_loop.py`, replace `_print_usage_summary` (currently lines 74–89) with:

```python
def _usage_since(mark: int) -> tuple[list[dict], int]:
    """Non-destructively read usage entries appended since `mark` (an index
    into the shared usage log), returning (new_entries, new_mark). Used to
    attach each pipeline step's own usage to its own trace_logger record,
    independent of the once-per-iteration reset_usage_log() drain used for
    the printed/persisted summary.
    """
    current = claude_cli.current_usage_log()
    return current[mark:], len(current)


def _summarize_usage(entries: list[dict]) -> dict:
    by_agent: dict[str, dict] = {}
    for e in entries:
        agent = e.get("agent", "unknown")
        usage = e.get("usage", {}) or {}
        bucket = by_agent.setdefault(agent, {
            "calls": 0,
            "input_tokens": 0,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
            "output_tokens": 0,
            "cost_usd": 0.0,
        })
        bucket["calls"] += 1
        bucket["input_tokens"] += usage.get("input_tokens", 0)
        bucket["cache_read_input_tokens"] += usage.get("cache_read_input_tokens", 0)
        bucket["cache_creation_input_tokens"] += usage.get("cache_creation_input_tokens", 0)
        bucket["output_tokens"] += usage.get("output_tokens", 0)
        bucket["cost_usd"] += e.get("cost_usd") or 0
    return {
        "by_agent": by_agent,
        "total_calls": len(entries),
        "total_cost_usd": sum(b["cost_usd"] for b in by_agent.values()),
    }


def _print_usage_summary(entries: list[dict], iter_n: int) -> dict | None:
    if not entries:
        return None
    summary = _summarize_usage(entries)
    lines = [f"\n📊 Iter {iter_n} token usage ({summary['total_calls']} Claude CLI call(s)):"]
    for agent, b in sorted(summary["by_agent"].items()):
        lines.append(
            f"   [{agent:<14}] calls: {b['calls']:>3}  "
            f"input: {b['input_tokens']:>8,}  cache_read: {b['cache_read_input_tokens']:>8,}  "
            f"cache_write: {b['cache_creation_input_tokens']:>8,}  output: {b['output_tokens']:>8,}  "
            f"cost: ${b['cost_usd']:.4f}"
        )
    lines.append(f"   TOTAL cost (USD): ${summary['total_cost_usd']:.4f}\n")
    print("\n".join(lines))
    return summary


def _finish_iteration_usage(run_id: str, iter_n: int, repo_root: Path, grand_total: dict) -> None:
    """Print + persist a usage summary for whatever accumulated in the shared
    usage log this iteration, then fold it into the run-wide grand total.
    Must be called on every iteration exit path (success, failure/continue,
    abandonment, session-limit return) — not just the happy path — so
    failed/retried Claude CLI usage is never silently discarded by the next
    iteration's reset_usage_log().
    """
    entries = reset_usage_log()
    summary = _print_usage_summary(entries, iter_n)
    if summary is None:
        return
    trace_logger.log_step(
        run_id=run_id, agent="usage-summary",
        input={"iter": iter_n}, output={},
        result=summary,
        traces_root=repo_root / "traces",
    )
    grand_total["total_calls"] += summary["total_calls"]
    grand_total["total_cost_usd"] += summary["total_cost_usd"]
```

Then rewrite the body of `autonomous_loop()` (from the `backlog_path = ...` line through the end of the function) to: wrap the `for i in range(max_iter):` loop in a `try/finally` that prints the run-wide grand total unconditionally; initialize `grand_total` and `usage_mark` per iteration; attach `_usage_since(usage_mark)` deltas to every existing `trace_logger.log_step(...)` call's `result` dict as a new `"usage"` key; and call `_finish_iteration_usage(run_id, i, repo_root, grand_total)` immediately before every `return`, `break`, and `continue` that ends an iteration's usage-tracking window (both `ClaudeCliError` branches for Designer/QA, the backlog-empty `break`, the Coder session-limit `return`, the success `break` — now placed *after* the optional meta-review block — and the Coder-abandonment `else` clause). The full resulting function:

```python
def autonomous_loop(
    workspace: str,
    max_iter: int = 20,
    repo_root: Path | None = None,
    meta_review: bool = False,
) -> None:
    if repo_root is None:
        repo_root = REPO_ROOT

    backlog_path = repo_root / "docs" / "specs" / workspace / "backlog.md"
    run_id = uuid.uuid4().hex
    workspace_dir = f"workspace-{workspace}/"
    grand_total = {"total_calls": 0, "total_cost_usd": 0.0}

    try:
        for i in range(max_iter):
            reset_usage_log()
            usage_mark = 0
            resume = _load_resume(workspace, repo_root)
            backlog_snapshot = backlog_path.read_text() if backlog_path.exists() else ""

            # --- Designer (skip if resuming with an existing spec) ---
            if "spec_path" in resume:
                spec_path = Path(resume["spec_path"])
                print(f"↩️  Resuming spec: {spec_path.name} (Designer skipped)")
            else:
                try:
                    spec_path = designer_agent.run_designer(workspace, backlog_path, repo_root)
                except ClaudeCliError as e:
                    step_usage, usage_mark = _usage_since(usage_mark)
                    trace_logger.log_step(
                        run_id=run_id, agent="designer",
                        input={"backlog": str(backlog_path)}, output={},
                        result={"success": False, "error": str(e), "usage": step_usage},
                        traces_root=repo_root / "traces",
                    )
                    print(f"⚠️  Designer failed (iter {i}): {e}")
                    if "session limit" in str(e).lower():
                        print(f"⛔ Session limit hit — stopping loop (retry is pointless)")
                        _finish_iteration_usage(run_id, i, repo_root, grand_total)
                        return
                    _finish_iteration_usage(run_id, i, repo_root, grand_total)
                    continue
                step_usage, usage_mark = _usage_since(usage_mark)
                trace_logger.log_step(
                    run_id=run_id, agent="designer",
                    input={"backlog": str(backlog_path)},
                    output={"spec_path": str(spec_path) if spec_path else "DONE"},
                    result={"iter": i, "done": spec_path is None, "usage": step_usage},
                    traces_root=repo_root / "traces",
                )
                if spec_path is None:
                    _clear_resume(workspace, repo_root)
                    print("✅ Backlog empty — loop complete")
                    _finish_iteration_usage(run_id, i, repo_root, grand_total)
                    break
                _save_resume(workspace, repo_root, {"spec_path": str(spec_path), "qa_done": False})

            # --- QA (skip if already done for this spec) ---
            if resume.get("qa_done", False):
                print(f"↩️  QA already done for {spec_path.name} (QA skipped)")
            else:
                try:
                    qa_agent.run_qa(workspace, spec_path, repo_root)
                except ClaudeCliError as e:
                    step_usage, usage_mark = _usage_since(usage_mark)
                    trace_logger.log_step(
                        run_id=run_id, agent="qa",
                        input={"spec": str(spec_path)}, output={},
                        result={"success": False, "error": str(e), "usage": step_usage},
                        traces_root=repo_root / "traces",
                    )
                    if "session limit" in str(e).lower():
                        print(f"⛔ Session limit hit — stopping loop (retry is pointless)")
                        _finish_iteration_usage(run_id, i, repo_root, grand_total)
                        return
                    if "spec_path" not in resume:
                        backlog_path.write_text(backlog_snapshot)
                        _clear_resume(workspace, repo_root)
                    _finish_iteration_usage(run_id, i, repo_root, grand_total)
                    continue
                step_usage, usage_mark = _usage_since(usage_mark)
                trace_logger.log_step(
                    run_id=run_id, agent="qa",
                    input={"spec": str(spec_path)}, output={},
                    result={"success": True, "usage": step_usage},
                    traces_root=repo_root / "traces",
                )
                _save_resume(workspace, repo_root, {"spec_path": str(spec_path), "qa_done": True})

            # --- Coder + validate loop ---
            coder_prompt = prompt_store.load("coder", repo_root, workspace=workspace)
            feedback: str | None = None

            for attempt in range(2):
                before = workspace_diff.changed_paths(repo_root, workspace_dir=workspace_dir)

                try:
                    claude_cli.call_coder(
                        system_prompt=coder_prompt,
                        task=spec_path.read_text(),
                        feedback=feedback,
                        repo_root=repo_root,
                        agent="coder",
                    )
                except ClaudeCliError as e:
                    feedback = str(e)
                    step_usage, usage_mark = _usage_since(usage_mark)
                    trace_logger.log_step(
                        run_id=run_id, agent="coder",
                        input={"feedback": feedback, "attempt": attempt}, output={},
                        result={"success": False, "error": str(e), "usage": step_usage},
                        traces_root=repo_root / "traces",
                    )
                    if "session limit" in feedback.lower():
                        print(f"⛔ Session limit hit — stopping loop (retry is pointless)")
                        _finish_iteration_usage(run_id, i, repo_root, grand_total)
                        return
                    continue

                changed = sorted(workspace_diff.changed_paths(repo_root, workspace_dir=workspace_dir) - before)
                changed_paths_list = [Path(p) for p in changed]

                if not changed_paths_list:
                    feedback = "No files were changed — implement the required changes."
                    continue

                build = npm_runner.run_build(workspace, repo_root)
                step_usage, usage_mark = _usage_since(usage_mark)
                trace_logger.log_step(
                    run_id=run_id, agent="build",
                    input={"attempt": attempt}, output={"changed": changed},
                    result={**dataclasses.asdict(build), "usage": step_usage},
                    traces_root=repo_root / "traces",
                )
                if not build.success:
                    feedback = (build.stdout + "\n" + build.stderr).strip()
                    continue

                unit = npm_runner.run_unit_tests(workspace, repo_root)
                step_usage, usage_mark = _usage_since(usage_mark)
                trace_logger.log_step(
                    run_id=run_id, agent="unit",
                    input={"attempt": attempt}, output={},
                    result={**dataclasses.asdict(unit), "usage": step_usage},
                    traces_root=repo_root / "traces",
                )
                if not unit.success:
                    feedback = (unit.stdout + "\n" + unit.stderr).strip()
                    continue

                e2e = npm_runner.run_e2e_tests(workspace, repo_root)
                step_usage, usage_mark = _usage_since(usage_mark)
                trace_logger.log_step(
                    run_id=run_id, agent="e2e",
                    input={"attempt": attempt}, output={},
                    result={**dataclasses.asdict(e2e), "usage": step_usage},
                    traces_root=repo_root / "traces",
                )
                if not e2e.success:
                    feedback = (e2e.stdout + "\n" + e2e.stderr).strip()
                    continue

                review = reviewer_agent.run_reviewer(changed_paths_list, repo_root)
                step_usage, usage_mark = _usage_since(usage_mark)
                trace_logger.log_step(
                    run_id=run_id, agent="reviewer",
                    input={"changed": changed}, output={"comments": review.comments},
                    result={**review.model_dump(), "usage": step_usage},
                    traces_root=repo_root / "traces",
                )

                if review.approved:
                    _git_commit(workspace, spec_path, repo_root, i)
                    _clear_resume(workspace, repo_root)
                    if meta_review:
                        try:
                            meta_items = meta_reviewer_agent.run_meta_review(
                                spec_path, changed_paths_list, repo_root, workspace=workspace
                            )
                            if meta_items:
                                _append_meta_review(backlog_path, meta_items, spec_path.stem, repo_root)
                                print(f"🤖 Meta-review: {len(meta_items)} suggestions added to backlog")
                        except Exception as e:
                            print(f"⚠️  Meta-review failed (non-fatal): {e}")
                    _finish_iteration_usage(run_id, i, repo_root, grand_total)
                    break

                feedback = "\n".join(review.comments)
            else:
                print(f"⚠️  All Coder retries failed for iter {i} — skipping spec")
                _escalate_backlog_strike(backlog_path, backlog_snapshot)
                _clear_resume(workspace, repo_root)
                _finish_iteration_usage(run_id, i, repo_root, grand_total)
    finally:
        print(
            f"\n💰 Run {run_id} grand total: {grand_total['total_calls']} Claude CLI call(s), "
            f"${grand_total['total_cost_usd']:.4f}\n"
        )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest tests/agents/test_claude_cli.py tests/test_autonomous_loop.py -v`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add agents/claude_cli.py autonomous_loop.py tests/agents/test_claude_cli.py tests/test_autonomous_loop.py
git commit -m "feat(loop): print+persist per-agent usage summary on every iteration exit path"
```

---

### Task 9: Full test suite + manual/integration verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/kyo.lai82/Projects/Personal/game-factory && python -m pytest -v`
Expected: PASS — every test green, including all pre-existing suites untouched by this plan (`tests/agents/test_gemini_client.py` if present, `tests/harness/test_trace_logger.py`, `tests/harness/test_workspace_diff.py` if present, `tests/agents/test_coder_agent.py`). If any pre-existing test outside this plan's file list fails, treat it the same way the battle-hud plan's Task 5 deviation did — diagnose whether it's a genuine regression from this plan's changes (fix it) or an unrelated pre-existing issue (note it, don't silently paper over it).

- [ ] **Step 2: Run a lint/type pass if configured**

Check for a linter config: `cd /Users/kyo.lai82/Projects/Personal/game-factory && ls ruff.toml .flake8 setup.cfg 2>/dev/null`. If one exists, run it and fix any new violations introduced by this plan's files (`autonomous_loop.py`, `agents/qa_agent.py`, `agents/claude_cli.py`, `agents/designer_agent.py`, `agents/reviewer_agent.py`, `agents/meta_reviewer_agent.py`, `harness/npm_runner.py`). If none exists, skip.

- [ ] **Step 3: Manual smoke test against the real pixel-squad workspace**

With LM Studio running locally (`LM_STUDIO_BASE_URL`, default `http://localhost:1234/v1`) and at least one unblocked backlog item in `docs/specs/pixel-squad/backlog.md`, run:
```bash
cd /Users/kyo.lai82/Projects/Personal/game-factory && python autonomous_loop.py --workspace pixel-squad --max-iter 1
```
Confirm:
- QA step logs `🤖 Using LM Studio for QA` (or falls back cleanly with a printed warning if LM Studio is down/prompt missing) instead of always shelling out to `claude`.
- If the Coder fails twice on the picked item, the backlog shows `- [!]` (not reverted to `- [ ]`) and no more than 2 Coder attempts ran.
- A `📊 Iter 0 token usage (...)` block prints with a per-agent breakdown (`[designer]`, `[qa]`, `[coder]`, etc.) regardless of whether the iteration succeeded, failed, or was abandoned.
- A `💰 Run <run_id> grand total: ...` line prints exactly once, at the very end, regardless of exit path.
- `traces/<run_id>/trace.jsonl` contains a `"agent": "usage-summary"` record with a `by_agent` breakdown, plus `"usage"` keys on the `designer`/`qa`/`coder`/`build`/`unit`/`e2e`/`reviewer` records.

- [ ] **Step 4: Fix any issues found in Step 3, re-run the affected task's tests, and commit**

```bash
git add -A
git commit -m "fix(loop): address issues found during manual pixel-squad smoke test"
```
(Only if Step 3 actually required changes — skip this commit otherwise.)

---

## Self-Review Notes

**Spec coverage:** Design doc §2 (QA → LM Studio, including the tag-parse pattern, path safety, and typecheck validation gate) → Tasks 1, 2, 3. §3 (Coder retry cap + backlog escalation, including the widened designer selection regex and prompt updates) → Tasks 4, 5, 6. §4 (usage observability — agent attribution, per-iteration summary on every exit path, trace_logger persistence, run-wide grand total) → Tasks 7, 8. §5 (testing plan) is covered exhaustively: QA LM success/zero-tag-fallback/typecheck-failure-fallback-with-cleanup/path-traversal-rejection → Task 2 Step 1; Coder abandons after 2 → Task 4; backlog `[ ]→[!]→[!!]` + relocation → Task 6; usage summary firing on failure/abandon paths + per-agent attribution → Task 8; designer regex `[!]`-selectable/`[!!]`-skipped → Task 5; `run_typecheck` pass/fail → Task 1. §6 out-of-scope items (usage report script, live rolling quota, `--max-budget-usd`) are not implemented anywhere in this plan.

**Deviations from the design doc's literal wording (found during exploration, not silently changed):**
1. `run_typecheck`'s bare `npx tsc --noEmit` doesn't actually cover `tests/` under `workspace-pixel-squad/tsconfig.json`'s `include: ["src/**/*.ts"]` — verified empirically that a broken test file is silently ignored unless passed as an explicit CLI argument. Task 1 adds an optional `paths` parameter so Task 2's QA validation gate can pass the exact files it just wrote; called with no `paths`, `run_typecheck` still behaves exactly as the design doc literally specifies.
2. `designer_agent.run_designer`'s existing `try/except` only catches `LmStudioError`, not a tag-parse failure (`DesignerError` today) — meaning Designer's own LM fallback doesn't actually work on parse failure, contrary to what "same pattern as Designer" implies. QA's `run_qa` in Task 2 implements the *intended* shape (catches both `LmStudioError` and its own `QaLmError`) rather than reproducing Designer's bug; fixing Designer's bug itself is out of scope (§3's designer_agent.py changes are the regex widening only, per the design doc's own file table).
3. `qa_agent.run_qa` needed a new `workspace: str` parameter — the pre-existing function hardcoded a generic `workspace/` diff directory that doesn't match the real `workspace-pixel-squad/` layout, and both the LM-prompt gate and the new typecheck gate need to know which workspace they're validating. Task 2 changes the signature to `run_qa(workspace, spec_path, repo_root)`; Task 3 updates the one production call site.
4. Task 3's exploration found no existing test in `tests/test_autonomous_loop.py` that would need rewriting for the QA→`qa_agent.run_qa` wiring (contrary to what the exploration brief assumed) — existing tests patch `claude_cli.call_coder` and `workspace_diff.changed_paths` broadly enough to keep passing either way, which is too weak to actually verify the wiring. Task 3 adds three new tests instead of modifying existing ones.
5. The design doc's prompt-update table (§3) names only `prompts/designer.txt` and `prompts/designer-lm-pixel-squad.txt`. Reading `harness/prompt_store.py` shows workspace-specific prompts always win, and `prompts/designer-pixel-squad.txt` exists — it, not the generic `designer.txt`, is the prompt actually used by the Claude-CLI fallback path for the exercised `pixel-squad` workspace. Task 6 updates all three, since skipping `designer-pixel-squad.txt` would leave the prompt that's actually exercised inconsistent with the strike system.
6. `agents/coder_agent.py` also calls `claude_cli.call_coder` but is unused dead code (confirmed by reading `autonomous_loop.py`'s Coder step, which inlines the call directly, exactly as QA used to). The design doc's own file list never mentions it, confirming it's intentionally out of scope — Task 7 does not touch it.
7. `call_coder`'s new `agent` parameter defaults to `"unknown"` rather than being required. The design doc doesn't specify a default; this choice keeps any future untagged call sites from breaking rather than crashing.
8. `designer_agent.py`'s own LM-path gating has a latent gap — it never checks `prompts/designer-lm-{workspace}.txt` exists before calling it, unlike the `.exists()` check this plan adds to `qa_agent.py`'s new LM path (per the design doc's explicit note: "this mirrors an existing latent gap in designer_agent.py too... Not introduced here, just matched for consistency" — i.e. QA is deliberately made more robust than Designer here, and Designer's gap is knowingly left unfixed).
9. `_escalate_backlog_strike`'s diff-based "which line did Designer just check off" detection falls back to a full snapshot revert (a no-op) when it can't identify a changed line — this occurs in the rare case of a resumed iteration where Designer was skipped and nothing changed. The design doc doesn't address this corner case either; this plan preserves the pre-existing ambiguity-handling behavior (silent revert) rather than inventing new logic for it, since a resumed-mid-crash iteration losing one escalation cycle is a pre-existing edge case, not a regression introduced here.
10. **Verified against the actual current source** (not just the design doc) before finalizing this plan: every cited line number in Tasks 1, 3, 4, 5, 7, 8 was checked against the real `autonomous_loop.py`, `agents/designer_agent.py`, `agents/claude_cli.py`, `harness/npm_runner.py`, and `harness/workspace_diff.py`/`harness/prompt_store.py` on disk, and all matched exactly. One bug was caught and fixed during this verification: `tests/test_autonomous_loop.py`'s existing `_make_repo()` helper returns a `backlog` path at `specs/pixel-squad-backlog.md` — a legacy layout that does **not** match the real `backlog_path` the loop computes at runtime (`docs/specs/{workspace}/backlog.md`, confirmed at `autonomous_loop.py` line 101). No pre-existing test actually exercises backlog-revert behavior, so this mismatch was latent and harmless until Task 3 added a new test that does. That test (`test_qa_failure_reverts_backlog_when_designer_just_ran`) was corrected to construct and assert against the real `docs/specs/pixel-squad/backlog.md` path directly, instead of trusting `_make_repo`'s mismatched fixture.

### Critical Files for Implementation
- /Users/kyo.lai82/Projects/Personal/game-factory/autonomous_loop.py
- /Users/kyo.lai82/Projects/Personal/game-factory/agents/qa_agent.py
- /Users/kyo.lai82/Projects/Personal/game-factory/agents/claude_cli.py
- /Users/kyo.lai82/Projects/Personal/game-factory/agents/designer_agent.py
- /Users/kyo.lai82/Projects/Personal/game-factory/harness/npm_runner.py
- /Users/kyo.lai82/Projects/Personal/game-factory/tests/test_autonomous_loop.py
