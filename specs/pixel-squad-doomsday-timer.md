# 世界末日計時器 (Doomsday Timer)

## Goal

Add a persistent, per-save-slot countdown of "廢土倒數天數" that decreases every time the player clears a battle — main-story stages cost the least, side quests and the hidden stage cost more — so that doing every optional detour is not free, and running the clock to 0 before finishing the main story (`hasClearedGame`) ends the run in a "世界末日" bad ending.

## Background (current state)

- `GameState` (`types.ts:220-238`) has no time/day/turn counter of any kind. The closest things are `savedAt` (a `Date.now()` timestamp used only for save-slot metadata display) and `BattlePerformanceStats.roundsUsed` (`types.ts:170-174`), which is per-battle, ephemeral, and never written back to `GameState`.
- `Stage` (`types.ts:137-153`) already carries the exact flags needed to tell main-story from optional content: `isSideQuest: boolean` and `isHidden?: boolean`. A stage where both are falsy (including `isBoss: true` stages) is a main-story stage. There are 25 main-story stages (`1-1`..`5-5`, 5 chapters × 5 stages), 3 side quests (`SQ-1`, `SQ-2`, `SQ-3`), and 1 hidden stage (`HS-1`) — confirmed in `data/stages.ts`.
- **Pre-existing bug, not in scope of this spec**: side quests have `chapterId: 'sq'`, which is never registered in `CHAPTERS` (`data/chapters.ts`), so `WorldMapScene.createStageList()`'s `CHAPTERS.forEach(...)` loop never renders `SQ-1/2/3` today (documented in `specs/pixel-squad-hidden-stage.md:11`). This spec's side-quest day-cost logic is written against the `Stage` data regardless, so it activates automatically once that bug is fixed; it is not blocked by it, and no fix for it is included here.
- `processVictory()` (`battle/VictoryProcessor.ts:7-126`) is the single funnel every stage-clear passes through — called once per victory from `ResultScene.create()` (`scenes/ResultScene.ts:55`) with the full `Stage` object, so it already has everything needed to look up the stage's day-cost.
- Save persistence (`save/SaveSystem.ts`) is a plain `localStorage` JSON round-trip with no versioning. The established pattern for adding state (used by `bestStarRatings`, `perfectClearStageIds`, `discoveredWeaknesses`, `bondLevels`) is: make the new `GameState` field optional (`?:`), default it at every read site, and never write a migration script.
- `newGame()` and `startNewGamePlus()` (`save/GameState.ts`) are where new fields get explicit initial values.
- Stage selection (`scenes/WorldMapScene.ts`) already lets the player replay a completed stage — `isStageAvailable()` (`WorldMapScene.ts:266-290`) never excludes a stage just because it's completed, and the `pointerdown` handler that calls `launchStage()` is attached whenever `isAvailable` is true, completed or not. So repeat-clears/farming are already possible today and must be accounted for by this feature (see Rule 4).
- `ui/theme.ts` defines a `Colors` palette, but neither `WorldMapScene.ts` nor `BaseScene.ts` imports it — both hand-write raw hex color strings (`'#fbbf24'`, `'#4ade80'`, `'#ef4444'`, ...) directly in their `create()` methods. This spec follows that local convention rather than introducing a new dependency on `theme.ts` into those two files.

## Rules

1. **New field**: `GameState.doomsdayDaysRemaining?: number`. Optional, following the established convention — a missing value is always treated as the full starting amount (`DOOMSDAY_INITIAL_DAYS`), so legacy saves are never mid-countdown until their first tick.
2. **Constants live in one place**, `battle/DoomsdayClock.ts`, as exported `const`s (not inlined), so future rebalancing never touches logic:
   - `DOOMSDAY_INITIAL_DAYS = 32`
   - `MAIN_STORY_DAY_COST = 1`
   - `SIDE_QUEST_DAY_COST = 3`
   - `HIDDEN_STAGE_DAY_COST = 4`
   - Rationale for `32`: main story alone (25 stages × 1) leaves a 7-day buffer — enough to also clear the hidden stage (4) or one side quest (3), but not all three side quests (9) on top of the main story. This is what creates the "prioritize the main story" pressure the feature is meant to add, without making a straight-through main-story run infeasible.
