# Trophy Modal Redesign Design

## Summary

Redesign the trophy modal from a verbose per-row list into a compact progress-card layout. Every category uses a medal-row + progress bar. The underlying trophy data model is updated: number series thresholds change, combo series is simplified to a single `maxCombo` group, a new "累積成就" category is added for total score, and play count shows a "beyond diamond" counter after all tiers unlock.

---

## Layout: Progress Card (all categories)

Every trophy group renders as one row:

```
[Name]                          [current val / next target]
🥉   🥈   🥇   💎
[threshold]  [threshold]  [threshold]  [threshold]
████████░░░░░░░░░░  progress bar
```

- Unlocked medals are full colour. Locked medals are greyscale + 22% opacity.
- Progress bar colour: purple (normal progress), cyan (all tiers unlocked / beyond-diamond).
- Single-achievement trophies (board_clear, zero_score, almost_full): display as icon + name + description, no progress bar.

---

## Category Structure

### 1. 數字系列 — Per-Number Trophies (36)

One progress row per digit 1–9. Each row has 4 medals (Bronze/Silver/Gold/Diamond).

**Thresholds (uniform across all digits):**

| Tier | Tiles on board simultaneously |
|------|-------------------------------|
| 🥉 Bronze | 6 |
| 🥈 Silver | 10 |
| 🥇 Gold | 14 |
| 💎 Diamond | 16 (full board) |

**Tracking:** `maxNum1`–`maxNum9` in `GameStats` — the highest count of that digit ever seen on the board in a single slide. Updated on every slide event.

**Progress bar:** `maxNumV / 16`

**Natural ceiling:** 16. No "beyond diamond" mode.

**Check:** `event.type === "slide" && countValue(event.grid, value) >= threshold` — same as before. `maxNumV` is updated to `Math.max(maxNumV, countValue(grid, value))` before checking.

**Trophy IDs:** `num_{1-9}_{bronze|silver|gold|diamond}` (unchanged)

**Names (unchanged):** 一/二/三/四/五/六/七/八/九 + 的初現/聚集/洪流/霸主

---

### 2. 連鎖系列 — Combo Trophies (4, reduced from 17)

One progress row tracking the highest single-slide pair count ever achieved (`maxCombo`).

**Thresholds:**

| Tier | Max combo in one slide |
|------|------------------------|
| 🥉 Bronze | ×2 |
| 🥈 Silver | ×3 |
| 🥇 Gold | ×5 |
| 💎 Diamond | ×8 (theoretical max on 4×4 board) |

**Tracking:** `maxCombo: number` in `GameStats`. Updated on every slide: `maxCombo = Math.max(maxCombo, event.comboCount)`.

**Progress bar:** `maxCombo / 8`

**Natural ceiling:** 8. No "beyond diamond" mode.

**Trophy IDs:** `combo_bronze`, `combo_silver`, `combo_gold`, `combo_diamond`

**Names:** 連鎖初現 / 連鎖進階 / 連鎖高手 / 連鎖大師 (Icon: 🥉/🥈/🥇/💎)

**Retired IDs:** `combo_1_bronze`…`combo_4_diamond`, `combo_5` (kept in localStorage but no longer checked or displayed)

---

### 3. 分數里程碑 — Per-Game Score Milestones (16, unchanged)

Four count-based groups (100 / 300 / 500 / 1000 per-game score). No display changes; tiers, IDs, names, and thresholds unchanged.

Tracking: `score100Count`, `score300Count`, `score500Count`, `score1000Count` in `GameStats` (unchanged).

Progress bar: `scoreXCount / diamond_threshold`

---

### 4. 遊玩成就 — Play Trophies (5, unchanged)

Four play-count tiers (10 / 50 / 100 / 500 games) + one board_clear single achievement.

**Beyond-diamond display for play count:** After all four tiers unlock (playCount ≥ 500), the row switches to "beyond diamond" mode:
- All four medals lit up
- Cyan full-width bar
- Current count displayed: `547 局 🔄`
- Sub-label: `超越鑽石 +47 局`

