# Career Trophy System Design

## Summary

A persistent achievement system for Math Merge 10. Eight trophies track lifetime milestones across all games. Trophies unlock permanently (localStorage), show a toast notification on unlock, and are viewable via a 🏆 HUD button.

---

## Trophy List

| ID | 中文名 | Icon | Condition | Checked at |
|---|---|---|---|---|
| `zero_score` | 空手而歸 | 🕊️ | Finish a game with score 0 | Game-over |
| `one_flood` | 一的洪流 | 🌊 | Board has ≥ 5 tiles of value `1` simultaneously | After each slide |
| `nine_feast` | 九的盛宴 | 🍱 | Board has ≥ 3 tiles of value `9` simultaneously | After each slide |
| `almost_full` | 滿溢邊緣 | 💥 | Board has ≥ 15 non-null tiles simultaneously | After each slide |
| `combo_2` | 連鎖初學 | ⚡ | Achieve a 2-combo (2 pairs eliminated in one slide) | After each slide |
| `combo_3` | 連鎖高手 | ⚡⚡ | Achieve a 3-combo | After each slide |
| `combo_4` | 連鎖達人 | ⚡⚡⚡ | Achieve a 4-combo | After each slide |
| `combo_5` | 連鎖大師 | 🌟 | Achieve a 5+ combo | After each slide |

All trophies unlock permanently — once earned they are never reset.

---

## Architecture

### New file: `workspace/src/trophies.ts`

Single responsibility: define trophies, check conditions, persist unlock state.

**Imports:**
```typescript
import { type GameGrid } from "./grid";
```

**Types:**
```typescript
export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (event: TrophyCheckEvent) => boolean;
}

export type TrophyCheckEvent =
  | { type: "slide"; grid: GameGrid; comboCount: number }
  | { type: "gameOver"; score: number };

export interface TrophyStatus {
  def: TrophyDef;
  unlocked: boolean;
  unlockedAt: number | null; // Unix ms timestamp
}
```

**Public API:**
- `checkTrophies(event: TrophyCheckEvent): string[]` — checks all defs against the event, persists newly-unlocked ones, returns array of newly-unlocked IDs
- `loadTrophyStatuses(): TrophyStatus[]` — returns all 8 trophies with unlock state (for the modal)
- `getTrophyDef(id: string): TrophyDef | undefined` — lookup by ID, used by `showTrophyToast` in `game.ts`

**Storage:** localStorage key `mathMerge10Trophies` → JSON object `{ [id: string]: number }` mapping trophy ID to unlock timestamp.

**`TROPHY_DEFS` (the 8 definitions):**

```typescript
const TROPHY_DEFS: TrophyDef[] = [
  {
    id: "zero_score",
    name: "空手而歸",
    icon: "🕊️",
    description: "完成一場遊戲，得分為零",
    check: (e) => e.type === "gameOver" && e.score === 0,
  },
  {
    id: "one_flood",
    name: "一的洪流",
    icon: "🌊",
    description: "版面上同時出現 5 個或以上的「1」",
    check: (e) => e.type === "slide" && countValue(e.grid, 1) >= 5,
  },
  {
    id: "nine_feast",
    name: "九的盛宴",
    icon: "🍱",
    description: "版面上同時出現 3 個或以上的「9」",
    check: (e) => e.type === "slide" && countValue(e.grid, 9) >= 3,
  },
  {
    id: "almost_full",
    name: "滿溢邊緣",
    icon: "💥",
    description: "版面上同時有 15 格或以上非空的格子",
    check: (e) => e.type === "slide" && countNonNull(e.grid) >= 15,
  },
  {
    id: "combo_2",
    name: "連鎖初學",
    icon: "⚡",
    description: "一次消除 2 對",
    check: (e) => e.type === "slide" && e.comboCount >= 2,
  },
  {
    id: "combo_3",
    name: "連鎖高手",
    icon: "⚡⚡",
    description: "一次消除 3 對",
    check: (e) => e.type === "slide" && e.comboCount >= 3,
  },
  {
    id: "combo_4",
    name: "連鎖達人",
    icon: "⚡⚡⚡",
    description: "一次消除 4 對",
    check: (e) => e.type === "slide" && e.comboCount >= 4,
  },
  {
    id: "combo_5",
    name: "連鎖大師",
    icon: "🌟",
    description: "一次消除 5 對或以上",
    check: (e) => e.type === "slide" && e.comboCount >= 5,
  },
];
```

Helper functions (module-private):
```typescript
function countValue(grid: GameGrid, value: number): number {
  return grid.flat().filter((c) => c === value).length;
}
function countNonNull(grid: GameGrid): number {
  return grid.flat().filter((c) => c !== null).length;
}
```

---

### Changes to `workspace/src/game.ts`

**Import:**
```typescript
import { checkTrophies, loadTrophyStatuses } from "./trophies";
```