3. **Cost lookup** is based purely on `Stage` flags, checked in this order: hidden stage (`isHidden === true`) → `HIDDEN_STAGE_DAY_COST`; else side quest (`isSideQuest === true`) → `SIDE_QUEST_DAY_COST`; else (main story, including bosses) → `MAIN_STORY_DAY_COST`.
4. **Every victory ticks the clock**, first clear or repeat clear alike (farming/replaying an already-completed stage costs a day too — intentional, since unlimited free farming would defeat the whole point of a time-pressure mechanic). **Defeats never tick the clock** — only `processVictory()` (called on the victory path) touches `doomsdayDaysRemaining`; retrying a lost battle is always free.
5. `doomsdayDaysRemaining` is **clamped at a floor of 0** — it never goes negative.
6. **Post-game clears still tick the clock**, clamped at 0, even after `hasClearedGame` is already `true` — but see Rule 7, the expiry check is gated on `hasClearedGame`, so this never re-triggers the bad ending for a player who already beat the game and is farming afterward.
7. **Doomsday expiry** = `doomsdayDaysRemaining <= 0 && !hasClearedGame`. This is a pure, order-sensitive check: `processVictory()` already sets `state.hasClearedGame = true` (`VictoryProcessor.ts:66-68`, when `stage.id === '5-5'`) *before* the clock tick is applied later in the same function (see Data model changes), so **clearing the final boss stage in the exact battle that would also bring the clock to 0 is a win, not a loss** — a simultaneous main-story completion always takes priority over expiry.
8. **On first becoming true**, doomsday expiry ends the current run: `ResultScene` shows a bad-ending screen instead of the normal victory continuation (no reward summary, no "整備" button) — the only action offered is returning to `TitleScene`. The save is still written (`saveSlot`) so the expired state persists.
9. **Reload guard**: if a player later re-opens that same slot from `TitleScene` (e.g. a refresh before tapping the end-screen button), `TitleScene.handleSlotTap()` must detect the same expiry condition and show a locked-slot message instead of entering `WorldMapScene`/`BaseScene`. This is the only other check point in the codebase — no additional guards are added to `WorldMapScene`/`BaseScene`/`BattleScene`, since expiry can only ever be produced by `processVictory`, which is always immediately followed by one of these two checkpoints.
10. **New Game+**: `startNewGamePlus()` resets `doomsdayDaysRemaining` back to `DOOMSDAY_INITIAL_DAYS`, regardless of how depleted it was — a fresh countdown every NG+ cycle, consistent with `stageProgress` also being reset in the same function.
11. The countdown never ticks from anything other than a stage-clear (no wall-clock, no per-round ticking) — fully deterministic and reproducible from save data alone.

## Data model changes

`types.ts` — add one field to `GameState`, immediately after `bondLevels` (insert after line 237, before the closing `}` at line 238):

```ts
export interface GameState {
  // ...existing fields unchanged...
  bondLevels?: Record<string, number>;
  doomsdayDaysRemaining?: number; // days left on the global countdown; undefined = DOOMSDAY_INITIAL_DAYS (legacy save / not yet ticked)
}
```

New file `battle/DoomsdayClock.ts` (mirrors the small-pure-functions style of `battle/BondSystem.ts`):

```ts
import type { GameState, Stage } from '../types';

export const DOOMSDAY_INITIAL_DAYS = 32;
export const MAIN_STORY_DAY_COST = 1;
export const SIDE_QUEST_DAY_COST = 3;
export const HIDDEN_STAGE_DAY_COST = 4;

/** Days deducted from the clock when `stage` is cleared. */
export function getStageDoomsdayCost(stage: Stage): number {
  if (stage.isHidden) return HIDDEN_STAGE_DAY_COST;
  if (stage.isSideQuest) return SIDE_QUEST_DAY_COST;
  return MAIN_STORY_DAY_COST;
}

/** Current days remaining, defaulting a missing/legacy value to DOOMSDAY_INITIAL_DAYS. */
export function getDoomsdayDaysRemaining(gameState: GameState): number {
  return gameState.doomsdayDaysRemaining ?? DOOMSDAY_INITIAL_DAYS;
}

/** Days remaining after clearing `stage`, floored at 0. Pure — does not mutate `gameState`. */
export function tickDoomsdayClock(gameState: GameState, stage: Stage): number {
  return Math.max(0, getDoomsdayDaysRemaining(gameState) - getStageDoomsdayCost(stage));
}

/** True once the clock has hit 0 and the player has not already beaten the game. */
export function isDoomsdayExpired(gameState: GameState): boolean {
  return getDoomsdayDaysRemaining(gameState) <= 0 && !gameState.hasClearedGame;
}
```

