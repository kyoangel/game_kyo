# Mobile Audio Autoplay 修正設計 (Subsystem C)

## Summary

修正行動裝置（iOS Safari、Chrome Android）開啟遊戲後沒有聲音的問題。根因是 Web Audio API 的 `AudioContext` 在行動瀏覽器中預設以 `suspended` 狀態建立，必須在用戶手勢的執行上下文中明確呼叫 `.resume()` 才能播放音效。

---

## 問題根因

`workspace/src/audio.ts` 的 `getCtx()` 只建立 `AudioContext` 但不 resume：

```typescript
// audio.ts:47–49（現有程式碼）
private getCtx(): AudioContext {
  if (!this.ctx) this.ctx = new AudioContext();
  return this.ctx;  // 行動裝置上此時 ctx.state === 'suspended'
}
```

所有 `play()` 呼叫都透過 `getCtx()` 取得 context，因此所有音效在行動裝置首次觸發時都無聲。

---

## 修正設計

### `workspace/src/audio.ts` — `getCtx()` 加入 resume 檢查

```typescript
private getCtx(): AudioContext {
  if (!this.ctx) this.ctx = new AudioContext();
  if (this.ctx.state === 'suspended') this.ctx.resume();
  return this.ctx;
}
```

**設計說明：**

- `.resume()` 回傳 Promise，此處 fire-and-forget（不 await）。  
  `play()` 永遠從 user gesture handler（touchend、click）被呼叫，`resume()` 在 gesture 執行上下文中執行，Promise 在同一 micro-task 佇列中 resolve，音效幾乎同步播出。
- 唯一例外：`gameOver` 音效在 `setTimeout(..., 400ms)` 中呼叫（`game.ts:752`）。此時用戶手勢已發生、ctx 已 resume，不受影響。
- 背景/前台切換（頁面被最小化後回來）：部分瀏覽器會將 AudioContext 重新置為 `suspended`。此設計因為每次 `play()` 都檢查，可自動處理此情況。
- `play()` 有 `if (this._muted) return` 提前返回（`audio.ts:32`），muted 狀態下 `getCtx()` 不會被呼叫，無副作用。

---

## 測試策略

新增 `workspace/tests/unit/audio.test.ts`，使用 vitest 的 `vi.stubGlobal` mock `AudioContext`（Node.js 無原生 Web Audio API）。

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioEngine } from "../../src/audio";

function makeMockCtx(state: AudioContext["state"]) {
  return {
    state,
    resume: vi.fn().mockResolvedValue(undefined),
    currentTime: 0,
    destination: {},
    createOscillator: () => ({
      connect: vi.fn(),
      type: "sine",
      frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createGain: () => ({
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
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

---

## 不在範圍

- AudioContext 的 `onstatechange` 監聽（過度設計）
- 音效預載入 / buffer 機制（現有 Web Audio oscillator 方案不需要）
- 任何 game.ts 修改

---

## 檔案異動清單

| 檔案 | 異動 |
|------|------|
| `workspace/src/audio.ts` | `getCtx()` 加一行：`if (this.ctx.state === 'suspended') this.ctx.resume();` |
| `workspace/tests/unit/audio.test.ts` | 新增（2 tests） |
