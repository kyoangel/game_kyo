# Mobile UX Fixes Design

## Summary

Three bug fixes for Math Merge 10 mobile experience:

1. **Pull-to-refresh blocks downward swipe** — browser pull-to-refresh triggers on downward swipe, making the "down" move impossible on mobile.
2. **Palette toggle misplaced** — `#hud-palette-toggle` is positioned absolutely inside `#game-container` (top-right corner of canvas). It must be a flex item inside `#hud`.
3. **Powerup slots hidden until unlocked** — `renderHudPowerups()` only renders buttons when count > 0, so new players never discover the powerup system. Locked slots should always be visible with a tooltip explaining how to unlock each.

---

## Fix 1: Pull-to-refresh Prevention

**Root cause:** `body` CSS has no `overscroll-behavior` rule. The `touchstart`/`touchend` handlers use `{ passive: true }`, so `preventDefault()` is unavailable.

**Fix:** Add to `index.html` `<style>`:

```css
html, body {
  overscroll-behavior: none;
}
```

One line, no JS changes needed. Tested pattern — standard for mobile canvas games.

**Scope:** `workspace/index.html` only.

---

## Fix 2: Palette Toggle Moves to HUD

**Root cause:** In `index.html`, `<button id="hud-palette-toggle">` is a child of `#game-container` (line 215), with CSS `position: absolute; top: 8px; right: 8px; z-index: 10`. It is NOT inside `#hud`.

**Fix — HTML:** Move the button from `#game-container` into `#hud`, placed between `#hud-powerups` and `#hud-mute`:

```html
<div id="hud">
  <span id="hud-score">Score: 0</span>
  <span id="hud-best">Best: 0</span>
  <div id="hud-powerups"></div>
  <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>  <!-- moved here -->
  <button id="hud-mute" aria-label="靜音">🔊</button>
</div>
```

**Fix — CSS:** Replace the `#hud-palette-toggle` rule (remove `position: absolute; top; right; z-index`) with a flex-item style matching `#hud-mute`:

```css
#hud-palette-toggle,
#hud-mute {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
}
```

**No `game.ts` changes needed** — `getElementById("hud-palette-toggle")` already works regardless of DOM position.

**Scope:** `workspace/index.html` only.

---

## Fix 3: Locked Powerup Slots with Tooltip

### Behaviour

All 4 powerup slots (`hammer`, `shuffle`, `addOne`, `bomb`) are **always rendered** in `#hud-powerups`.

| State | Appearance | Interaction |
|-------|-----------|-------------|
| count = 0 (locked) | Dimmed icon + 🔒 badge (bottom-right) | Click → tooltip popover above button |
| count > 0 (unlocked) | Bright icon + count badge (current) | Click → activate powerup (current) |

### Tooltip Content

| Powerup | Unlock condition text |
|---------|-----------------------|
| 🔨 Hammer | 每玩 5 局隨機獲得 |
| 🔀 Shuffle | 每玩 5 局隨機獲得 |
| ➕ Add One | 每玩 10 局獲得 |
| 💣 Bomb | 分數首次突破 50 分獲得；每超過 100 分再獲得一顆 |

### Tooltip Implementation

- Pure JS toggle — clicking a locked button sets `data-tooltip-open="true"` on it; clicking elsewhere (or clicking again) removes the attribute.
- Tooltip rendered as a `<span class="powerup-tooltip">` child of the button, shown via CSS `[data-tooltip-open="true"] .powerup-tooltip { display: block; }`.
- Positioned: `position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);` — floats above the button, centered.
- Auto-dismiss: `document.addEventListener("click", ...)` closes any open tooltip when clicking outside.
- `#hud-powerups` needs `position: relative` removed (buttons handle their own stacking); tooltip uses `z-index: 50`.

### CSS additions (in `index.html`)

