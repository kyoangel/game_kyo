# Autonomous Development Loop — Design Spec
**Date:** 2026-06-25  
**Target:** `workspace-pixel-squad`  
**Approach:** Method B — npm runner (no Docker)

---

## 1. Overview

An autonomous Python loop that continuously picks the next feature from a backlog, designs a spec, writes tests, implements, validates, and commits — without human intervention. Stops when the backlog is empty.

```
while backlog not empty:
    Designer  →  QA (write tests)  →  Coder (implement)
    →  npm build + unit + e2e  →  Reviewer (Gemini)
    →  git commit  →  repeat
```

---

## 2. New Files

| File | Purpose |
|------|---------|
| `autonomous_loop.py` | Entry point: `python autonomous_loop.py --workspace pixel-squad` |
| `agents/designer_agent.py` | Designer agent — reads backlog + codebase, writes spec |
| `harness/npm_runner.py` | npm-based build/test runner (replaces Docker for pixel-squad) |
| `prompts/designer-pixel-squad.txt` | Designer system prompt scoped to pixel-squad |
| `prompts/coder-pixel-squad.txt` | Coder system prompt scoped to pixel-squad |
| `prompts/qa-pixel-squad.txt` | QA system prompt scoped to pixel-squad |
| `specs/pixel-squad-backlog.md` | Feature backlog (human-seeded, Designer maintains) |

---

## 3. Unchanged Files

- `orchestrator.py` — not modified (merge10 loop unaffected)
- `harness/sandbox_runner.py` — not modified
- `agents/coder_agent.py`, `qa_agent.py`, `reviewer_agent.py` — not modified
- All existing `prompts/*.txt` — not modified

---

## 4. Modified Files

### `harness/prompt_store.py`
Add optional `workspace` parameter to `load()`:

```python
def load(name: str, repo_root: Path, workspace: str | None = None) -> str:
    if workspace:
        specific = repo_root / "prompts" / f"{name}-{workspace}.txt"
        if specific.exists():
            return specific.read_text()
    return (repo_root / "prompts" / f"{name}.txt").read_text()
```

Backward-compatible: all existing callers continue to work unchanged.

---

## 5. Designer Agent

### `agents/designer_agent.py`

**Inputs (auto-read each call):**
- `specs/pixel-squad-backlog.md` — first unchecked `[ ]` item
- `workspace-pixel-squad/src/` — key file list for codebase context
- Web search available via `--tools WebSearch` flag on claude CLI

**Outputs (written to disk):**
- `specs/pixel-squad-<feature-slug>.md` — implementation spec for this iteration
- Updated `specs/pixel-squad-backlog.md` — marks current item `[x]`, may append new items

**Signal to loop via stdout last line:**
```
SPEC_PATH: specs/pixel-squad-skill-system.md   # proceed
SPEC_PATH: DONE                                 # backlog empty, stop
```

**`run_designer()` signature:**
```python
def run_designer(
    workspace: str,
    backlog_path: Path,
    repo_root: Path,
) -> Path | None:
    # Returns Path to spec, or None if DONE
```

---

## 6. npm_runner

### `harness/npm_runner.py`

Replaces Docker sandbox for pixel-squad. Returns the same `SandboxResult` dataclass.

```python
def run_build(workspace: str, repo_root: Path) -> SandboxResult
    # npm run build  in repo_root/workspace

def run_unit_tests(workspace: str, repo_root: Path) -> SandboxResult
    # npm run test:unit  in repo_root/workspace

def run_e2e_tests(workspace: str, repo_root: Path) -> SandboxResult
    # npm run test:e2e  in repo_root/workspace
```

Timeout: 120s build, 120s unit, 300s e2e (matching existing Docker timeouts).

---

## 7. autonomous_loop.py

### CLI
```
python autonomous_loop.py --workspace pixel-squad [--max-iter 20]
```

Default `--max-iter`: 20 (safety cap; loop exits early if backlog empties first).

### Flow

