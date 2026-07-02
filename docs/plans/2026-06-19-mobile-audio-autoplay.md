# Mobile Audio Autoplay 修正 (Subsystem C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix silent audio on first mobile session by calling `AudioContext.resume()` whenever the context is suspended.

**Architecture:** Single one-line fix in `AudioEngine.getCtx()` (`workspace/src/audio.ts`). Every call to `play()` routes through `getCtx()`, which already gates on `this._muted`. Adding a `suspended` check there handles all cases — first launch, background/foreground transitions — without touching `game.ts` or adding public API surface.

**Tech Stack:** TypeScript, Web Audio API, Vitest (unit tests with `vi.stubGlobal`)

---

## File Structure

| File | Change |
|------|--------|
| `workspace/src/audio.ts` | `getCtx()`: add one line — `if (this.ctx.state === 'suspended') this.ctx.resume();` |
| `workspace/tests/unit/audio.test.ts` | NEW — 2 unit tests: suspended → resume called; running → not called |

---

### Task 1: AudioContext resume on suspended state

**Files:**
- Create: `workspace/tests/unit/audio.test.ts`
- Modify: `workspace/src/audio.ts`

- [ ] **Step 1: Write failing unit tests**

Create `workspace/tests/unit/audio.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { AudioEngine } from "../../src/audio";

function makeMockCtx(state: "suspended" | "running" | "closed") {
  return {
    state,
    resume: vi.fn().mockResolvedValue(undefined),
    currentTime: 0,
    destination: {},
    createOscillator: () => ({
      connect: vi.fn(),
      type: "sine" as OscillatorType,
      frequency: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createGain: () => ({
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    }),
  };
}

describe("AudioEngine", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls resume() when AudioContext is suspended", () => {
    const mockCtx = makeMockCtx("suspended");
    vi.stubGlobal("AudioContext", vi.fn(() => mockCtx));
    const engine = new AudioEngine();
    engine.play("move");
    expect(mockCtx.resume).toHaveBeenCalledOnce();
  });

  it("does not call resume() when AudioContext is already running", () => {
    const mockCtx = makeMockCtx("running");
    vi.stubGlobal("AudioContext", vi.fn(() => mockCtx));
    const engine = new AudioEngine();
    engine.play("move");
    expect(mockCtx.resume).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd workspace && npm run test:unit -- --reporter=verbose 2>&1 | grep -A3 "AudioEngine"
```

Expected: FAIL — "calls resume() when AudioContext is suspended" fails because `resume` is never called.

- [ ] **Step 3: Fix AudioEngine.getCtx() in audio.ts**

In `workspace/src/audio.ts`, find the `getCtx()` method (lines 47–49):

```typescript
  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }
```

Replace with:

```typescript
  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd workspace && npm run test:unit -- --reporter=verbose 2>&1 | grep -A3 "AudioEngine"
```

Expected: 2 PASS

- [ ] **Step 5: Run all unit tests to confirm no regressions**

```bash
cd workspace && npm run test:unit
```

Expected: all existing tests PASS (the trophies tests must still be green)

- [ ] **Step 6: Commit**

```bash
git add workspace/tests/unit/audio.test.ts workspace/src/audio.ts
git commit -m "fix: resume suspended AudioContext on mobile to enable audio"
```
