# Powerup UX Improvements Design

## Summary

Three fixes for Math Merge 10's powerup experience and a viewport height correction:

1. **Viewport fix** — `100vh` causes mobile layout to scroll when browser chrome appears; replace with `100dvh`.
2. **Powerup description modal** — players have no way to learn what each powerup does; add a ❓ button that opens a modal with descriptions and unlock conditions.
3. **Add One on 9** — currently a no-op; change to eliminate the tile immediately (score +10).
4. **Powerup unlock rebalancing** — unlock thresholds lowered across the board; bomb no longer tied to best score (which causes a plateau problem).

---

## Fix 1: Viewport Height

**Root cause:** `body { min-height: 100vh }` uses the static viewport height (includes browser chrome). On mobile, when the address bar appears, the actual visible area is smaller than `100vh`, creating scrollable space — which lets the user scroll the game upward and hide the HUD behind the browser chrome.

**Fix:** Change `min-height: 100vh` to `min-height: 100dvh` in `workspace/index.html`.

`100dvh` is the *dynamic* viewport height — it updates as browser chrome shows/hides, so the layout always fills exactly the visible area with no overflow.

**Scope:** `workspace/index.html` only (one line).

---

## Fix 2: Powerup Description Modal

### UI

A `<button id="hud-powerup-info">❓</button>` is added as the rightmost flex item in `#hud` (same style as `#hud-mute` — 44×44px circle button).

Clicking it opens `<div id="powerup-modal">`, a fullscreen semi-transparent overlay containing a centered card. The card lists all 4 powerups. Clicking the overlay or the `✕` button closes it.

### Modal Content

| Powerup | Effect | Unlock condition |
|---------|--------|-----------------|
| 🔨 Hammer | Tap any tile to delete it | Every 2 games (random) |
| 🔀 Shuffle | Randomly rearrange all tiles | Every 2 games (random) |
| ➕ Add One | Tap any tile to +1 (if tile is 9, eliminates it and scores +10) | Every 3 games |
| 💣 Bomb | Tap any tile to clear its surrounding 8 tiles | Every 30 lifetime pairs eliminated |

### Implementation

Pure HTML/CSS/JS. No new files. Changes go in `workspace/index.html` (modal markup + CSS) and `workspace/src/game.ts` (open/close event listeners).

---

## Fix 3: Add One on 9

**Current behavior:** `applyAddOne` returns early when `value >= 9` — powerup is not consumed, nothing happens.

**New behavior:** If `value === 9`, eliminate the tile (set cell to `null`), add 10 to score, consume the powerup, play the addOne sound. If `value === null` (empty cell), still return early without consuming.

**Scope:** `workspace/src/game.ts` (`applyAddOne` function only).

---

## Fix 4: Powerup Unlock Rebalancing

### New Conditions

| Powerup | Old condition | New condition |
|---------|--------------|--------------|
| 🔨 Hammer | Every 5 games (50% chance) | **Every 2 games** (50% chance) |
| 🔀 Shuffle | Every 5 games (50% chance) | **Every 2 games** (50% chance) |
| ➕ Add One | Every 10 games | **Every 3 games** |
| 💣 Bomb | First time score ≥ 50; then every 100 pts of best score | **Every 30 lifetime pairs eliminated** |

### Implementation

**`workspace/src/powerups.ts`:**

```typescript
export function computePlayCountAward(
  playCount: number,
  rng: () => number = Math.random,
): PowerupId | null {
  if (playCount % 3 === 0) return "addOne";
  if (playCount % 2 === 0) return rng() < 0.5 ? "hammer" : "shuffle";
  return null;
}

export function computeEliminationAward(
  oldTotal: number,
  newTotal: number,
): number {
  return Math.floor(newTotal / 30) - Math.floor(oldTotal / 30);
}
```

`computeBestScoreAward` is removed (no longer used).

**`workspace/src/game.ts`:**

- New localStorage key: `"mathMerge10LifetimeElim"` — stores cumulative lifetime pair count as a number.
- After each slide that produces eliminations: read stored total, add new pair count, check `computeEliminationAward(old, new)`, award bombs, save new total.
- `POWERUP_UNLOCK_TIPS` updated:
  - `hammer`: `"每 2 局隨機獲得"`
  - `shuffle`: `"每 2 局隨機獲得"`
  - `addOne`: `"每 3 局獲得"`
  - `bomb`: `"每累計消除 30 對獲得一顆"`

---

## Files Changed

| File | Change |
|------|--------|
| `workspace/index.html` | `100dvh` fix; modal markup + CSS; ❓ button in HUD |
| `workspace/src/game.ts` | `applyAddOne` fix; lifetime elim tracking; modal open/close; updated `POWERUP_UNLOCK_TIPS`; remove `computeBestScoreAward` call |
| `workspace/src/powerups.ts` | `computePlayCountAward` thresholds; add `computeEliminationAward`; remove `computeBestScoreAward` |
| `workspace/tests/e2e/` | New tests for modal visibility, Add One on 9, bomb award at 30 elims |
| `workspace/tests/unit/` | Updated `powerups.test.ts` for new thresholds and new `computeEliminationAward` |

---

## Testing

| Scenario | Type |
|----------|------|
| `min-height` computed value uses dvh unit | E2E |
| ❓ button visible in HUD | E2E |
| Modal appears on ❓ click, closes on overlay click and ✕ | E2E |
| Modal shows all 4 powerup names and unlock conditions | E2E |
| Add One on 9 eliminates tile and scores +10 | E2E |
| Add One on empty cell does nothing, powerup not consumed | Unit |
| `computePlayCountAward(2)` → hammer or shuffle | Unit |
| `computePlayCountAward(3)` → addOne | Unit |
| `computeEliminationAward(0, 30)` → 1 | Unit |
| `computeEliminationAward(29, 31)` → 1 | Unit |
| `computeEliminationAward(0, 60)` → 2 | Unit |
| Bomb awarded in-game after 30th cumulative pair eliminated | E2E |
