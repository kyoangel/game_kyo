# 傭兵評鑑歷史記錄 (Mercenary Rating History)

## Goal

Persist the best-ever star rating each stage has achieved onto `GameState`, and show it next to completed stages on `WorldMapScene` (the game's only stage-select screen), so players can see at a glance which clears still have room for improvement.

## Background

`specs/pixel-squad-mercenary-rating.md` wired `calculateStarRating` end-to-end for a *single* battle: `ResultScene` computes the rating and renders it once, then it's gone. `GameState` has no field remembering it, so leaving `ResultScene` loses the result forever. `WorldMapScene` (`src/scenes/WorldMapScene.ts`) already distinguishes completed/available/locked stages via `stageProgress.completedStageIds` but has no notion of *how well* a stage was cleared. This spec adds one persisted field and one read site — no new subsystem.

## Rules

1. **New field**: `GameState.bestStarRatings` is a `Record<string, number>` keyed by `Stage.id` (e.g. `'1-1'`), value is the highest star rating (1–3) ever achieved for that stage. Stages never attempted have no key (not `0`).
2. **Update timing**: `bestStarRatings` is updated inside `processVictory` (`src/battle/VictoryProcessor.ts`), the same place `completedStageIds` and `currency`/`expPool` are already updated on every victory — including repeat clears of an already-completed stage. `processVictory` is only ever invoked from the victory branch of `ResultScene`, so a defeat (star rating 0) never reaches this code path and can never overwrite a saved rating.
3. **Monotonic — only improves, never decreases**: the new value is `Math.max(existingBest, starRating)`. Replaying a stage with a worse performance than a prior clear must not lower the recorded best.
4. **Immutability**: `bestStarRatings` must be replaced with a new object (`{ ...prev, [id]: value }`), not mutated in place — matching this file's existing pattern for `pool`/`squad`/`stageProgress` (`VictoryProcessor.ts` lines 19–30).
5. **Legacy saves**: `bestStarRatings` is optional (`?:`) on `GameState`. Saves written before this feature have no such key; every read site must treat a missing record as `{}` and a missing per-stage entry as `0`. No save-file migration script is needed — this mirrors how `discoveredWeaknesses` and `equipmentInventory` were introduced.
6. **NG+ / Challenge Run carry-over**: `startNewGamePlus` (`src/save/GameState.ts`) already returns `{ ...gameState, ... }` without touching `bestStarRatings`, so best ratings persist across New Game+ automatically (consistent with `discoveredWeaknesses`, which is deliberately NOT reset by NG+ per `GameState.ts` line 34's comment). No code change needed there — call out as a **no-op verification**, not new logic.
7. **UI display — WorldMapScene only**: per the backlog wording ("世界地圖或關卡選擇畫面"), this codebase's only stage-select screen is `WorldMapScene`. Each **completed** stage row appends a 3-character star suffix (`★`×best, `☆`×remainder) to its existing label text. Non-completed rows (locked or available-but-uncleared) show no suffix — there is nothing to rate yet.

## Data model changes

`src/types.ts` — add one optional field to `GameState`, immediately after `equipmentInventory` (line 229), before the closing brace (line 230):

```ts
export interface GameState {
  // ...existing fields unchanged...
  equipmentInventory: EquipmentInventoryEntry[]; // owned, currently-unequipped equipment
  bestStarRatings?: Record<string, number>; // key = Stage.id, value = best star rating (1-3) ever achieved for that stage
}
```

`src/save/GameState.ts` — `newGame()` (lines 5–22) gains one initializer, alongside `equipmentInventory: []`:

```ts
export function newGame(slot: 0 | 1 | 2): GameState {
  const protagonist = PLAYER_TEMPLATES.find(t => t.isProtagonist)!;
  const char = createCharacter(protagonist, 1);
  return {
    slotId: slot,
    pool: [char],
    squad: [char],
    expPool: 0,
    currency: 0,
    stageProgress: { completedStageIds: [] },
    savedAt: Date.now(),
    inventory: [],
    ngPlusCycle: 0,
    hasClearedGame: false,
    discoveredWeaknesses: {},
    equipmentInventory: [],
    bestStarRatings: {},
  };
}
```

## VictoryProcessor.ts changes (exact hook point)

Insert immediately after the existing EXP-pool update (line 44, `state.expPool += scaledExpGained;`) and before the `hasClearedGame` block (line 46):

```ts
// Track best-ever star rating per stage (only improves, never decreases)
const existingBest = gameState.bestStarRatings?.[stage.id] ?? 0;
state.bestStarRatings = {
  ...(gameState.bestStarRatings ?? {}),
  [stage.id]: Math.max(existingBest, starRating),
};
```

No signature change to `processVictory` — `starRating` is already an existing parameter (default `1`) from `pixel-squad-mercenary-rating.md`.

## UI changes — WorldMapScene.ts

In `createStageList()` (`src/scenes/WorldMapScene.ts`), right after `isCompleted` is computed (line 117):

```ts
const isCompleted = this.isStageCompleted(stage.id);
const bestRating = this.gameState.bestStarRatings?.[stage.id] ?? 0;
```

Change the text-creation block (lines 156–165) to append the star suffix only when the stage is completed:

```ts
const starSuffix = isCompleted
  ? `  ${'★'.repeat(bestRating)}${'☆'.repeat(Math.max(0, 3 - bestRating))}`
  : '';

const text = this.add.text(
  20,
  0,
  `${prefix}${stage.name}${starSuffix}`,
  {
    fontSize: '13px',
    color: textColor,
    fontFamily: 'monospace',
  }
).setOrigin(0);
```

No new `Text` objects, no layout changes — `rowHeight`/scroll math (lines 92–197) are untouched since the suffix is part of the same single-line string.

## Test plan

New `tests/unit/GameState.bestStarRatings.test.ts` (mirrors `GameState.weakness.test.ts`):
- `newGame(0).bestStarRatings` is defined and equals `{}`.
- `startNewGamePlus` preserves an existing `bestStarRatings` entry unchanged (no-op verification of rule 6).

New `tests/unit/VictoryProcessor.bestStarRatings.test.ts` (mirrors `VictoryProcessor.starRating.test.ts` fixtures):
- Given a `GameState` with no `bestStarRatings` entry for stage `'1-1'`, `processVictory(state, stage, 100, undefined, 0, 2)` → `result.bestStarRatings['1-1'] === 2`.
- Given `bestStarRatings: { '1-1': 3 }`, calling `processVictory` again with `starRating = 1` → `result.bestStarRatings['1-1']` remains `3` (monotonic, rule 3).
- Given `bestStarRatings: { '1-1': 1 }`, calling `processVictory` again with `starRating = 3` → `result.bestStarRatings['1-1']` becomes `3`.
- Given a `GameState` built without a `bestStarRatings` key at all (simulating a legacy save loaded via `loadSlot`), `processVictory` does not throw and produces `result.bestStarRatings['1-1'] === starRating` (rule 5).
- `processVictory` does not mutate `gameState.bestStarRatings` — the input object's entry for `'1-1'` is unchanged after the call (rule 4, immutability).
- Clearing a *different* stage (`'1-2'`) does not touch or drop the existing `'1-1'` entry.

New `tests/unit/SaveSystem.bestStarRatings.test.ts` (mirrors `SaveSystem.equipment.test.ts`):
- `saveSlot`/`loadSlot` round-trips a `GameState` with a populated `bestStarRatings` map unchanged.

New `tests/unit/WorldMapScene.starHistory.test.ts` (source-text assertions, following this repo's precedent for scenes that can't be instantiated under vitest — see `BattleScene.mercenaryRating.test.ts`):
- Assert `createStageList` reads `this.gameState.bestStarRatings?.[stage.id] ?? 0` into a `bestRating` variable.
- Assert the star suffix is only concatenated into the row text when `isCompleted` is true (i.e., the ternary's false branch is an empty string, not omitted).
- Assert the suffix building uses `'★'.repeat(bestRating)` and `'☆'.repeat(...)`.

Run the full existing suite (`npm test` in `workspace-pixel-squad/`) — no existing test file should need edits, since `bestStarRatings` is optional everywhere it's read and every existing `GameState`/`processVictory` fixture omits it safely.

## Acceptance criteria

- **AC-1**: Given a fresh `newGame(0)`, when inspected, then `bestStarRatings` equals `{}` (not `undefined`).
- **AC-2**: Given a `GameState` with no prior record for stage `'2-3'`, when `processVictory` runs with `starRating = 3`, then `bestStarRatings['2-3'] === 3`.
- **AC-3**: Given `bestStarRatings: { '2-3': 3 }`, when the player replays stage `'2-3'` and clears it with `starRating = 1`, then `bestStarRatings['2-3']` is still `3` (never downgraded).
- **AC-4**: Given `bestStarRatings: { '2-3': 1 }`, when the player replays stage `'2-3'` and clears it with `starRating = 3`, then `bestStarRatings['2-3']` becomes `3`.
- **AC-5**: Given a `GameState` loaded from a save written before this feature (no `bestStarRatings` key present at all), when `processVictory` runs, then it does not throw and correctly initializes the record for the cleared stage.
- **AC-6**: Given a completed stage row with `bestStarRatings[stage.id] === 2`, when `WorldMapScene.createStageList()` renders it, then the row's text ends with `★★☆`.
- **AC-7**: Given a completed stage with no entry in `bestStarRatings` (legacy save, stage was completed before this feature existed), when rendered, then the row's text ends with `☆☆☆` (zero stars) rather than throwing or omitting the suffix.
- **AC-8**: Given a stage row that is locked or available-but-not-yet-cleared (`isCompleted === false`), when rendered, then no star suffix appears in its text at all.
- **AC-9**: Given a `GameState` with `bestStarRatings` populated across multiple stages, when passed through `saveSlot` then `loadSlot`, then the loaded state's `bestStarRatings` deep-equals the original.
- **AC-10**: Given `startNewGamePlus` is called on a state with existing `bestStarRatings` entries, when the returned state is inspected, then all entries are preserved unchanged (ratings are a lifetime record, not reset by NG+).
