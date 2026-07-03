# Autonomous Loop — Budget Efficiency & Observability — Design Spec
**Date:** 2026-07-04
**Target:** `autonomous_loop.py` + `agents/*` (workspace-agnostic, exercised via `pixel-squad`)

---

## 1. Overview

Three independent problems with how the autonomous loop spends Claude usage:

1. **QA always burns Claude CLI**, even though Designer and Reviewer already have a cheap local-LM-first path via LM Studio.
2. **Coder retries 6x on a failing spec** with no early exit, and worse — abandoning a spec today reverts the backlog item to unchecked, so a genuinely hard spec can be re-picked and re-attempted indefinitely across loop iterations.
3. **Usage/cost visibility is broken**: the existing per-iteration summary only prints on a *successful* iteration. Every failure or abandonment path — which is exactly where wasted quota goes — silently discards its usage data. There's also no per-agent breakdown (Designer vs QA vs Coder vs Reviewer), and nothing is persisted, so historical runs can't be analyzed after the fact.

A fourth item raised in discussion — not running the loop immediately after a long interactive chat — is **not addressed here**: `agents/claude_cli.py` shells out to `claude -p`, which shares the exact same usage pool as an interactive session, and there is no API for a script to query remaining quota. This stays a scheduling habit, not a code change.

```
Designer (LM Studio → Claude CLI fallback)
  → QA (LM Studio → typecheck gate → Claude CLI fallback)   [NEW]
  → Coder × up to 2 attempts (was 6)                          [CHANGED]
      → npm build + unit + e2e → Reviewer (Gemini → LM Studio → Claude CLI)
  → on abandon: escalate backlog strike, block after 2         [NEW]
  → usage summary printed + persisted on every iteration exit  [NEW]
```

---

## 2. QA → LM Studio

Mirrors `designer_agent.py`'s tag-parse pattern, generalized to multiple output files (QA often needs a test file *and* shared helpers — see the currently-uncommitted `tests/unit/support/specLineRef.ts`).

### New/changed files
| File | Change |
|------|--------|
| `agents/qa_agent.py` | Add `_run_lm_qa()` + fallback logic (same shape as `designer_agent.run_designer`). `run_qa()` becomes the single entry point. |
| `autonomous_loop.py` | QA step calls `qa_agent.run_qa(...)` instead of inlining `claude_cli.call_coder(...)` directly (removes existing duplication — the loop currently bypasses `qa_agent.py` entirely). |
| `harness/npm_runner.py` | Add `run_typecheck(workspace, repo_root)` → `npx tsc --noEmit` in the workspace dir (reuses existing tsconfig, no bundling). |
| `prompts/qa-lm-pixel-squad.txt` | New — tag-based output format prompt for the LM path. |