New file `ui/doomsdayDisplay.ts` (pure formatting helper, mirrors `ui/starRating.ts` — no Phaser dependency, so `WorldMapScene.ts` and `BaseScene.ts` can share one formatting rule without duplicating thresholds):

```ts
/** '#4ade80' green >15 days, '#fbbf24' yellow 6-15 days, '#ef4444' red <=5 days. */
export function getDoomsdayColor(daysRemaining: number): string {
  if (daysRemaining <= 5) return '#ef4444';
  if (daysRemaining <= 15) return '#fbbf24';
  return '#4ade80';
}

export function formatDoomsdayLabel(daysRemaining: number): string {
  return `⏳ 剩餘 ${daysRemaining} 天`;
}
```

## `save/GameState.ts` changes

`newGame()` — add the field to the returned object, after `perfectClearStageIds: []` (line 22):

```ts
import { DOOMSDAY_INITIAL_DAYS } from '../battle/DoomsdayClock';
// ...
export function newGame(slot: 0 | 1 | 2): GameState {
  const protagonist = PLAYER_TEMPLATES.find(t => t.isProtagonist)!;
  const char = createCharacter(protagonist, 1);
  return {
    // ...existing fields unchanged...
    perfectClearStageIds: [],
    doomsdayDaysRemaining: DOOMSDAY_INITIAL_DAYS,
  };
}
```

`startNewGamePlus()` — add the same reset inside the spread object, after `ngPlusCycle: gameState.ngPlusCycle + 1` (line 30):

```ts
export function startNewGamePlus(gameState: GameState): GameState {
  return {
    ...gameState,
    stageProgress: { completedStageIds: [], inChapterRun: undefined },
    ngPlusCycle: gameState.ngPlusCycle + 1,
    doomsdayDaysRemaining: DOOMSDAY_INITIAL_DAYS,
    savedAt: Date.now(),
  };
}
```

## `battle/VictoryProcessor.ts` changes

Add the import at the top of the file, alongside the existing ones:

```ts
import { tickDoomsdayClock } from './DoomsdayClock';
```

Insert the tick as the last mutation in `processVictory()`, immediately before `state.savedAt = Date.now();` (currently line 124) — i.e. after the `hasClearedGame` assignment (lines 66-68) has already run, so the ordering in Rule 7 holds:

```ts
  // Doomsday clock: ticks down on every clear (main story cheapest, side/hidden content costs more)
  state.doomsdayDaysRemaining = tickDoomsdayClock(gameState, stage);

  state.savedAt = Date.now();
  return state;
```

No change to `processVictory`'s parameter list — this feature needs no new inputs, since `stage` and `gameState` are already passed in.

## `scenes/ResultScene.ts` changes

Add the import:

```ts
import { isDoomsdayExpired } from '../battle/DoomsdayClock';
```

In the `victory` branch of `create()`, right after the existing `saveSlot(updatedGameState)` call (line 56), check expiry and, if true, render the bad ending and stop — skip all the normal reward/party rendering and the "整備" button entirely:

```ts
    if (victory) {
      let updatedGameState = gameState;
      const isFirstClear = !!gameState && !!stage && !gameState.stageProgress.completedStageIds.includes(stage.id);
      if (gameState && stage) {
        updatedGameState = processVictory(gameState, stage, expGained, recruitedEnemy, undefined, starRating, alliesSurvived, playerParty);
        saveSlot(updatedGameState);
      }

      if (updatedGameState && isDoomsdayExpired(updatedGameState)) {
        this.renderDoomsdayEnding();
        return;
      }

      const newExpPool = updatedGameState?.expPool ?? (expPool + expGained);
      // ...existing reward/party/整備-button rendering unchanged below this line...
```

New private method, added alongside the existing `makeButton` helper:

```ts
  private renderDoomsdayEnding() {
    const W = 360;
    this.add.text(W / 2, 300, '然而，廢土的時間已耗盡……', {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(W / 2, 336, '世界末日降臨了', {
      fontSize: '20px', color: '#ef4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.makeButton(W / 2, 480, '返回標題', 0x374151, () => this.scene.start('TitleScene'));
  }
```

The `victory: true` title ("勝利！") and star rating at the top of `create()` (lines 21-44) are left rendering as-is above this branch point — the player did win that battle; it's the overarching run that's over. No other changes to the `!victory` (defeat) branch.

## `scenes/TitleScene.ts` changes

Add the import:

```ts
import { isDoomsdayExpired } from '../battle/DoomsdayClock';
```