Board clear (`board_clear`) stays as a single-achievement row (no progress bar, no beyond-diamond).

Tracking: `playCount` (unchanged).

---

### 5. 累積成就 — Cumulative Trophies (4, new)

New category. One progress row: total score accumulated across all games.

| Tier | Cumulative score |
|------|-----------------|
| 🥉 Bronze | 1,000 |
| 🥈 Silver | 10,000 |
| 🥇 Gold | 50,000 |
| 💎 Diamond | 200,000 |

**Tracking:** `totalScore: number` in `GameStats`. Incremented by `event.score` on every `gameOver` event.

**Trophy IDs:** `score_total_bronze`, `score_total_silver`, `score_total_gold`, `score_total_diamond`

**Names:** 千分旅程 / 萬分修煉 / 五萬精通 / 二十萬傳說 (Icons: 🥉/🥈/🥇/💎)

**Beyond-diamond display:** After diamond unlocks (totalScore ≥ 200,000), switches to beyond-diamond mode showing the running total.

**Check:** `event.type === "gameOver" && stats.totalScore >= threshold`

---

### 6. 特殊成就 — Special Trophies (2, unchanged)

`zero_score` and `almost_full` — IDs, names, icons, conditions unchanged. Display as single-achievement rows.

---

## Total Trophy Count

| Category | Count | Change |
|----------|-------|--------|
| 數字系列 | 36 | Thresholds changed |
| 連鎖系列 | 4 | Reduced from 17 |
| 分數里程碑 | 16 | Unchanged |
| 遊玩成就 | 5 | Unchanged |
| 累積成就 | 4 | New |
| 特殊成就 | 2 | Unchanged |
| **Total** | **67** | Was 76 |

---

## GameStats Changes

```typescript
interface GameStats {
  playCount: number;
  // Removed: combo1Count, combo2Count, combo3Count, combo4Count
  maxCombo: number;            // NEW — highest single-slide pair count
  maxNum1: number;             // NEW — max tiles of value 1 seen simultaneously
  maxNum2: number;
  maxNum3: number;
  maxNum4: number;
  maxNum5: number;
  maxNum6: number;
  maxNum7: number;
  maxNum8: number;
  maxNum9: number;
  score100Count: number;
  score300Count: number;
  score500Count: number;
  score1000Count: number;
  totalScore: number;          // NEW — cumulative score across all games
}
```

`checkTrophies` on `slide` event:
1. `maxCombo = Math.max(maxCombo, event.comboCount)`
2. For each digit v 1–9: `maxNumV = Math.max(maxNumV, countValue(event.grid, v))`
3. Save stats
4. Check all slide-type trophy defs

`checkTrophies` on `gameOver` event:
1. `playCount++`
2. `totalScore += event.score`
3. If score ≥ 100/300/500/1000 → increment respective count
4. Save stats
5. Check all gameOver-type trophy defs

---

## `renderTrophyModal()` Changes

Groups trophies by category in order: `numbers → combos → scores → play → cumulative → special`.

For each group, renders a progress row using `loadTrophyStatuses()` + `loadStats()`:

```
progress row for tiered group:
  - label + current value + next target
  - 4 medal tiles (lit/locked)
  - progress bar (width = current / ceiling)

beyond-diamond row (play count, total score after all tiers unlocked):
  - all 4 medals lit
  - cyan full bar
  - "超越鑽石 +N" sub-label

single-achievement row (board_clear, zero_score, almost_full):
  - icon + name + description
  - locked/unlocked state
```

The modal needs `loadStats()` imported (it is currently internal to `trophies.ts`). Two options:
- Export `loadStats()` from `trophies.ts`, or
- Export a single `loadModalData()` helper that returns `{ statuses: TrophyStatus[], stats: GameStats }`

**Recommendation:** Export `loadModalData()` to keep `GameStats` opaque to `game.ts`:

```typescript
export interface ModalStats {
  maxNums: number[];   // index 0 = value 1, index 8 = value 9
  maxCombo: number;
  playCount: number;
  totalScore: number;
  score100Count: number; score300Count: number;
  score500Count: number; score1000Count: number;
}
export function loadModalData(): { statuses: TrophyStatus[]; stats: ModalStats }
```

`game.ts` calls `loadModalData()` and uses `stats` to display current progress values and compute progress bar widths. It never imports `GameStats`.

---

## CSS Changes (`index.html`)

Replace `.tm-category-header` + existing trophy list styles with:

```css
/* Progress row */
.tm-prog-row { padding: 6px 0; border-bottom: 1px solid #1f2937; }
.tm-prog-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.tm-prog-label { color: #e5e7eb; font-size: 12px; font-weight: 600; }
.tm-prog-val { color: #9ca3af; font-size: 10px; }
.tm-medals { display: flex; margin-bottom: 4px; }
.tm-tier { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; }
.tm-tier .tm-ico { font-size: 16px; }
.tm-tier .tm-thr { font-size: 9px; color: #9ca3af; }
.tm-tier.locked .tm-ico { filter: grayscale(1) opacity(0.22); }
.tm-tier.locked .tm-thr { color: #374151; }
.tm-bar { height: 3px; background: #374151; border-radius: 2px; overflow: hidden; }
.tm-fill { height: 100%; border-radius: 2px; }
.tm-fill-purple { background: linear-gradient(90deg, #7c3aed, #a78bfa); }
.tm-fill-cyan   { background: linear-gradient(90deg, #0891b2, #67e8f9); }

/* Beyond diamond */
.tm-beyond-bar { height: 3px; background: linear-gradient(90deg, #0891b2, #67e8f9); border-radius: 2px; }
.tm-beyond-sub { font-size: 9px; color: #0891b2; text-align: right; margin-top: 2px; }
.tm-beyond-count { font-size: 11px; font-weight: bold; color: #67e8f9; }
.tm-beyond-tag { font-size: 9px; color: #67e8f9; margin-left: 4px; }

/* Single achievement */
.tm-single { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #1f2937; }
.tm-single-ico { font-size: 20px; }
.tm-single-body strong { color: #e5e7eb; font-size: 12px; display: block; }
.tm-single-body small { color: #6b7280; font-size: 10px; }
.tm-single.locked .tm-single-ico { filter: grayscale(1) opacity(0.25); }
.tm-single.locked .tm-single-body strong { color: #4b5563; }
```

---

## Migration Notes

- Old trophy IDs `combo_1_bronze`…`combo_4_diamond`, `combo_5` remain in localStorage but are never checked or displayed (silent retirement).
- Number trophy IDs unchanged; existing unlocks at old thresholds (3/4/5/6) are kept. Players who already unlocked bronze at 3 tiles keep it — the display simply shows the new threshold (6).
- Old `combo1Count`…`combo4Count` in localStorage `mathMerge10Stats` are silently ignored. `EMPTY_STATS` defaults them to 0 if missing.

---

## Files Changed

| File | Change |
|------|--------|
| `workspace/src/trophies.ts` | Updated `GameStats`; 67 trophy defs; updated `checkTrophies`; new `loadModalData()` export |
| `workspace/src/game.ts` | `renderTrophyModal()` rebuilt for progress-card layout; imports `loadModalData` |
| `workspace/index.html` | Replace trophy modal CSS with progress-card styles |
| `workspace/tests/unit/trophies.test.ts` | Update for new thresholds, new GameStats fields, new trophy IDs |
| `workspace/tests/e2e/ux-v2.spec.ts` | Update trophy modal E2E tests |

---

## Scope Boundary

- No server-side persistence.
- No animated progress bar fill.
- No tooltip on medal tap (description visible in row).
- No prestige / reset mechanism.
- No sound on trophy unlock (existing toast notification only).