### LM output format
```
<test_file path="tests/unit/Foo.test.ts">
...content...
</test_file>
<test_file path="tests/unit/support/bar.ts">
...content...
</test_file>
```
- Regex-extract all `<test_file path="...">` blocks; zero matches → `QaLmError` → fallback (same pattern as Designer's missing-tag handling).
- **Path safety**: each `path` must resolve inside `tests/` (no `..`, no absolute paths) — enforced in Python, since LM Studio output isn't tool-permission-sandboxed the way Claude CLI's `acceptEdits` session is. Violation → treat as parse failure → fallback.
- Model: `LM_STUDIO_MODEL_CODER` (matches `reviewer_agent`'s fallback convention for structured/code output, vs. Designer's use of the default model for prose).

### Validation gate
After the LM path writes files, run `run_typecheck`. Rationale for *type-check* rather than *running the tests*: QA tests are supposed to fail red (TDD — feature not implemented yet), so "tests pass" can't be the success signal. A type-check catches genuinely broken LM output (bad imports, syntax errors) without misclassifying the expected red state as a failure.
- Typecheck fails → delete files the LM just wrote (restore from a pre-write backup if any path overwrote an existing file) → fall back to full Claude CLI QA on a clean tree.
- Typecheck passes → keep the files.

### Gating on LM path
Same convention as Designer: attempt the LM path only if `lm_studio_client.is_available()` **and** `prompts/qa-lm-{workspace}.txt` exists. No LM prompt for a workspace → straight to Claude CLI, no error. (Note: this mirrors an existing latent gap in `designer_agent.py` too — a workspace without `designer-lm-{workspace}.txt` would hit an uncaught `FileNotFoundError`. Not introduced here, just matched for consistency.)

---

## 3. Coder retry cap + backlog escalation

### Retry cap
The coder attempt loop never has an interleaved success (a success always `break`s immediately), so "abandon after 2 consecutive failures" collapses to a one-line change:

```python
for attempt in range(6):   # →  for attempt in range(2):
```

The existing `for...else` abandonment block already does the right thing when attempts are exhausted — no new control flow needed there.

### Backlog escalation (what makes the lower cap actually save budget)
Today, abandonment does `backlog_path.write_text(backlog_snapshot)` — unconditionally reverting the item to `- [ ]`. That means a hard spec gets reselected by Designer next iteration and Designer→QA→Coder reruns from scratch, up to `--max-iter` (default 20) times. Lowering the cap to 2 makes each cycle cheaper but could make the *total* cost across a stuck backlog item worse.

**Data model** — encode a strike count in the checkbox marker:
- `- [ ]` — 0 strikes
- `- [!]` — 1 strike, still eligible for one more retry
- `- [!!]` — 2 strikes, **blocked**, physically moved to a `## ⚠️ 已封鎖（需人工介入）` section, never reselected

**Changes:**
| File | Change |
|------|--------|
| `autonomous_loop.py` | Abandonment path: diff `backlog_snapshot` vs. current backlog line-by-line to find which line Designer just checked off; escalate `- [ ]`→`- [!]` in place, or if already `- [!]`, remove it and append under the blocked section as `- [!!]` (same append-a-section style as the existing `_append_meta_review`). |
| `agents/designer_agent.py` | Selection regex (LM-path context builder + Claude-CLI fallback path) changes from `- \[ \]` to `- \[[ !]\]` so 1-strike items remain eligible. `- [!!]` (two chars) naturally never matches this single-char class — no separate blocked-section skip logic needed. |
| `agents/designer_agent.py` | Same regex widened in the "mark as done on success" substitution (currently only matches `- [ ]`). |
| `prompts/designer.txt`, `prompts/designer-lm-pixel-squad.txt` | Mention the `[!]` retry-eligible state so the Claude-CLI fallback path's own reasoning stays consistent with what the Python code does afterward. |

---

## 4. Usage observability

### The bug
`_print_usage_summary` is only called from the `review.approved` success branch. Every other exit — Designer/QA failure `continue`, Coder retry `continue`, Coder final abandonment (`for...else`), `session limit` early `return` — leaves `_usage_log` to be silently discarded by the *next* iteration's `reset_usage_log()` call. Failed/abandoned attempts are exactly where retried Claude CLI calls burn quota with nothing to show for it, so today's summary is blind to most of the real spend.

There's also no attribution: every `claude_cli.call_coder()` call from every agent dumps into the same untagged `_usage_log`, so even the successful-path summary can't show "QA cost more than Coder this run."

### Changes
| File | Change |
|------|--------|
| `agents/claude_cli.py` | `call_coder(...)` gains an `agent: str` parameter, included in each `_usage_log.append({...})` entry. |
| `agents/designer_agent.py`, `agents/qa_agent.py`, `agents/reviewer_agent.py`, `agents/meta_reviewer_agent.py`, `autonomous_loop.py` (coder step) | Pass their role name (`"designer"`, `"qa"`, `"coder"`, `"reviewer"`, `"meta-reviewer"`) at each call site. |
| `autonomous_loop.py` | Print (and persist) a usage summary on **every** iteration exit path, not just success — grouped by agent. Track a running grand total across the whole `autonomous_loop()` invocation, printed at the end regardless of how the loop terminates (backlog empty, max-iter reached, session-limit hit). |
| `harness/trace_logger.py` / call sites | Attach the usage entries accumulated during each step to that step's `trace_logger.log_step(...)` call, so `traces/{run_id}/trace.jsonl` becomes a persistent, per-agent-attributed cost record — answering "what did last night's run actually cost" after the terminal is gone, not just live. |

No new report/analysis script in this pass — the persisted trace data is enough to query manually (`jq` over `trace.jsonl`) for now; a dedicated report command can be a follow-up once there's enough historical data to make one useful.

---

## 5. Testing plan

- `tests/agents/test_qa_agent.py` — add cases for: LM path success (multi-file write), LM path zero-tag-match fallback, LM path typecheck-failure fallback (+ cleanup of written files), path-traversal rejection.
- `tests/test_autonomous_loop.py` (or equivalent) — coder loop abandons after 2 failures; backlog escalation `[ ]→[!]→[!!]`+relocation; usage summary fires on failure/abandon paths, not just success; per-agent usage attribution.
- `agents/designer_agent.py` selection regex — unit test that `[!]` items remain selectable and `[!!]` items are skipped.
- Existing `npm_runner` tests — add `run_typecheck` case (both pass and fail).

## 6. Out of scope
- Live rolling 5-hour-quota visibility (no API exists for this from a script).
- A dedicated historical usage report/CLI (deferred — revisit once trace data accumulates).
- `--max-budget-usd` per-call hard spend cap (discovered as an available `claude -p` flag; not requested, noted here for future reference).