Modify `handleSlotTap()` (`TitleScene.ts:125-137`) to check expiry right after loading the slot, before either of the existing scene-start branches:

```ts
  private handleSlotTap(meta: SlotMeta) {
    if (meta.empty) {
      this.startNewGameInSlot(meta.slot);
      return;
    }
    const state: GameState | null = loadSlot(meta.slot);
    if (!state) { this.startNewGameInSlot(meta.slot); return; }
    if (isDoomsdayExpired(state)) {
      this.showDoomsdayLockedMessage();
      return;
    }
    if (state.stageProgress.inChapterRun) {
      this.scene.start('WorldMapScene', state);
    } else {
      this.scene.start('BaseScene', state);
    }
  }
```

New private method — a transient in-place message, no scene transition, so the player stays on `TitleScene` and can use the existing "刪除" button to remove the expired slot and start fresh:

```ts
  private showDoomsdayLockedMessage() {
    const W = 360, H = 640;
    const msg = this.add.text(W / 2, H - 40, '此存檔的世界已終結，請刪除後重新開始', {
      fontSize: '12px', color: '#ef4444', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.time.delayedCall(2500, () => {
      if (!this.scene.isActive()) return;
      msg.destroy();
    });
  }
```

## UI changes — `scenes/WorldMapScene.ts`

Add the import:

```ts
import { getDoomsdayColor, formatDoomsdayLabel } from '../ui/doomsdayDisplay';
import { getDoomsdayDaysRemaining } from '../battle/DoomsdayClock';
```

In `create()`, immediately after the existing currency display block (after line 64, `}).setOrigin(1, 0.5);` that closes the currency `add.text` call), add a second right-aligned line directly below it:

```ts
    const doomsdayDays = getDoomsdayDaysRemaining(this.gameState);
    this.add.text(W - 20, 48, formatDoomsdayLabel(doomsdayDays), {
      fontSize: '12px',
      color: getDoomsdayColor(doomsdayDays),
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);
```

No other changes to `WorldMapScene.ts` — the stage list, scroll handling, and `isStageAvailable`/`launchStage` logic are untouched.

## UI changes — `scenes/BaseScene.ts`

Add the same two imports as above. In `create()`, immediately after the existing currency text (after line 45, `}).setOrigin(1, 0.5);`), add:

```ts
    const doomsdayDays = getDoomsdayDaysRemaining(gameState);
    this.add.text(320, 40, formatDoomsdayLabel(doomsdayDays), {
      fontSize: '11px',
      color: getDoomsdayColor(doomsdayDays),
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);
```

No other changes to `BaseScene.ts`.

## Test plan

New test files, following existing naming/style conventions:

- `tests/unit/DoomsdayClock.test.ts` — pure-function coverage, the bulk of the logic:
  - `getStageDoomsdayCost`: returns `MAIN_STORY_DAY_COST` for a stage with `isSideQuest: false, isHidden: undefined` (incl. `isBoss: true`); `SIDE_QUEST_DAY_COST` for `isSideQuest: true`; `HIDDEN_STAGE_DAY_COST` for `isHidden: true` (even if `isSideQuest` were also true — hidden check wins per Rule 3).
  - `getDoomsdayDaysRemaining`: returns `DOOMSDAY_INITIAL_DAYS` when `doomsdayDaysRemaining` is `undefined`; returns the stored value otherwise (including `0`).
  - `tickDoomsdayClock`: subtracts the correct per-type cost; floors at `0` (e.g. `doomsdayDaysRemaining: 2` minus a `HIDDEN_STAGE_DAY_COST` of `4` → `0`, not `-2`).
  - `isDoomsdayExpired`: `true` when `doomsdayDaysRemaining <= 0 && hasClearedGame === false`; `false` when `doomsdayDaysRemaining > 0` regardless of `hasClearedGame`; `false` when `doomsdayDaysRemaining <= 0 && hasClearedGame === true`.
