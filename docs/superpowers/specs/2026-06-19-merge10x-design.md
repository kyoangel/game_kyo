# merge10x — New Game Design Spec

**Date:** 2026-06-19  
**Status:** Approved for implementation planning

---

## 1. Overview

**merge10x** is the second game in the game_kyo umbrella repo. It builds on merge10's swipe mechanic but allows **2, 3, or 4 consecutive tiles** summing to 10 to be eliminated in a single swipe — instead of pairs only.

Players can choose between a 4×4 grid (quick games) or a 5×5 grid (strategic, longer sessions). Default is **5×5**.

**Deployed URL:** `kyoangel.github.io/game_kyo/merge10x/`  
**Repo path:** `workspace-merge10x/` (sibling of `workspace/` in game-factory repo)  
**Tech stack:** TypeScript, Vite, Tailwind CSS, Vitest (unit), Playwright (e2e)

---

## 2. Core Mechanic

### 2.1 Swipe & Match

On each swipe (up/down/left/right):
1. Tiles compact in the swipe direction (same as merge10)
2. **Greedy longest-match** scan runs left-to-right on each compacted row:
   - At position `i`, try tiles `[i..i+3]` (sum of 4) → if = 10, eliminate 4 tiles, `i += 4`
   - Else try tiles `[i..i+2]` (sum of 3) → if = 10, eliminate 3 tiles, `i += 3`
   - Else try tiles `[i..i+1]` (sum of 2) → if = 10, eliminate 2 tiles, `i += 2`
   - Else keep `tiles[i]`, `i += 1`
3. After elimination, remaining tiles compact left (gaps removed)
4. One new tile spawns in a random empty cell

### 2.2 Algorithm Example

Row `[2, 3, 5, 5]`:
- Position 0: try 2+3+5+5=15 (no), try 2+3+5=10 ✓ → eliminate 3 tiles
- Position 3: `[5]` stays
- Result: `[5, null, null, null]` (after compaction: `[5]`)

Row `[3, 7, 3, 7]`:
- Position 0: try 3+7+3+7=20 (no), try 3+7+3=13 (no), try 3+7=10 ✓ → eliminate 2 tiles
- Position 2: try 3+7=10 ✓ → eliminate 2 tiles
- Result: `[]` (empty row)

### 2.3 Moved Condition

A swipe "moved" if any tile changed position OR any elimination occurred.

---

## 3. Grid Size Selection

- On **first launch**, show a size picker overlay before the game starts
- Options: **4×4** | **5×5** (default: 5×5)
- Persist choice in `localStorage` key `merge10xGridSize`
- After game over, the Game Over screen includes a "Change Size" button that returns to the size picker
- Grid size can also be changed from the settings/menu icon

---

## 4. Tile Spawn Distribution

Biased toward smaller values to enable triple/quad matches:

| Value | Weight |
|-------|--------|
| 1     | 18%    |
| 2     | 18%    |
| 3     | 18%    |
| 4     | 15%    |
| 5     | 11%    |
| 6     | 8%     |
| 7     | 6%     |
| 8     | 3%     |
| 9     | 3%     |

Initial board: spawn **3 tiles** for 4×4, **4 tiles** for 5×5.

---

## 5. Scoring

| Match length | Score |
|--------------|-------|
| 2 tiles      | 10 pts |
| 3 tiles      | 25 pts |
| 4 tiles      | 50 pts |

**Combo bonus:** If a single swipe produces N > 1 elimination groups, add `(N - 1) × 10` bonus points on top.

Example: one swipe eliminates a triple (25) + a pair (10) = 35 + 10 combo bonus = **45 pts total**.

Best score persists in `localStorage` key `merge10xBestScore` (separate per grid size: `merge10xBestScore4`, `merge10xBestScore5`).

---

## 6. Game Over

- Condition: no swipe in any of 4 directions causes any tile movement or elimination
- Show Game Over overlay with: final score, best score, "Play Again" button, "Change Size" button
- Audio: `gameOver` sound (same as merge10)

