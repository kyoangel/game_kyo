# HUD Layout Fix Design

## Summary

Restructure the HUD from a single crowded flex row into two rows — scores on top, buttons below — so it doesn't overflow on narrow mobile screens and cause horizontal scroll.

---

## Problem

The HUD currently contains in one row: Score text, Best text, up to 4 powerup buttons (44px each), ❓, 🏆, 🎨, 🔊. On a 390px iPhone the canvas is ~374px wide, but the HUD content totals ~550px — it overflows and the entire page scrolls horizontally.

---

## HTML Changes

Wrap the two text spans in `#hud-scores`, and wrap all buttons in `#hud-buttons`:

```html
<div id="hud">
  <div id="hud-scores">
    <span id="hud-score">Score: 0</span>
    <span id="hud-best">Best: 0</span>
  </div>
  <div id="hud-buttons">
    <div id="hud-powerups"></div>
    <button id="hud-powerup-info" aria-label="道具說明">❓</button>
    <button id="hud-trophy" aria-label="生涯獎盃">🏆</button>
    <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
    <button id="hud-mute" aria-label="靜音">🔊</button>
  </div>
</div>
```

All element IDs are unchanged — `game.ts` requires no modifications.

---

## CSS Changes

```css
/* Change #hud from row to column */
#hud {
  flex-direction: column;
  gap: 6px;
}

/* Row 1: Score left, Best right */
#hud-scores {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

/* Row 2: Powerup buttons left, icon buttons right */
#hud-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 4px;
}
```

Also add `overflow-x: hidden` to `html, body` as a safety net:

```css
html, body {
  overscroll-behavior: none;
  overflow-x: hidden;
}
```

---

## JS Changes

None. All element IDs remain identical.

---

## Files Changed

| File | Change |
|------|--------|
| `workspace/index.html` | HTML restructure + CSS changes |

---

## Testing

- E2E: HUD renders in two rows on narrow viewport (≤390px)
- E2E: Score and Best text visible on top row
- E2E: All buttons (powerup, ❓, 🏆, 🎨, 🔊) visible on bottom row
- E2E: No horizontal scroll at 390px viewport width
- E2E: Existing button interactions (mute, palette, trophy modal, powerup modal) still work