- `tests/unit/VictoryProcessor.doomsday.test.ts`:
  - Clearing a main-story, side-quest, and hidden stage each deduct the expected number of days from a fixed starting `doomsdayDaysRemaining`.
  - Repeated clears of the same already-completed stage keep deducting (no "first clear only" gate).
  - A `gameState` with `doomsdayDaysRemaining: undefined` (legacy save) is treated as starting from `DOOMSDAY_INITIAL_DAYS`.
  - The result clamps at `0` and never goes negative across repeated calls.
  - Clearing stage `'5-5'` from a `doomsdayDaysRemaining` that would hit `0` in the same call results in `state.hasClearedGame === true` **and** `isDoomsdayExpired(state) === false` (Rule 7's win-priority case).
  - Existing `VictoryProcessor` tests (recruit, bond, star rating, item rewards, etc.) must still pass unmodified — the new field is optional and additive.
- `tests/unit/GameState.doomsday.test.ts`:
  - `newGame()` returns `doomsdayDaysRemaining === DOOMSDAY_INITIAL_DAYS`.
  - `startNewGamePlus()` resets `doomsdayDaysRemaining` to `DOOMSDAY_INITIAL_DAYS` even when the input state had it partially depleted (e.g. `5`).
- `tests/unit/ResultScene.doomsday.test.ts` and `tests/unit/TitleScene.doomsday.test.ts` — source-text assertions via the existing `tests/unit/support/extractMethod.ts` helper (Phaser scenes can't be instantiated under vitest, matching the precedent set by `BattleScene.aoaWiring.test.ts`/`BattleScene.sceneGuard.test.ts`):
  - `ResultScene.ts`'s `create()` method calls `isDoomsdayExpired` after `saveSlot(updatedGameState)` and before the `整備` button/reward-rendering code.
  - `TitleScene.ts`'s `handleSlotTap()` method calls `isDoomsdayExpired` before either `scene.start('WorldMapScene', ...)` or `scene.start('BaseScene', ...)`.
  - Since the underlying decision logic (`isDoomsdayExpired`) is fully covered by real behavioral tests in `DoomsdayClock.test.ts`, these two files only need to confirm the wiring exists at the right point — they are not required to re-verify the boolean logic itself.

## Acceptance criteria

- **AC-1**: Given a brand-new save slot, when `newGame()` is called, then `doomsdayDaysRemaining === 32`.
- **AC-2**: Given a `GameState` with `doomsdayDaysRemaining: 10`, when a main-story stage (`isSideQuest: false`, `isHidden` falsy) is cleared via `processVictory`, then the returned state has `doomsdayDaysRemaining === 9`.
- **AC-3**: Given the same starting state, when a side-quest stage (`isSideQuest: true`) is cleared, then `doomsdayDaysRemaining === 7`.
- **AC-4**: Given the same starting state, when the hidden stage (`isHidden: true`) is cleared, then `doomsdayDaysRemaining === 6`.
- **AC-5**: Given `doomsdayDaysRemaining: 2`, when the hidden stage is cleared, then `doomsdayDaysRemaining === 0` (not negative).
- **AC-6**: Given a legacy `GameState` with no `doomsdayDaysRemaining` key at all, when `getDoomsdayDaysRemaining` is called, then it returns `32`.
- **AC-7**: Given `doomsdayDaysRemaining: 1` and `hasClearedGame: false`, when any non-final-boss stage is cleared, then `isDoomsdayExpired(result) === true`, and `ResultScene` renders the doomsday-ending screen (no "整備" button, no reward text).
- **AC-8**: Given `doomsdayDaysRemaining: 1` and `hasClearedGame: false`, when stage `'5-5'` is cleared, then `result.hasClearedGame === true` and `isDoomsdayExpired(result) === false` — the player wins outright even though the clock also reaches 0 in the same battle.
- **AC-9**: Given `hasClearedGame: true` and `doomsdayDaysRemaining: 1`, when any stage is cleared, then `doomsdayDaysRemaining` becomes `0` (clamped) but `isDoomsdayExpired(result) === false`, and `ResultScene` renders the normal victory screen.
- **AC-10**: Given a save slot whose stored `GameState` satisfies `isDoomsdayExpired`, when the player taps that slot on `TitleScene`, then neither `WorldMapScene` nor `BaseScene` is started, and the locked-slot message is shown instead.
- **AC-11**: Given a `GameState` with `doomsdayDaysRemaining: 3` and `ngPlusCycle: 0`, when `startNewGamePlus()` is called, then the returned state has `doomsdayDaysRemaining === 32`.
- **AC-12**: Given a `GameState` with `doomsdayDaysRemaining` values of `20`, `10`, and `4` respectively, when `WorldMapScene`/`BaseScene` render the countdown, then the text color is `'#4ade80'`, `'#fbbf24'`, and `'#ef4444'` respectively.
- **AC-13 (regression)**: All existing unit tests continue to pass unmodified, since every change here is additive (`doomsdayDaysRemaining` is optional, `processVictory`'s parameter list is unchanged).