---

## 7. Trophies

Two categories (same modal UI pattern as merge10):

### 遊玩成就 (Play Achievements)

| ID | Name | Condition |
|----|------|-----------|
| `play_1` | 初次嘗試 | 遊玩 1 局 |
| `play_10` | 初嚐滋味 | 遊玩 10 局 |
| `play_50` | 上癮了吧 | 遊玩 50 局 |
| `play_100` | 資深玩家 | 遊玩 100 局 |

### 特殊成就 (Special Achievements)

| ID | Name | Condition |
|----|------|-----------|
| `first_triple` | 三合一 | 第一次 3-tile 消除 |
| `first_quad` | 四合一 | 第一次 4-tile 消除 |
| `big_combo` | 連鎖爆發 | 單次滑動消除 3 組以上 |
| `score_100` | 百分出擊 | 累積 100 分 |
| `score_500` | 五百強 | 累積 500 分 |
| `score_1000` | 破千 | 累積 1000 分 |
| `board_clear` | 天地清明 | 消除所有格子（盤面全空） |

---

## 8. File Structure

```
workspace-merge10x/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── tailwind.config.js
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       └── apple-touch-icon.png
└── src/
    ├── main.ts          — entry point, mounts game
    ├── grid.ts          — NEW: N×N grid, greedy longest-match slideRowLeft
    ├── game.ts          — game loop, size selection, swipe handling
    ├── trophies.ts      — merge10x trophy definitions & unlock logic
    ├── audio.ts         — copied from merge10 (unchanged)
    ├── scoring.ts       — score helpers (2/3/4-tile scoring, combo bonus)
    └── ui.ts            — DOM rendering, size picker overlay, Game Over screen
└── tests/
    ├── unit/
    │   ├── grid.test.ts       — slideRowLeft greedy logic, all match lengths
    │   ├── scoring.test.ts    — score for 2/3/4-tile + combo bonus
    │   └── trophies.test.ts   — each trophy unlock condition
    └── e2e/
        └── merge10x.spec.ts   — size selection, swipe eliminations, game over
```

---

## 9. Key Interface Changes vs merge10

### `EliminatedGroup` (replaces `EliminatedPair`)

```typescript
export interface EliminatedGroup {
  tiles: Array<{ row: number; col: number }>;  // original positions
  length: 2 | 3 | 4;
}
```

### `SlideOutcome`

```typescript
export interface SlideOutcome {
  grid: GameGrid;
  moved: boolean;
  scoreGained: number;
  eliminatedGroups: EliminatedGroup[];  // was eliminatedPairs
}
```

### `slideRowLeft` return type

```typescript
export interface SlideResult {
  row: Cell[];
  moved: boolean;
  scoreGained: number;
  eliminatedGroups: EliminatedGroup[];  // was eliminatedIndices: [number,number,number,number][]
}
```

---

## 10. Audio

Reuse `audio.ts` from merge10 unchanged. Events used:
- `move` — swipe with no elimination
- `eliminate` — any elimination (2/3/4-tile)
- `combo` — multiple elimination groups in one swipe (pass `comboCount`)
- `spawn` — new tile appears
- `gameOver` — game over

---

## 11. PWA & Deployment

- `manifest.json` with `start_url: /game_kyo/merge10x/` and `scope: /game_kyo/merge10x/`
- Same iOS meta tags as merge10 (apple-mobile-web-app-capable, apple-touch-icon)
- CI: same GitHub Actions workflow as merge10 (add merge10x build step)
- game_kyo hub page updated to include merge10x entry card

---

## 12. Out of Scope (v1)

- Power-ups (Hammer, Bomb, Shuffle, AddOne) — defer to v2
- Animations for triple/quad elimination — text+score popup only in v1; animation polish in v2
- Leaderboard / multiplayer
- Sounds distinct from merge10 (reuse audio.ts as-is)
