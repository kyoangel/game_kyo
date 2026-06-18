# Trophy System Expansion Design

## Summary

Expand the career trophy system from 8 ad-hoc trophies to a consistent, 76-trophy structure organized into five categories. Each category uses a Bronze / Silver / Gold / Diamond tier system calibrated to achievement difficulty. The public API of `trophies.ts` is unchanged; `game.ts` requires no modifications.

---

## Trophy Categories

### 1. 數字系列 — Per-Number Trophies (36 trophies)

Every tile value 1–9 gets four tiers based on how many tiles of that value appear on the board simultaneously after a slide. Thresholds are uniform across all values (difficulty comes from the game state, not from the thresholds):

| Tier | Threshold |
|------|-----------|
| 🥉 Bronze | 3 tiles |
| 🥈 Silver | 4 tiles |
| 🥇 Gold | 5 tiles |
| 💎 Diamond | 6 tiles |

**Trophy IDs and names** (pattern: `num_{value}_{tier}`):

| Value | Bronze | Silver | Gold | Diamond |
|-------|--------|--------|------|---------|
| 1 | `num_1_bronze` 一的初現 | `num_1_silver` 一的聚集 | `num_1_gold` 一的洪流 | `num_1_diamond` 一的霸主 |
| 2 | `num_2_bronze` 二的初現 | `num_2_silver` 二的聚集 | `num_2_gold` 二的洪流 | `num_2_diamond` 二的霸主 |
| 3 | `num_3_bronze` 三的初現 | `num_3_silver` 三的聚集 | `num_3_gold` 三的洪流 | `num_3_diamond` 三的霸主 |
| 4 | `num_4_bronze` 四的初現 | `num_4_silver` 四的聚集 | `num_4_gold` 四的洪流 | `num_4_diamond` 四的霸主 |
| 5 | `num_5_bronze` 五的初現 | `num_5_silver` 五的聚集 | `num_5_gold` 五的洪流 | `num_5_diamond` 五的霸主 |
| 6 | `num_6_bronze` 六的初現 | `num_6_silver` 六的聚集 | `num_6_gold` 六的洪流 | `num_6_diamond` 六的霸主 |
| 7 | `num_7_bronze` 七的初現 | `num_7_silver` 七的聚集 | `num_7_gold` 七的洪流 | `num_7_diamond` 七的霸主 |
| 8 | `num_8_bronze` 八的初現 | `num_8_silver` 八的聚集 | `num_8_gold` 八的洪流 | `num_8_diamond` 八的霸主 |
| 9 | `num_9_bronze` 九的初現 | `num_9_silver` 九的聚集 | `num_9_gold` 九的洪流 | `num_9_diamond` 九的霸主 |

Icons: 🥉 / 🥈 / 🥇 / 💎 (same icon for all values within a tier)

**Checked at:** after each slide (`type: "slide"`)

**Replaces:** `one_flood` and `nine_feast` (those IDs are retired)

---

### 2. 連鎖系列 — Combo Trophies (17 trophies)

