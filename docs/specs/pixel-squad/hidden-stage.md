# 隱藏關卡 (Hidden Stage)

## Goal

Add a secret stage that is completely invisible on `WorldMapScene` until the player perfect-clears (zero squad KOs) a designated prerequisite stage, then persist that unlock permanently.

## Background

The world map (`src/scenes/WorldMapScene.ts`) currently has exactly two visibility states for a stage: locked (🔒, shown but not playable) or available/completed. There is no concept of a stage that is *absent* from the list until an unusual condition is met. `BattleScene` already tracks `battleStats.playerKOCount` per battle (`src/scenes/BattleScene.ts:964`, incremented whenever `target.isPlayer` dies) and `ResultScene` already reads `battleStats` to compute the star rating (`src/scenes/ResultScene.ts:27-29`), so "did the whole squad survive this clear" is already computable at the exact point where `processVictory` runs — it just isn't captured anywhere.

Note: `src/data/stages.ts` also defines `SQ-1`/`SQ-2`/`SQ-3` with `chapterId: 'sq'`, but `'sq'` is never added to `CHAPTERS` (`src/data/chapters.ts`), so `WorldMapScene.createStageList()` — which only iterates `CHAPTERS.forEach(chapter => chapter.stageIds...)` — never renders them. That's a pre-existing bug outside this spec's scope. **Do not** model the hidden stage the same way (i.e. do not give it a `chapterId` that WorldMapScene discovers via `CHAPTERS`) — model it as a standalone stage that `WorldMapScene` looks up directly from `STAGES`, per the UI changes below, so it is actually reachable in the running game.

## Rules

1. **New flag**: `Stage.isHidden` marks a stage as hidden. Hidden stages are never rendered by the normal `CHAPTERS.forEach` loop in `createStageList()` — they get their own render pass (see UI changes).
2. **Unlock condition**: `Stage.unlockRequiresPerfectClear` holds the `Stage.id` of a prerequisite stage. The hidden stage becomes unlocked once that prerequisite stage id appears in `GameState.perfectClearStageIds`.
3. **"Perfect clear" definition**: a victory where `battleStats.playerKOCount === 0` — no squad member died at any point during the battle (defending, healing, or reviving mid-battle doesn't matter; only whether a KO ever happened, per the existing counter at `BattleScene.ts:964`). Defeats never count, regardless of KO count.
4. **Recording**: `perfectClearStageIds` is updated inside `processVictory` (`src/battle/VictoryProcessor.ts`) — the same function and call site that already updates `completedStageIds` and `bestStarRatings` — via a new `alliesSurvived` parameter. This mirrors `bestStarRatings`' integration pattern from `specs/pixel-squad-mercenary-rating-history.md`.
5. **Monotonic set, no duplicates**: once a stage id is added to `perfectClearStageIds` it is never removed, and re-clearing it (perfectly or not) never duplicates the entry.
6. **Not retroactive to the hidden stage itself**: `unlockRequiresPerfectClear` always names a *different* stage than the hidden stage — clearing the hidden stage perfectly doesn't unlock itself. (Nothing enforces this in code; it's a data-authoring rule for whoever adds new hidden stages.)
7. **Visibility, not just availability**: a locked-but-visible row (🔒, like a not-yet-reached normal stage) is *not* how hidden stages behave. Before the unlock condition is met, the hidden stage produces **no row at all** — it must not appear in `this.stageRows`, must not affect scroll height, and must not be discoverable by scrolling.
8. **Once unlocked, it behaves like a normal stage**: playable immediately (no additional per-chapter sequencing check), shows ✅ + best-star suffix once completed, persists across NG+ and challenge runs (no reset logic needed — `startNewGamePlus` in `src/save/GameState.ts` already spreads `...gameState` untouched, matching the established `discoveredWeaknesses`/`bestStarRatings` precedent — this is a no-op verification, not new logic).
9. **Legacy saves**: `perfectClearStageIds` is optional (`?:`). Every read site treats a missing array as `[]`. No migration script — mirrors `discoveredWeaknesses`/`equipmentInventory`/`bestStarRatings`.
10. **`battleStats` can be absent**: `ResultScene`'s `battleStats` param is optional (`ResultSceneData.battleStats?`). If it's missing, treat the clear as *not* a perfect clear (`alliesSurvived = false`) — never throw, never guess.

## Data model changes

