# 傭兵評鑑系統 (Mercenary Performance Rating)

## Goal

After every battle, score the squad's performance (survival, weakness exploitation, round efficiency) into a 1–3 star rating shown on `ResultScene`, and use that rating to scale EXP/currency rewards by up to +20%.

## Background — this is a wiring task, not new logic

`src/ui/starRating.ts` already contains `calculateStarRating(victory, playerKOs, turnsUsed)` plus a fully-passing test file (`tests/unit/resultUI.starRating.test.ts`, documented as `AC-10`), but grep confirms **zero callers** in `src/` — it was scaffolded during a prior UI-design pass and never wired into `BattleScene`/`ResultScene`/`VictoryProcessor`. No code anywhere currently tracks rounds-used, player-KO-count, or weakness-hit-count during a battle.

This spec:
1. Adds a `battleStats` accumulator to `BattleScene` (rounds used, player KO count, weakness-hit count).
2. Extends `calculateStarRating` with a 4th parameter for weakness exploitation.
3. Wires the computed rating into `processVictory`'s existing reward-multiplier pattern.
4. Renders the stars in `ResultScene`.

### Mapping the backlog's three dimensions onto the existing scaffold

The backlog asks for 傷害輸出 (damage output), 存活率 (survival rate), 弱點利用 (weakness exploitation). Rather than adding a new raw damage-sum tracker (which the existing scaffold never had and which would double-count with round efficiency — dealing more damage per round *is* what lets you win in fewer rounds), this spec keeps the existing `turnsUsed`-based tier (renamed `roundsUsed`) as the proxy for 傷害輸出 efficiency, and adds `weaknessHitCount` as the new, independent 弱點利用 dimension. 存活率 stays as the existing `playerKOs > 0` gate. This is a two-line extension of tested code instead of a new subsystem.

## Rules

**Star tiers** (`calculateStarRating`, updated signature: `(victory, playerKOs, roundsUsed, weaknessHitCount)`):
- 0★ — defeat.
- 1★ — victory, `playerKOs > 0`.
- 2★ — victory, `playerKOs === 0`, and (`roundsUsed > 5` OR `weaknessHitCount === 0`).
- 3★ — victory, `playerKOs === 0`, `roundsUsed <= 5`, AND `weaknessHitCount >= 1`.