```css
.hud-powerup-btn[data-locked="true"] {
  opacity: 0.4;
}
.powerup-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: #e5e7eb;
  font-size: 11px;
  white-space: nowrap;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #374151;
  pointer-events: none;
  z-index: 50;
}
.hud-powerup-btn[data-tooltip-open="true"] .powerup-tooltip {
  display: block;
}
```

### `game.ts` changes — `renderHudPowerups()`

Replace the existing function with a version that always renders all 4 buttons:

```typescript
const POWERUP_UNLOCK_TIPS: Record<PowerupId, string> = {
  hammer:  "每玩 5 局隨機獲得",
  shuffle: "每玩 5 局隨機獲得",
  addOne:  "每玩 10 局獲得",
  bomb:    "分數突破 50 分獲得；每過 100 分再得一顆",
};

function renderHudPowerups(): void {
  const container = document.getElementById("hud-powerups")!;
  container.innerHTML = "";
  const defs: Array<{ id: PowerupId; icon: string }> = [
    { id: "hammer",  icon: "🔨" },
    { id: "shuffle", icon: "🔀" },
    { id: "addOne",  icon: "➕" },
    { id: "bomb",    icon: "💣" },
  ];

  defs.forEach(({ id, icon }) => {
    const count = powerups[id];
    const locked = count === 0;
    const btn = document.createElement("button");
    btn.className = "hud-powerup-btn";
    btn.dataset.powerup = id;
    btn.dataset.locked = String(locked);
    btn.dataset.active = String(activePowerup === id);
    btn.title = locked ? "" : id;

    const badge = locked
      ? `<span class="hud-powerup-count">🔒</span>`
      : `<span class="hud-powerup-count">${count}</span>`;
    const tooltip = locked
      ? `<span class="powerup-tooltip">${POWERUP_UNLOCK_TIPS[id]}</span>`
      : "";

    btn.innerHTML = `${icon}${badge}${tooltip}`;

    btn.addEventListener("click", (e) => {
      if (locked) {
        e.stopPropagation();
        const isOpen = btn.dataset.tooltipOpen === "true";
        // close all other tooltips
        container.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
          (el) => delete el.dataset.tooltipOpen
        );
        if (!isOpen) btn.dataset.tooltipOpen = "true";
        return;
      }
      activePowerup = activePowerup === id ? null : id;
      canvas.style.outline = activePowerup ? "3px solid #f59e0b" : "";
      renderHudPowerups();
    });

    container.appendChild(btn);
  });
}

// Global dismiss listener (add once at module level, outside the function)
document.addEventListener("click", () => {
  document.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
    (el) => delete el.dataset.tooltipOpen
  );
});
```

**Scope:** `workspace/index.html` (CSS), `workspace/src/game.ts` (`renderHudPowerups` + global dismiss listener).

---

## Testing

| Test | Type | What to verify |
|------|------|----------------|
| `overscroll-behavior: none` prevents pull-to-refresh | E2E | Simulate `touchstart` + `touchmove` downward on canvas; page must not reload |
| Palette toggle visible in HUD, not on canvas | E2E | `#hud-palette-toggle` is inside `#hud`; clicking cycles palette |
| All 4 powerup slots always visible | E2E | Fresh state (0 powerups): all 4 buttons present, `data-locked="true"` |
| Locked powerup tooltip opens on click | E2E | Click locked button → `.powerup-tooltip` becomes visible |
| Tooltip dismisses on outside click | E2E | Click document → tooltip hidden |
| Unlocked powerup still activates on click | E2E (existing) | `__setPowerups({hammer:1,...})` → hammer button active; canvas click removes tile |

---

## Files Changed

| File | Change |
|------|--------|
| `workspace/index.html` | `overscroll-behavior: none`; move palette button into `#hud`; fix palette CSS; add tooltip CSS |
| `workspace/src/game.ts` | Replace `renderHudPowerups()`; add `POWERUP_UNLOCK_TIPS`; add global dismiss listener |
| `workspace/tests/e2e/ux-v2.spec.ts` | Add/update tests for the above behaviours |