Combo 1–4 each get four count-based tiers (how many times you've achieved that combo level). Combo 5 remains a single one-time achievement.

**Thresholds:**

| Level | Bronze | Silver | Gold | Diamond |
|-------|--------|--------|------|---------|
| Combo 1 (≥1 pair) | 10× | 50× | 200× | 500× |
| Combo 2 (≥2 pairs) | 3× | 15× | 50× | 100× |
| Combo 3 (≥3 pairs) | 1× | 5× | 20× | 50× |
| Combo 4 (≥4 pairs) | 1× | 3× | 8× | 20× |
| Combo 5 (≥5 pairs) | — single achievement — |

**Trophy IDs and names:**

| ID | Name | Icon | Note |
|----|------|------|------|
| `combo_1_bronze` | 消除初手 | 🥉 | |
| `combo_1_silver` | 消除熟手 | 🥈 | |
| `combo_1_gold` | 消除達人 | 🥇 | |
| `combo_1_diamond` | 消除傳說 | 💎 | |
| `combo_2_bronze` | 連鎖初學 | 🥉 | replaces old `combo_2` |
| `combo_2_silver` | 連鎖進階 | 🥈 | |
| `combo_2_gold` | 連鎖精通 | 🥇 | |
| `combo_2_diamond` | 連鎖宗師 | 💎 | |
| `combo_3_bronze` | 連鎖高手 | 🥉 | replaces old `combo_3` |
| `combo_3_silver` | 連鎖大將 | 🥈 | |
| `combo_3_gold` | 連鎖傳奇 | 🥇 | |
| `combo_3_diamond` | 連鎖神話 | 💎 | |
| `combo_4_bronze` | 連鎖達人 | 🥉 | replaces old `combo_4` |
| `combo_4_silver` | 連鎖精英 | 🥈 | |
| `combo_4_gold` | 連鎖王者 | 🥇 | |
| `combo_4_diamond` | 連鎖霸主 | 💎 | |
| `combo_5` | 連鎖大師 | 🌟 | unchanged single achievement |

**Checked at:** after each slide (`type: "slide"`) — combo count trophies use persistent counters; combo_5 checks `comboCount >= 5` directly (unchanged).

**Replaces:** old `combo_2`, `combo_3`, `combo_4` (single one-time versions — those IDs retired)

---

### 3. 分數里程碑 — Score Milestone Trophies (16 trophies)

Tracks how many games the player has finished at or above each score tier.

**Score tiers and thresholds:**

| Score | Bronze | Silver | Gold | Diamond |
|-------|--------|--------|------|---------|
| ≥100 | 1× | 5× | 20× | 50× |
| ≥300 | 1× | 3× | 10× | 25× |
| ≥500 | 1× | 2× | 5× | 15× |
| ≥1000 | 1× | 2× | 5× | 10× |

**Trophy IDs and names** (pattern: `score_{x}_{tier}`):

| Score | Bronze | Silver | Gold | Diamond |
|-------|--------|--------|------|---------|
| 100 | `score_100_bronze` 百分首達 🥉 | `score_100_silver` 百分常客 🥈 | `score_100_gold` 百分習慣 🥇 | `score_100_diamond` 百分大師 💎 |
| 300 | `score_300_bronze` 三百首達 🥉 | `score_300_silver` 三百常客 🥈 | `score_300_gold` 三百習慣 🥇 | `score_300_diamond` 三百大師 💎 |
| 500 | `score_500_bronze` 五百首達 🥉 | `score_500_silver` 五百常客 🥈 | `score_500_gold` 五百習慣 🥇 | `score_500_diamond` 五百大師 💎 |
| 1000 | `score_1000_bronze` 千分首達 🥉 | `score_1000_silver` 千分再達 🥈 | `score_1000_gold` 千分常勝 🥇 | `score_1000_diamond` 千分霸主 💎 |

**Checked at:** game over (`type: "gameOver"`) — after incrementing counters

---

### 4. 遊玩成就 — Play & Clear Trophies (5 trophies)

**Play count** (4 tiers):

| ID | Name | Icon | Threshold |
|----|------|------|-----------|
| `play_bronze` | 新手冒險 | 🥉 | 10 games |
| `play_silver` | 進階玩家 | 🥈 | 50 games |
| `play_gold` | 資深玩家 | 🥇 | 100 games |
| `play_diamond` | 遊戲達人 | 💎 | 500 games |

**Checked at:** game over (`type: "gameOver"`) — after incrementing play count

**Board clear** (1 single trophy):

| ID | Name | Icon | Condition |
|----|------|------|-----------|
| `board_clear` | 天地清明 | ✨ | After a slide, `countNonNull(grid) === 0` |

**Checked at:** after each slide (`type: "slide"`)

---

### 5. 特殊成就 — Special Trophies (2 trophies, unchanged)

| ID | Name | Icon | Condition |
|----|------|------|-----------|
| `zero_score` | 空手而歸 | 🕊️ | Finish a game with score 0 |
| `almost_full` | 滿溢邊緣 | 💥 | Board has ≥15 non-null tiles simultaneously |

---

## Total Trophy Count

| Category | Count |
|----------|-------|
| 數字系列 | 36 |
| 連鎖系列 | 17 |
| 分數里程碑 | 16 |
| 遊玩成就 | 5 |
| 特殊成就 | 2 |
| **Total** | **76** |

---

## Architecture

### Persistent Counters (`mathMerge10Stats` localStorage key)

New key alongside `mathMerge10Trophies`. Stores running totals needed for count-based trophies:

```typescript
interface GameStats {
  playCount: number;
  combo1Count: number;
  combo2Count: number;
  combo3Count: number;
  combo4Count: number;
  score100Count: number;
  score300Count: number;
  score500Count: number;
  score1000Count: number;
}
```

`trophies.ts` manages this key internally. `game.ts` never reads or writes it.

### Updated `trophies.ts`

**Public API — unchanged:**
- `checkTrophies(event: TrophyCheckEvent): string[]`
- `loadTrophyStatuses(): TrophyStatus[]`
- `getTrophyDef(id: string): TrophyDef | undefined`

**Internal changes:**

`TrophyCheckEvent` stays the same (no new fields exposed to callers). Internally, `checkTrophies` creates a combined payload:

```typescript
type CheckPayload = {
  event: TrophyCheckEvent;
  stats: GameStats;
};
```

The `check` function on `TrophyDef` becomes `check: (payload: CheckPayload) => boolean` (internal only — not exported).

**`checkTrophies` flow:**

```
On slide event:
  1. Load stats
  2. If comboCount >= 1 → stats.combo1Count++
  3. If comboCount >= 2 → stats.combo2Count++
  4. If comboCount >= 3 → stats.combo3Count++
  5. If comboCount >= 4 → stats.combo4Count++
  6. Save stats (if any incremented)
  7. Check all slide-type trophy defs against { event, stats }
  8. Persist newly unlocked trophies → return new IDs

On gameOver event:
  1. Load stats
  2. stats.playCount++
  3. If score >= 100 → stats.score100Count++
  4. If score >= 300 → stats.score300Count++
  5. If score >= 500 → stats.score500Count++
  6. If score >= 1000 → stats.score1000Count++
  7. Save stats
  8. Check all gameOver-type trophy defs against { event, stats }
  9. Persist newly unlocked trophies → return new IDs
```

Private helpers:
```typescript
const STATS_KEY = "mathMerge10Stats";
function loadStats(): GameStats { ... }
function saveStats(stats: GameStats): void { ... }
```

### `loadTrophyStatuses()` — Category Support

Returns all 76 trophies. Add a `category` field to `TrophyDef` so the modal can render category headers:

```typescript
// Exported — no `check` field; callers only use id/name/icon/description/category
export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "numbers" | "combos" | "scores" | "play" | "special";
}

// Private — extends TrophyDef with the check predicate
interface TrophyRule extends TrophyDef {
  check: (payload: CheckPayload) => boolean;
}
```

`TROPHY_DEFS` is typed as `TrophyRule[]` (private). All exported functions accept/return `TrophyDef` (no `check` exposed).

`loadTrophyStatuses()` return type gains category via `def.category`. The modal groups by category.

### Trophy Modal Changes (`game.ts` / `index.html`)

`renderTrophyModal()` groups trophies by category and inserts `<li class="tm-category-header">` elements:

```
數字系列 (36)
  [1–9 per value, Bronze→Diamond]
連鎖系列 (17)
  [Combo 1–4 tiers + Combo 5]
分數里程碑 (16)
  [100/300/500/1000 × 4 tiers]
遊玩成就 (5)
  [Play count × 4 + Board clear]
特殊成就 (2)
  [zero_score, almost_full]
```

CSS for category header:
```css
.tm-category-header {
  font-size: 11px;
  font-weight: bold;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 0 2px;
  border-top: 1px solid #374151;
  margin-top: 4px;
}
.tm-category-header:first-child {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}
```

---

## Migration / Backward Compatibility

Old trophy IDs (`one_flood`, `nine_feast`, `combo_2`, `combo_3`, `combo_4`) are simply abandoned — they remain in localStorage but are never checked or displayed. The new IDs start fresh. No migration code needed.

`zero_score`, `almost_full`, `combo_5` keep their IDs and are unaffected.

---

## Files Changed

| File | Change |
|------|--------|
| `workspace/src/trophies.ts` | New `GameStats` interface + `STATS_KEY`; updated `TrophyDef` with `category`; `checkTrophies` increments counters; 76 trophy defs replacing 8 |
| `workspace/src/game.ts` | `renderTrophyModal()` now groups by category with headers |
| `workspace/index.html` | `.tm-category-header` CSS |
| `workspace/tests/unit/trophies.test.ts` | Full rewrite to cover all 76 trophies, counter increments, stats persistence |
| `workspace/tests/e2e/ux-v2.spec.ts` | Update trophy modal tests for new count and category headers |

---

## Scope Boundary

- No trophy reset or prestige system.
- No server-side persistence — localStorage only.
- No animated trophy unlock screen — toast notification only (existing system).
- No sound on trophy unlock.