`src/types.ts` — extend `Stage` (insert after `itemRewards?: StageItemReward[]; // side quests only, granted on first clear` at line 148, before the closing brace at line 149):

```ts
export interface Stage {
  // ...existing fields unchanged...
  itemRewards?: StageItemReward[]; // side quests only, granted on first clear
  isHidden?: boolean;                    // true = never listed by the normal per-chapter render loop; see WorldMapScene changes
  unlockRequiresPerfectClear?: string;    // Stage.id that must appear in GameState.perfectClearStageIds to reveal this stage
}
```

`src/types.ts` — extend `GameState` (insert after `bestStarRatings?: Record<string, number>;` at line 230, before the closing brace at line 231):

```ts
export interface GameState {
  // ...existing fields unchanged...
  bestStarRatings?: Record<string, number>;
  perfectClearStageIds?: string[]; // Stage.id values ever cleared with battleStats.playerKOCount === 0
}
```

`src/save/GameState.ts` — `newGame()` (lines 5-22) gains one initializer, alongside `bestStarRatings: {}`:

```ts
export function newGame(slot: 0 | 1 | 2): GameState {
  // ...
  return {
    // ...existing fields unchanged...
    bestStarRatings: {},
    perfectClearStageIds: [],
  };
}
```

### `VictoryProcessor.ts` — exact hook point

Signature (lines 6-13) gains a 7th parameter, appended after `starRating` (matches how `starRating` itself was appended in a prior spec — never reorder existing positional params):

```ts
export function processVictory(
  gameState: GameState,
  stage: Stage,
  expGained: number,
  recruitedEnemy: Character | undefined,
  ngPlusCycle = 0,
  starRating = 1,
  alliesSurvived = false,
): GameState {
```

Insert immediately after the existing `bestStarRatings` block (after line 51, `};`, and before the `hasClearedGame` comment on line 53):

```ts
// Track hidden-stage unlock progress — perfect (zero-KO) clears only, never removed once earned
state.perfectClearStageIds = [...(gameState.perfectClearStageIds ?? [])];
if (alliesSurvived && !state.perfectClearStageIds.includes(stage.id)) {
  state.perfectClearStageIds.push(stage.id);
}
```

### `ResultScene.ts` — exact hook point

In `create()`, immediately after the existing `starRating` computation (after line 29, before the `if (victory && starRating > 0)` block on line 31):

```ts
const alliesSurvived = victory && !!battleStats && battleStats.playerKOCount === 0;
```

Change the `processVictory` call (line 53) to pass it through:

```ts
updatedGameState = processVictory(gameState, stage, expGained, recruitedEnemy, undefined, starRating, alliesSurvived);
```

## UI changes — `WorldMapScene.ts`

Add a private helper, placed next to `isStageCompleted` (after line 248):

```ts
private isHiddenStageUnlocked(stage: Stage): boolean {
  if (!stage.unlockRequiresPerfectClear) return false;
  return (this.gameState.perfectClearStageIds ?? []).includes(stage.unlockRequiresPerfectClear);
}
```

Modify `isStageAvailable` (lines 222-244) — add a branch as the very first statement in the method body:

```ts
private isStageAvailable(stage: Stage): boolean {
  if (stage.isHidden) return this.isHiddenStageUnlocked(stage);

  // ...existing side-quest / regular-stage logic unchanged...
}
```

In `createStageList()`, after the closing `});` of the `CHAPTERS.forEach(...)` block (line 178) and before the `// Calculate max scroll` comment (line 180), add a second render pass. This reuses the exact same `rowHeight`/`background`/`text` construction as the per-chapter loop above it — same interactive wiring, same `this.stageRows.push(...)` — the only new logic is the early-return-if-not-unlocked guard that keeps the stage entirely absent from the list, and a `🌟` prefix so an unlocked-but-unplayed hidden stage reads as distinct from a normal available stage:

```ts
// Hidden stages: absent from the list entirely until unlocked (secret, not just locked)
STAGES.filter((s) => s.isHidden).forEach((stage) => {
  if (!this.isHiddenStageUnlocked(stage)) return;

  const isAvailable = this.isStageAvailable(stage);
  const isCompleted = this.isStageCompleted(stage.id);
  const bestRating = this.gameState.bestStarRatings?.[stage.id] ?? 0;

  let bgColor = 0x374151;
  let textColor = '#6b7280';
  let prefix = '🌟 ';

  if (isCompleted) {
    bgColor = 0x065f46;
    textColor = '#d1d5db';
    prefix = '🌟✅ ';
  } else if (isAvailable) {
    bgColor = 0x4c1d95;
    textColor = '#ffffff';
    prefix = '🌟▶ ';
  }

  const background = this.add.rectangle(0, 0, 320, rowHeight, bgColor).setOrigin(0);

  if (isAvailable) {
    background.setInteractive({ useHandCursor: true });
    background.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.launchStage(stage); });
    background.on('pointerover', () => background.setFillStyle(0x2d5a8c));
    background.on('pointerout', () => background.setFillStyle(bgColor));
  }

  const starSuffix = isCompleted
    ? `  ${'★'.repeat(bestRating)}${'☆'.repeat(Math.max(0, 3 - bestRating))}`
    : '';

  const text = this.add.text(20, 0, `${prefix}${stage.name}${starSuffix}`, {
    fontSize: '13px',
    color: textColor,
    fontFamily: 'monospace',
  }).setOrigin(0);

  this.stageRows.push({ background, text, stage });
});
```

No other changes to `createStageList()`, `updateStageListPositions()`, or scroll math — hidden-stage rows are pushed into the same `this.stageRows` array used by the existing per-chapter rows, so scrolling/visibility culling (lines 187-202) works unmodified.

## Content — `src/data/stages.ts`

Add one new hidden stage after the `Side Quests` section (after line 355, before the closing `];` on line 356):

```ts
  // ── Hidden Stage ────────────────────────────────────────────────────────
  {
    id: 'HS-1', chapterId: 'hidden', name: '隱藏關卡：廢土密室', stageIndex: 0,
    isBoss: false, isSideQuest: false, isHidden: true,
    unlockRequiresPerfectClear: '2-5',
    enemies: [
      { id: 'vault_guardian_a', name: '密室守衛', baseStats: { hp: 150, atk: 30, def: 20, spd: 15 }, skillIds: [], monsterType: 'jinn', weakness: 'thunder' },
      { id: 'vault_guardian_b', name: '密室守衛', baseStats: { hp: 150, atk: 30, def: 20, spd: 15 }, skillIds: [], monsterType: 'jinn', weakness: 'thunder' },
      { id: 'vault_keeper', name: '密室看守者', baseStats: { hp: 220, atk: 34, def: 24, spd: 13 }, skillIds: [], monsterType: 'jinn', weakness: 'ice' },
    ],
    expReward: 300, currencyReward: 300,
    itemRewards: [{ itemId: 'supply_nano_kit', quantity: 3 }],
    preDialog: {
      speaker: '???',
      lines: [
        '你們竟然毫髮無傷地走到這裡⋯⋯',
        '這座密室只為未曾倒下的隊伍敞開。',
        '證明你們的實力吧。',
      ],
    },
  },
```

Rationale for `unlockRequiresPerfectClear: '2-5'`: gating on a *boss* clear (Crow, chapter 2) rather than a regular stage makes the "no deaths" condition a genuine challenge (bosses hit harder than regular mobs), and chapter-2 timing means most players have at least one healer/buffer skill unlocked by then, so it's demanding but not exclusively end-game. `itemRewards` reuses `supply_nano_kit` (already defined in `EXCLUSIVE_ITEMS`, already reused across `SQ-2`/`SQ-3` per existing precedent at `stages.ts:340,353`) rather than introducing a new exclusive item — no new skill/equipment data needed for this feature.

## Test plan

New `tests/unit/GameState.perfectClear.test.ts` (mirrors `GameState.bestStarRatings.test.ts`):
- `newGame(0).perfectClearStageIds` is defined and equals `[]`.
- `startNewGamePlus` preserves an existing `perfectClearStageIds` entry unchanged (no-op verification of rule 8).

New `tests/unit/VictoryProcessor.perfectClear.test.ts` (mirrors `VictoryProcessor.bestStarRatings.test.ts` fixtures):
- Given a `GameState` with `perfectClearStageIds: []`, `processVictory(state, stage, 100, undefined, 0, 1, true)` → `result.perfectClearStageIds` contains `stage.id`.
- Given the same state, `processVictory(..., alliesSurvived = false)` (or the parameter omitted) → `result.perfectClearStageIds` does not contain `stage.id`.
- Given `perfectClearStageIds: ['2-5']`, calling `processVictory` again on stage `'2-5'` with `alliesSurvived = true` → `result.perfectClearStageIds` still has exactly one `'2-5'` entry (no duplicate, rule 5).
- Given a `GameState` built without a `perfectClearStageIds` key at all (legacy save), `processVictory(..., alliesSurvived = true)` does not throw and produces `result.perfectClearStageIds` containing the cleared stage id (rule 9).
- `processVictory` does not mutate `gameState.perfectClearStageIds` in place — the input array is unchanged after the call.