```python
def autonomous_loop(workspace: str, max_iter: int = 20):
    backlog_path = REPO_ROOT / "specs" / f"{workspace}-backlog.md"

    for i in range(max_iter):
        # Phase 1: Design
        spec_path = designer_agent.run_designer(workspace, backlog_path, REPO_ROOT)
        if spec_path is None:
            print("✅ Backlog empty — loop complete")
            break

        feedback: str | None = None

        # Phase 2: QA writes tests first (TDD)
        # autonomous_loop calls claude_cli directly with workspace-specific prompts
        # (bypasses qa_agent/coder_agent wrappers which hardcode prompt names)
        qa_prompt = prompt_store.load("qa", REPO_ROOT, workspace=workspace)
        claude_cli.call_coder(system_prompt=qa_prompt, task=spec_path.read_text(), repo_root=REPO_ROOT)

        # Phase 3: Coder + validate loop (max 3 retries)
        coder_prompt = prompt_store.load("coder", REPO_ROOT, workspace=workspace)
        for attempt in range(3):
            before = workspace_diff.changed_paths(REPO_ROOT)
            claude_cli.call_coder(
                system_prompt=coder_prompt,
                task=spec_path.read_text(),
                feedback=feedback,
                repo_root=REPO_ROOT,
            )
            changed_files = sorted(workspace_diff.changed_paths(REPO_ROOT) - before)

            build = npm_runner.run_build(workspace, REPO_ROOT)
            if not build.success:
                feedback = build.stderr
                continue

            unit = npm_runner.run_unit_tests(workspace, REPO_ROOT)
            if not unit.success:
                feedback = unit.stdout
                continue

            e2e = npm_runner.run_e2e_tests(workspace, REPO_ROOT)
            if not e2e.success:
                feedback = e2e.stdout
                continue

            review = reviewer_agent.run_reviewer(changed_files, REPO_ROOT)
            if review.approved:
                _git_commit(workspace, spec_path, REPO_ROOT)
                break

            feedback = "\n".join(review.comments)

        # trace each iteration
        trace_logger.log_step(run_id=run_id, agent="autonomous_loop",
                              input=str(spec_path), output=[], result={"iter": i},
                              traces_root=REPO_ROOT / "traces")
```

### Git commit per iteration
Each successful iteration commits:
- `workspace-pixel-squad/src/**` changed files
- `specs/pixel-squad-<feature>.md` new spec
- `specs/pixel-squad-backlog.md` updated backlog

Commit message: `feat(pixel-squad): <feature-slug> [autonomous loop iter N]`

---

## 8. Backlog Format

File: `specs/pixel-squad-backlog.md`

```markdown
# pixel-squad backlog

- [ ] 角色技能系統（heal / buff 實際生效）
- [ ] Archetype 效果（坦克減傷、狙擊暴擊等）
- [ ] 廢土幣商店（買技能 / 補給品）
- [ ] 陣型效果（位置 0 前排減傷、位置 4 後排）
- [ ] 支線任務差異化獎勵
- [ ] 通關後 New Game+ 或挑戰模式
```

- Designer reads first `[ ]` item each iteration
- Marks it `[x]` after writing spec
- May append new `[ ]` items at the bottom (competitor analysis findings)
- Loop stops when zero `[ ]` items remain

---

## 9. Prompt Files

### `prompts/designer-pixel-squad.txt`
Instructs the Designer to:
- Read backlog, identify first `[ ]` item
- Summarize current `workspace-pixel-squad/src/` state
- Optionally WebSearch competitive games for UX inspiration
- Write a spec to `specs/pixel-squad-<slug>.md` with: goal, rules, data model changes, UI changes, acceptance criteria
- Update backlog
- Print `SPEC_PATH: <path>` as the last line of output

### `prompts/coder-pixel-squad.txt`
Instructs the Coder to:
- Read the spec from `specs/pixel-squad-*.md`
- Modify only `workspace-pixel-squad/src/` and `workspace-pixel-squad/tests/`
- Ensure `npm run build` passes
- List changed files in output

### `prompts/qa-pixel-squad.txt`
Instructs the QA to:
- Read the spec
- Write failing tests in `workspace-pixel-squad/tests/unit/` before implementation
- Cover acceptance criteria from the spec
- Not modify `src/` files

---

## 10. Trace Logging

Each iteration logs to `traces/<run-id>/trace.jsonl` using existing `trace_logger.log_step()`:

| Step | agent field |
|------|-------------|
| Designer call | `"designer"` |
| QA call | `"qa"` |
| Coder call | `"coder"` |
| npm build | `"build"` |
| npm unit | `"unit"` |
| npm e2e | `"e2e"` |
| Reviewer call | `"reviewer"` |

Format identical to existing traces — compatible with any existing trace analysis tooling.

---

## 11. Success Criteria

- `python autonomous_loop.py --workspace pixel-squad` runs end-to-end without human input
- Each backlog item produces a committed spec + implementation + passing tests
- Loop exits cleanly when backlog is empty
- merge10 workflow (`python orchestrator.py`) unaffected
- All traces written to `traces/` in existing format