**Two check callpoints:**

1. In `handleKeydown`, after `startAnimations(...)`:
```typescript
const newTrophies = checkTrophies({
  type: "slide",
  grid: state.grid,
  comboCount: eliminatedPairs.length,
});
newTrophies.forEach((id) => showTrophyToast(id));
```

2. In the game-over block (where `gameOverEl.removeAttribute("hidden")` is called), before showing the game-over screen:
```typescript
const newTrophies = checkTrophies({ type: "gameOver", score: state.score });
newTrophies.forEach((id) => showTrophyToast(id));
```

**`showTrophyToast(id: string)`** (new function in `game.ts`):
- Looks up `getTrophyDef(id)` for name and icon
- Sets `#trophy-toast` text to `"${icon} ${name}！"`
- Adds CSS class `animate`, removes after 2000ms
- If multiple trophies unlock simultaneously, queues them with 2200ms offset per toast

**Trophy modal listeners** (added alongside the powerup modal listeners):
```typescript
hudTrophyEl.addEventListener("click", () => {
  renderTrophyModal();
  trophyModalEl.removeAttribute("hidden");
});
trophyModalOverlayEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});
trophyModalCloseEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});
```

**`renderTrophyModal()`** (new function):
- Calls `loadTrophyStatuses()`
- Populates `#trophy-modal-list` — each item shows icon, name, description, and either "✓ 已解鎖" (green) or a greyed-out lock icon

---

### Changes to `workspace/index.html`

**🏆 button in `#hud`** (added after `#hud-powerup-info`):
```html
<button id="hud-trophy" aria-label="生涯獎盃">🏆</button>
```

**CSS** — `#hud-trophy` added to the existing selector:
```css
#hud-palette-toggle, #hud-mute, #hud-powerup-info, #hud-trophy { ... }
```

**Trophy toast** (`#trophy-toast`, same position as `#combo-badge`):
```html
<div id="trophy-toast"></div>
```
CSS: fixed position (bottom-center), gold background, 2s fade-out animation (`trophy-toast-appear` keyframes).

**Trophy modal** (`#trophy-modal`) — same structure as `#powerup-modal`:
```html
<div id="trophy-modal" hidden>
  <div id="trophy-modal-overlay"></div>
  <div id="trophy-modal-card">
    <button id="trophy-modal-close" aria-label="關閉">✕</button>
    <h3>生涯獎盃</h3>
    <ul id="trophy-modal-list"></ul>
  </div>
</div>
```
Modal list is populated dynamically by `renderTrophyModal()`.

---

## Files Changed

| File | Change |
|------|--------|
| `workspace/src/trophies.ts` | New — all trophy logic, persistence, type definitions |
| `workspace/src/game.ts` | Import trophies; add 2 check callpoints; `showTrophyToast`; `renderTrophyModal`; modal element refs + listeners |
| `workspace/index.html` | 🏆 HUD button; `#trophy-toast` with CSS + animation; `#trophy-modal` markup; CSS selector updates |
| `workspace/tests/unit/trophies.test.ts` | New — unit tests for all 8 trophy conditions |
| `workspace/tests/e2e/ux-v2.spec.ts` | New E2E tests for trophy unlock flow |

---

## Testing

### Unit tests (`workspace/tests/unit/trophies.test.ts`)

| Test | What it covers |
|------|---------------|
| `zero_score` triggers on gameOver score=0 | game-over check |
| `zero_score` does NOT trigger on score > 0 | negative case |
| `one_flood` triggers when grid has ≥ 5 ones | grid counting |
| `one_flood` does NOT trigger with 4 ones | boundary |
| `nine_feast` triggers with ≥ 3 nines | grid counting |
| `almost_full` triggers with 15 non-null tiles | grid fill |
| `combo_2` through `combo_5` trigger at correct thresholds | combo counting |
| Already-unlocked trophy is NOT returned again by `checkTrophies` | deduplication |
| `loadTrophyStatuses` returns 8 entries, correct unlocked state | persistence |

### E2E tests (`workspace/tests/e2e/ux-v2.spec.ts`)

| Test | What it covers |
|------|---------------|
| `Trophy: 🏆 button visible in HUD` | HUD presence |
| `Trophy: modal opens with all 8 trophies listed` | modal content |
| `Trophy: combo_2 unlocks and shows toast` | unlock flow (set grid for guaranteed 2-combo via `__setTestState`) |
| `Trophy: zero_score unlocks at game over with 0 score` | game-over unlock |
| `Trophy: unlocked trophy shows ✓ in modal` | persistence display |

---

## Scope Boundary

- No trophy resets or "prestige" system — out of scope.
- No server-side persistence — localStorage only.
- No trophy XP or points — unlock = done.
- No sound effect for trophy unlock — uses visual toast only (adding audio is out of scope).