New `tests/unit/ResultScene.alliesSurvived.test.ts` (source-text assertions, following this repo's precedent for scenes that can't be instantiated under vitest — see `BattleScene.mercenaryRating.test.ts`):
- Assert `create()` computes `alliesSurvived` as `victory && !!battleStats && battleStats.playerKOCount === 0`.
- Assert the `processVictory(...)` call site passes `alliesSurvived` as its 7th argument.

New `tests/unit/StageData.hiddenStage.test.ts`:
- `STAGES.find(s => s.id === 'HS-1')` exists, has `isHidden === true` and `unlockRequiresPerfectClear === '2-5'`.
- The referenced prerequisite id (`'2-5'`) exists in `STAGES`.
- `'HS-1'` does not appear in any `Chapter.stageIds` in `CHAPTERS` (confirms it's deliberately not reachable via the per-chapter render loop, per the Background section's warning about the `SQ-*` bug).

New `tests/unit/WorldMapScene.hiddenStage.test.ts` (source-text assertions, same technique as `WorldMapScene.starHistory.test.ts`):
- Assert `isStageAvailable` has an early `if (stage.isHidden) return this.isHiddenStageUnlocked(stage);` branch.
- Assert `createStageList` contains a `STAGES.filter((s) => s.isHidden)` pass with an early `if (!this.isHiddenStageUnlocked(stage)) return;` guard.
- Assert the hidden-stage pass pushes into `this.stageRows` (same array as the per-chapter loop, confirming scroll math is shared, not duplicated).

Run the full existing suite (`npm test` in `workspace-pixel-squad/`) — no existing test file should need edits, since both new fields are optional everywhere they're read and every existing `GameState`/`processVictory`/`ResultSceneData` fixture omits them safely.

## Acceptance criteria

- **AC-1**: Given a fresh `newGame(0)`, when inspected, then `perfectClearStageIds` equals `[]` (not `undefined`).
- **AC-2**: Given a `GameState` with `perfectClearStageIds: []`, when the player wins stage `'2-5'` with `battleStats.playerKOCount === 0`, then `perfectClearStageIds` contains `'2-5'` after the result screen processes the victory.
- **AC-3**: Given the same setup but `battleStats.playerKOCount === 1` (one squad member was KO'd at any point, even if later revived/healed), when the victory is processed, then `perfectClearStageIds` does **not** gain a `'2-5'` entry.
- **AC-4**: Given `perfectClearStageIds` does not contain `'2-5'`, when `WorldMapScene.createStageList()` renders, then no row for stage `'HS-1'` exists anywhere in `this.stageRows` — it is not merely styled as locked, it produces zero rows.
- **AC-5**: Given `perfectClearStageIds` contains `'2-5'` and `'HS-1'` is not yet in `completedStageIds`, when `WorldMapScene.createStageList()` renders, then exactly one row for `'HS-1'` exists, styled as available (`🌟▶ ` prefix, interactive, launches `BattleScene` on click).
- **AC-6**: Given `'HS-1'` is unlocked and subsequently completed, when rendered, then its row shows the `🌟✅ ` prefix and the same best-star suffix behavior as normal completed stages (reusing `bestStarRatings`).
- **AC-7**: Given a `ResultSceneData` with `battleStats` undefined (e.g. a code path that doesn't track it), when the result screen processes a victory, then `alliesSurvived` is computed as `false` and `processVictory` does not throw.
- **AC-8**: Given `startNewGamePlus` is called on a state with existing `perfectClearStageIds` entries, when the returned state is inspected, then all entries are preserved unchanged (lifetime record, not reset by NG+).
- **AC-9**: Given a `GameState` loaded from a save written before this feature (no `perfectClearStageIds` key at all), when `processVictory` runs with `alliesSurvived = true`, then it does not throw and correctly initializes the array with the cleared stage id.
- **AC-10**: Given the player perfectly clears `'2-5'` twice in a row (e.g. replaying it), when inspected after the second clear, then `perfectClearStageIds` contains `'2-5'` exactly once (no duplicate entries).