**Tracked stats** (new `BattleScene` field `battleStats: BattlePerformanceStats`, reset per battle in `init()`):
- `roundsUsed` — incremented once per round start, in both manual and auto-battle modes.
- `playerKOCount` — incremented once per player-party character that reaches 0 HP (enemy deaths never count).
- `weaknessHitCount` — incremented once per player-inflicted hit where `dmgResult.isWeaknessHit` is true (enemy attacks are never player-inflicted, so this only fires on `executePlayerCommand`'s damage path).

**Reward scaling** (`processVictory`, new optional 6th param `starRating = 1`):
- `starMultiplier = 1 + (clamp(starRating, 1, 3) - 1) * 0.1` → 1★=1.0x, 2★=1.1x, 3★=1.2x.
- Stacks multiplicatively with the existing NG+ `rewardMultiplier` (line 13): `totalMultiplier = rewardMultiplier * starMultiplier`, applied to both `scaledExpGained` and `scaledCurrencyReward`.
- Default `starRating = 1` (no bonus/penalty) means every existing `processVictory(...)` call in `tests/unit/ResultLogic.test.ts`, `VictoryProcessor.itemRewards.test.ts`, `VictoryProcessor.recruit.test.ts`, `VictoryProcessor.ngPlus.test.ts` continues to compile and pass unchanged — no test in those files needs editing.

**UI**: `ResultScene` renders stars only on victory (0★ defeat = no stars shown, matching the existing `AC-10` test comment), each star fading in with a `STAR_ANIMATION_DELAY_MS` (200ms) stagger.

## Data model changes

`src/types.ts` — add near `ResultSceneData` (line 166):

```ts
export interface BattlePerformanceStats {
  playerKOCount: number;
  weaknessHitCount: number;
  roundsUsed: number;
}
```

`ResultSceneData` (line 166-175) gains one optional field:

```ts
export interface ResultSceneData {
  victory: boolean;
  playerParty: Character[];
  stageIndex: number;
  expGained: number;
  expPool?: number;
  recruitedEnemy?: Character;
  gameState?: GameState;
  isChallengeRun?: boolean;
  battleStats?: BattlePerformanceStats; // NEW — undefined only in hand-built test fixtures that don't go through BattleScene
}
```

`src/ui/starRating.ts` — replace the whole file:

```ts
export const STAR_ANIMATION_DELAY_MS = 200;

export function calculateStarRating(
  victory: boolean,
  playerKOs: number,
  roundsUsed: number,
  weaknessHitCount: number,
): number {
  if (!victory) return 0;
  if (playerKOs > 0) return 1;
  if (roundsUsed > 5 || weaknessHitCount === 0) return 2;
  return 3;
}
```

`src/battle/VictoryProcessor.ts` — signature change (line 6-12), only touching the two multiplier lines (13-15):

```ts
export function processVictory(
  gameState: GameState,
  stage: Stage,
  expGained: number,
  recruitedEnemy: Character | undefined,
  ngPlusCycle = 0,
  starRating = 1,
): GameState {
  const rewardMultiplier = 1 + ngPlusCycle * 0.2;
  const starMultiplier = 1 + (Math.max(1, Math.min(3, starRating)) - 1) * 0.1;
  const totalMultiplier = rewardMultiplier * starMultiplier;
  const scaledExpGained = Math.round(expGained * totalMultiplier);
  const scaledCurrencyReward = Math.round(stage.currencyReward * totalMultiplier);
  // ...rest of function body unchanged
```

## BattleScene.ts changes (exact hook points)

1. **New field** (alongside `private aoaState` at line 88): `private battleStats: BattlePerformanceStats = { playerKOCount: 0, weaknessHitCount: 0, roundsUsed: 0 };`
2. **`init()`** (in the reset block, line 142-145, alongside `this.recruitedEnemy = undefined;`): add `this.battleStats = { playerKOCount: 0, weaknessHitCount: 0, roundsUsed: 0 };`
3. **`startCommandPhase()`** (line 312, first line of the method body): add `this.battleStats.roundsUsed++;`. This method runs at the start of every round in manual mode and every round-transition in auto mode (line 604, 609), plus the very first round via `create()`/pre-battle-dialog callback (lines 207-209) — covering all round starts except one case below.
4. **`executeNextInQueue`**, auto-continue branch (line 606, currently `this.runAutoRound();`): change to:
   ```ts
   this.battleStats.roundsUsed++;
   this.runAutoRound();
   ```
   This is the one round-start path that does *not* go through `startCommandPhase()` — when auto-mode continues into the next round without the player toggling anything. Do **not** add an increment to the `runAutoRound()` call inside `enterAutoMode()` (line 1060) — that call resumes the *current* round (already counted by the `startCommandPhase()` that ran before the player clicked auto), not a new one.
5. **`executePlayerCommand`** (line 679-680, right after `dmgResult` is computed, before the existing `recordHitDiscovery` call): add
   ```ts
   if (dmgResult.isWeaknessHit) this.battleStats.weaknessHitCount++;
   ```
6. **`applyDamageAndAdvance`** (line 955-957), change:
   ```ts
   target.stats.hp = Math.max(0, target.stats.hp - dmg);
   const died = target.stats.hp === 0;
   if (died && target.isPlayer) this.battleStats.playerKOCount++;
   if (died) target.alive = false;
   ```
   (The other two `alive = false` sites — line 732 recruit-success and line 912 All-Out-Attack — only ever set `enemy.alive = false` on enemy characters, so they must NOT touch `playerKOCount`.)
7. **`checkBattleEnd()`** (line 1038-1046), add `battleStats: this.battleStats,` to the `ResultScene` transition payload object.

## UI changes — ResultScene.ts

1. Import: `import { calculateStarRating, STAR_ANIMATION_DELAY_MS } from '../ui/starRating';`
2. Destructure `battleStats` at line 14: `const { victory, playerParty, stageIndex, expGained, expPool = 0, recruitedEnemy, gameState, battleStats } = data;`
3. Compute the rating before the existing `if (victory)` reward block (around line 31), with a safe fallback for hand-built test fixtures that omit `battleStats`:
   ```ts
   const starRating = battleStats
     ? calculateStarRating(victory, battleStats.playerKOCount, battleStats.roundsUsed, battleStats.weaknessHitCount)
     : (victory ? 1 : 0);
   ```
4. Change the `processVictory` call (line 35) to pass the rating through as the 6th positional arg, explicitly passing `undefined` for `ngPlusCycle` to preserve its current (already-not-wired) default behavior — this spec does not touch the pre-existing NG+ multiplier wiring, which is out of scope:
   ```ts
   updatedGameState = processVictory(gameState, stage, expGained, recruitedEnemy, undefined, starRating);
   ```
5. Render stars only when `victory`, between the title (line 22-24) and stage name (line 27-29), e.g. at `y = 190`:
   ```ts
   if (victory && starRating > 0) {
     for (let i = 0; i < 3; i++) {
       const filled = i < starRating;
       const star = this.add.text(W / 2 - 30 + i * 30, 190, filled ? '★' : '☆', {
         fontSize: '22px', color: filled ? '#fbbf24' : '#4b5563', fontFamily: 'monospace',
       }).setOrigin(0.5).setAlpha(0);
       this.time.delayedCall(STAR_ANIMATION_DELAY_MS * i, () => {
         if (!this.scene.isActive()) return;
         star.setAlpha(1);
       });
     }
   }
   ```
   The `scene.isActive()` guard is required here (and only here — this is the only new `delayedCall` added by this spec) because the player can press "整備"/"重試" and transition away from `ResultScene` before the 400ms of staggered star animation finishes.

## Test plan

Update `tests/unit/resultUI.starRating.test.ts` (rename its doc comment to describe the new rule; every existing call site gains a 4th arg):
- `calculateStarRating(false, 0, 3, 0)` → 0.
- `calculateStarRating(true, 1, 3, 1)` → 1 (KO gate overrides everything else).
- `calculateStarRating(true, 0, 6, 1)` → 2 (rounds > 5 caps at 2 even with a weakness hit).
- `calculateStarRating(true, 0, 3, 0)` → 2 (**new case**: fast + no KOs but zero weakness hits caps at 2).
- `calculateStarRating(true, 0, 5, 1)` → 3 (exactly 5 rounds, boundary — inclusive).
- `calculateStarRating(true, 0, 2, 1)` → 3.
- `calculateStarRating(true, 99, 99, 0)` → 1 (KO gate wins regardless of other stats).

New `tests/unit/VictoryProcessor.starRating.test.ts`:
- `processVictory(state, stage, 100, undefined, 0, 1)` → `currency === state.currency + stage.currencyReward` (1★ = no bonus).
- `processVictory(state, stage, 100, undefined, 0, 2)` → currency/EXP scaled by exactly 1.1x (`Math.round`).
- `processVictory(state, stage, 100, undefined, 0, 3)` → currency/EXP scaled by exactly 1.2x.
- `processVictory(state, stage, 100, undefined, 1, 3)` → both multipliers stack: `1.2 * 1.2 = 1.44x` (NG+ cycle 1 = 1.2x, times 3★ = 1.2x).
- Calling `processVictory` with only 4 args (no `starRating`) still applies exactly a 1.0x star multiplier — regression guard that the existing test files' call sites remain unaffected.

New `tests/unit/BattleScene.mercenaryRating.test.ts` (source-text assertions, following this repo's existing precedent for BattleScene wiring tests since a real `Phaser.Scene` cannot be instantiated under vitest):
- Assert `startCommandPhase` body contains `this.battleStats.roundsUsed++`.
- Assert the auto-continue branch (`runAutoRound()` inside the `queue.length === 0` block) is preceded by `this.battleStats.roundsUsed++`.
- Assert `applyDamageAndAdvance` increments `playerKOCount` guarded by `target.isPlayer`.
- Assert `executePlayerCommand` increments `weaknessHitCount` guarded by `dmgResult.isWeaknessHit`.
- Assert `checkBattleEnd`'s `ResultScene` payload includes `battleStats: this.battleStats`.

Run the full existing suite (`npm test` in `workspace-pixel-squad/`) — no other test files should need changes, since every touched function's new parameter has a default that reproduces prior behavior.

## Acceptance criteria

- **AC-1**: Given a victory with 0 player KOs, 0 weakness hits, and 3 rounds used, when `calculateStarRating` is called, then it returns 2 (not 3 — weakness gate blocks the top tier).
- **AC-2**: Given a victory with 0 player KOs, ≥1 weakness hit, and ≤5 rounds used, when `calculateStarRating` is called, then it returns 3.
- **AC-3**: Given a victory with 0 player KOs, ≥1 weakness hit, but 6 rounds used, when `calculateStarRating` is called, then it returns 2 (rounds gate still applies independently of the weakness gate).
- **AC-4**: Given a victory with ≥1 player KO, when `calculateStarRating` is called with any rounds/weakness values, then it returns 1.
- **AC-5**: Given a defeat, when `ResultScene` renders, then no star text objects are created and `calculateStarRating` returns 0.
- **AC-6**: Given a 3★ result, when `processVictory` runs, then both `currency` and `expPool` gains are exactly 1.2x the base `stage.currencyReward`/`expGained` (rounded), compared to a 1★ result on the same stage with the same `ngPlusCycle`.
- **AC-7**: Given `BattleScene` runs 4 full rounds in manual mode then wins, when the battle ends, then `battleStats.roundsUsed === 4` (not more, not fewer).
- **AC-8**: Given `BattleScene` starts in manual mode, plays round 1 command phase, then the player clicks "auto" mid-round-1 (before submitting commands) and 3 more rounds complete automatically, when the battle ends, then `battleStats.roundsUsed === 4` (the round entered via `enterAutoMode()` counts once, not twice).
- **AC-9**: Given an enemy character dies (from a player attack or an All-Out Attack), when `battleStats` is inspected, then `playerKOCount` is unchanged (only player-party deaths count).
- **AC-10**: Given a player attacks an enemy's weakness element twice in one battle, when `battleStats` is inspected after the battle, then `weaknessHitCount === 2`.
- **AC-11**: Given the existing test suites `ResultLogic.test.ts`, `VictoryProcessor.itemRewards.test.ts`, `VictoryProcessor.recruit.test.ts`, and `VictoryProcessor.ngPlus.test.ts`, when run after this change, then all pass unmodified (default `starRating = 1` reproduces prior reward math exactly).
