# Math Merge 10 Adventure Mode — Plan 3a of 3: Run Flow, Relics, Save/Load, Unlocks (pure logic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land everything pure that adventure mode still needs after plan #2 (spec `docs/specs/math-merge-10/adventure-mode.md` §6, §6.1, §7, §8, §9.3, §10, §11 P1 items 4-6): (0) the Plan 2 code-review fixes in `battle.ts`, (1) `relics.ts` with the 12 relics and the hook composer, (2) `unlocks.ts` with the six adventure trophies and the trophy-to-relic unlocks, (3) `run.ts` with the 9-battle run flow, rewards and HP carry-over, (4) `save.ts` with versioned, validated save/load under `mathMerge10AdventureRun`, (5) a seeded whole-run simulation. No DOM, no Canvas, no `index.html`, no `game.ts` change; endless mode is untouched. Plan 3b (`2026-10-08-merge10-adventure-p3b-ui.md`) builds the renderer fixes, the adventure screen, the start menu, e2e and the iOS sync on top of these names.

**Architecture:** Pure functions with an injected `Rng` and an injected `KeyValueStore` (a three-method slice of `Storage`), exactly like plans #1-#2. `RunState` is plain JSON: the current `BattleState` plus run-level data (HP between battles, owned relics, spell upgrades, the relic pool, pending offers). `runTurn` / `runCast` / `chooseOffer` wrap `applyTurn` / `castSpell` / `createBattle` from plan #2, feeding them `mergeRelicHooks(run.relics)`; they return a `RunStep` (new run, the battle events for the view, and the trophy events the caller feeds to `checkAdventureTrophies`). The view in plan #3b owns all I/O.

**Tech Stack:** Vanilla TypeScript, vitest (`tests/unit/**/*.test.ts`; the `tests/unit/adventure/` folder is already covered, no config change).

**Plan series:** #1 foundation (done) -> #2 battle rules (done, HEAD `0288303`) -> #3a run flow / relics / save / unlocks (this plan) -> #3b renderer, UI, menu, e2e, iOS.

---

## Global Constraints

- Work from `/Users/kyo.lai82/Projects/Personal/game-factory`; source code lives in `workspace/`. Run npm/npx commands from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`; run git commands from `/Users/kyo.lai82/Projects/Personal/game-factory`.
- Existing files touched by this plan: `src/adventure/battle.ts` (Task 0, ten small `Edit` blocks) and exactly one Plan 2 test (`tests/unit/adventure/battleOverload.test.ts`, one assertion, Task 0 Step 0.5, because the reviewed behaviour intentionally changes). Everything else is a new file. No edit to `grid.ts`, `powerups.ts`, `game.ts`, `index.html`, `boardRenderer.ts` or any other existing test; nothing outside `src/adventure/` imports from it yet.
- Every function is pure: inputs are never mutated, randomness is an injected `Rng` (`() => number`), no `Math.random`, no `Date` (the one `Date.now()` is a default parameter of `checkAdventureTrophies`), no module-level mutable state. Storage is injected (`KeyValueStore`), never the global `localStorage`.
- Out of scope (plan #3b): renderer, view, menu, `index.html`, e2e, iOS sync, `?seed=`.
- Verify commands:
  - unit: `npm run test:unit` (vitest)
  - types: `npx tsc --noEmit` (only `src/**` is type-checked; test files are transpiled by vitest only)
  - build: `npm run build`
- Baseline (HEAD `0288303`, after plan #2): **27 unit test files, 389 unit tests passing**; `tsc --noEmit` clean; 54 e2e tests (untouched by this plan, no e2e run is needed here).
- Expected unit-test count after each task: Task 0 -> 404 (28 files), Task 1 -> 426 (29), Task 2 -> 435 (30), Task 3 -> 462 (31), Task 4 -> 511 (32), Task 5 -> 514 (33 files).
- Task order: review fixes first (they change `BattleState`, which every later task builds on), then leaf data (relics, unlocks), then the run flow, then save/load, then the whole-run simulation.
- Commit trailer for every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The working tree may have unrelated changes and untracked `verify*.png` files; always `git add` explicit paths, never `git add -A`.
- Use `Edit` find/replace blocks exactly as written; each "find" string occurs exactly once in the file at that point.

---

## Decisions made

The spec is silent or ambiguous on these; the simplest option consistent with the spec was taken. Each is pinned by a test.

| # | Decision | Rationale |
|---|---|---|
| E1 | **Plan 2 review fix: overload fires when no affordable spell can act.** New exported `hasPlayableSpell(state, hooks)`: hammer/bomb need any occupied cell, addOne needs a numeric (non-stone) cell, shuffle needs two unfrozen occupied cells with different contents, and the spell must be affordable under upgrades and the `spellCost` hook. `shouldOverload` = ongoing AND no legal slide AND NOT `hasPlayableSpell`. `minSpellCost` stays exported (no longer used by the check). | Fixes the review's MEDIUM soft lock (addOne upgraded to cost 1, all-stone board, mana 1). |
| E2 | **Overload clears at least one cell** (`max(1, floor(occupied / 2))`, still ignoring freezes) when anything is occupied, and `overload.hpLost` / `manaChanged.delta` report the amounts that really changed (HP capped by current HP, mana clamped at 0, no event for a no-op). The Plan 2 test that expected a lone frozen tile to survive an overload now expects it to be cleared. | Review LOW findings 3 and 4; a lone frozen tile can no longer drain 2 HP per swipe. |
| E3 | **A spell that leaves the board empty spawns one tile, no penalty.** With the new `hasPlayableSpell`, an empty board has no playable spell, so without this a bomb on the last tile would cost 2 HP. | Direct consequence of E1; empty-board overload on an invalid swipe is unchanged (Plan 2 test). |
| E4 | `NO_UPGRADES` is frozen and `createBattle` copies it. `BattleState.relicData: Record<string, number>` (per-battle relic scratch space, reset by `createBattle`) plus `HookEffect.relicData` (shallow merge). `resolveHooks` ignores an explicit `undefined` / non-function instead of crashing. | Review LOW 2 and point 5. `relicData` is exercised by 森林之心 so it is not dead code. |
| E5 | **Hook composition rules** (`mergeRelicHooks`): chain multiplier = highest of 1.5 and every relic's (ring 2 and eye 2.5 do not multiply); spawn strategy = field-wise maximum of the default bias and every relic's (補數護符 `{4, 0.5, base 0.3}`); spell cost = base + sum of every relic's delta, floored at 0; event hooks sum `mana` / `heroHp` / `enemyDamage`, OR `cancelHpLoss`, merge `relicData`. All 12 relics fit the existing hooks plus `relicData`; no further hook was needed. | Resolves plan #2 risk 3 and the review's "check each relic fits the hooks". |
| E6 | **The 12 relics.** Starters (spec 7): 魔力水晶, 連鎖之戒, 生命之杖, 暴走之心, 補數護符, 石匠手套. Trophy relics: 森林之心 (first elimination of a battle heals 1, uses `relicData`), 冰晶棱鏡 (+2 damage per pair), 虛無之眼 (chain x2.5), 暴走導管 (overload gives +3 mana), 鑲嵌鎚 (hammer and addOne cost 1 less), 熔岩核心 (each stone broken gives +1 mana). | Spec 7 leaves the six unlockables to this plan. Each is small, distinct, and expressible with hooks. |
| E7 | **The 6 adventure trophies**, one per unlockable relic: 森林征服者 (beat 三角樹王 -> 森林之心), 冰窟征服者 (beat 六角冰后 -> 冰晶棱鏡), 歸零者 (first clear -> 虛無之眼), 暴走大師 (3 overloads in one battle and win -> 暴走導管), 連鎖法師 (a slide clearing >= 3 pairs in a battle you win -> 鑲嵌鎚), 碎石工 (6 stones broken in one battle you win -> 熔岩核心). | Spec 8 names the first three styles; the other three fill the six slots. |
| E8 | **Adventure trophies live in `src/adventure/unlocks.ts` with their own storage key `mathMerge10AdventureTrophies`**, not in `trophies.ts`. | `trophies.test.ts` (existing, must not be edited) pins `loadTrophyStatuses()` to exactly 67 entries; spec 9.2's "new group in trophies.ts" would break it. The endless 🏆 modal stays as is; adventure trophies get their own list in plan #3b. |
| E9 | **The relic pool is fixed at run start** (`RunState.pool` = 6 starters + one relic per trophy unlocked then). A trophy earned mid-run adds its relic from the next run. | Keeps offers deterministic and `RunState` self-contained; plan #3b's toast says "下一局起". |
| E10 | **Opening relic:** every run starts with a pick of 1 of 3 distinct relics from the pool (`relicPick` phase), then battle 0. | Spec 7 speaks of a 開局抽選池. |
| E11 | **Rewards.** Normal win: up to three offers, one random unowned relic, one random not-yet-upgraded spell (upgrade = the cost reduction from plan #2 D9) and always "回 3 血". Boss win: first heal `floor(maxHp / 2)`, then three different unowned relics (fewer if fewer remain; none left -> the normal offers). Beating the zero lord ends the run, no offers. Max HP never changes. | Spec 6. |
| E12 | **Save format.** `{ version: 1, run }` as JSON under `mathMerge10AdventureRun`, written after every step; `validateRun` checks every field (types, ranges, known ids, grid shape and cell values, freezes on occupied non-stone cells, enemy id equals `BATTLE_ORDER[battleIndex]`, battle status consistent with the phase, offers present exactly in the two choice phases). An invalid save is deleted and reads as "no save"; loading never throws. A finished run (victory/defeat) deletes the save instead of writing it. Storage errors are swallowed. | Spec 6.1; plan #2 risk 5. |
| E13 | **Trophy counters** are computed in the run layer from battle events (`stonesBroken`, `maxChain` = most pairs cleared by one slide) plus `BattleState.overloads`, and handed to the caller as `AdventureTrophyEvent`s; `run.ts` never touches storage. | Keeps the run layer pure. |
| E14 | **Tuning is untouched.** A greedy bot (`runSimulation.test.ts`'s policy: best-pairs swipe, hammer when stuck, always offer 0) reached the end of the run in 9 of 30 seeds, died at the tree king (battle 3) in most others and averaged ~146 turns per run. Numbers stay as plan #2 left them; the P2 balance pass owns them. | Spec 11 puts balancing in P2. |

## Open questions for the user

None. (Relic and trophy numbers in E6/E7 are first-draft values in the spirit of spec 7, isolated in `relics.ts` / `unlocks.ts`.)

---

### Task 0: Plan 2 review fixes in `battle.ts`

**Files:**
- Create: `workspace/tests/unit/adventure/battleReview.test.ts`
- Modify: `workspace/src/adventure/battle.ts` (10 edits)
- Modify: `workspace/tests/unit/adventure/battleOverload.test.ts` (1 assertion)

**Interfaces:**

Consumes: plan #2's `battle.ts` as committed at `0288303`.

Produces (additions to `src/adventure/battle.ts`):
```ts
export function hasPlayableSpell(state: BattleState, hooks?: BattleHooksInput): boolean;
// BattleState gains:            relicData: Record<string, number>;   // {} at createBattle
// HookEffect gains:             relicData?: Record<string, number>;  // shallow-merged into state.relicData
// NO_UPGRADES is now frozen; createBattle stores a copy.
// shouldOverload(state, hooks) now means: ongoing && !canMove && !hasPlayableSpell(state, hooks)
// overload clears max(1, floor(occupied/2)) cells; overload.hpLost and manaChanged.delta are the real amounts.
// castSpell: a spell that empties the board spawns one tile (no overload penalty).
```

- [ ] **Step 0.1: Write the failing test**

Create `workspace/tests/unit/adventure/battleReview.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE, createEmptyGrid, type GameGrid } from "../../../src/grid";
import {
  NO_UPGRADES,
  applyTurn,
  castSpell,
  createBattle,
  hasPlayableSpell,
  shouldOverload,
  type BattleEvent,
} from "../../../src/adventure/battle";
import { gridWith, makeState, scripted } from "./battleHelpers";

const allStones: GameGrid = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => STONE));

describe("plan 2 review fix 1: the overload net fires when no affordable spell can act", () => {
  it("all stones, mana 1, only addOne upgraded (cost 1): addOne refuses stones, so the net fires", () => {
    const state = makeState(allStones, {
      mana: 1,
      upgrades: { hammer: false, addOne: true, bomb: false, shuffle: false },
    });
    expect(hasPlayableSpell(state)).toBe(false);
    expect(shouldOverload(state)).toBe(true);
  });

  it("the same board with enough mana for the hammer is not an overload", () => {
    const state = makeState(allStones, { mana: 2 });
    expect(hasPlayableSpell(state)).toBe(true);
    expect(shouldOverload(state)).toBe(false);
  });

  it("a numeric cell makes a cheap addOne playable again", () => {
    const grid = allStones.map((row) => [...row]);
    grid[2][2] = 5;
    const state = makeState(grid, {
      mana: 1,
      upgrades: { hammer: false, addOne: true, bomb: false, shuffle: false },
    });
    expect(hasPlayableSpell(state)).toBe(true);
  });

  it("an empty board has no playable spell", () => {
    expect(hasPlayableSpell(makeState(createEmptyGrid(4), { mana: 9 }))).toBe(false);
  });

  it("shuffle counts only with two unfrozen cells of different content", () => {
    const onlyShuffle = { spellCost: (_s: unknown, spell: string, base: number) => (spell === "shuffle" ? base : 99) };
    const twoSame = makeState(gridWith([[STONE, STONE]]), { mana: 9 });
    const twoDifferent = makeState(gridWith([[STONE, 5]]), { mana: 9 });
    const differentButFrozen = makeState(gridWith([[STONE, 5]]), { mana: 9, freezes: [{ row: 0, col: 1, turns: 2 }] });
    expect(hasPlayableSpell(twoSame, onlyShuffle)).toBe(false);
    expect(hasPlayableSpell(twoDifferent, onlyShuffle)).toBe(true);
    expect(hasPlayableSpell(differentButFrozen, onlyShuffle)).toBe(false);
  });

  it("respects the spellCost hook: a relic that raises every cost makes the net fire", () => {
    const state = makeState(allStones, { mana: 3 });
    const pricey = { spellCost: (_s: unknown, _spell: string, base: number) => base + 5 };
    expect(shouldOverload(state)).toBe(false);
    expect(shouldOverload(state, pricey)).toBe(true);
  });

  it("applyTurn resolves a stuck stone board through the swipe safety net", () => {
    const state = makeState(allStones, {
      mana: 1,
      upgrades: { hammer: false, addOne: true, bomb: false, shuffle: false },
    });
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.overloads).toBe(1);
    expect(next.heroHp).toBe(8);
    expect(events.some((e) => e.type === "overload")).toBe(true);
  });
});

describe("plan 2 review fix 2: NO_UPGRADES is never shared", () => {
  it("the constant is frozen and each battle owns a copy", () => {
    expect(Object.isFrozen(NO_UPGRADES)).toBe(true);
    const { state } = createBattle({ enemyId: "slime", heroHp: 10, heroMaxHp: 10 }, () => 0);
    expect(state.upgrades).toEqual(NO_UPGRADES);
    expect(state.upgrades).not.toBe(NO_UPGRADES);
  });
});

describe("plan 2 review fix 3: an overload always clears at least one cell", () => {
  it("a lone frozen tile is cleared (and its freeze with it)", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { events } = applyTurn(state, "up", () => 0);
    const overload = events.find((e) => e.type === "overload") as Extract<BattleEvent, { type: "overload" }>;
    expect(overload.cleared).toHaveLength(1);
    expect(events).toContainEqual({ type: "thawed", cells: [{ row: 0, col: 0 }], cause: "cleared" });
  });
});

describe("plan 2 review fix 4: events report the amounts that really changed", () => {
  it("manaChanged.delta is the clamped change, and a no-op change emits nothing", () => {
    const state = makeState(gridWith([[4, 6]]));
    const { events } = applyTurn(state, "left", () => 0, { onPairCleared: () => ({ mana: -5 }) });
    const mana = events.filter((e) => e.type === "manaChanged");
    expect(mana).toEqual([
      { type: "manaChanged", delta: 1, mana: 1 },
      { type: "manaChanged", delta: -1, mana: 0 },
    ]);
    const { events: startEvents } = createBattle(
      { enemyId: "slime", heroHp: 10, heroMaxHp: 10 },
      () => 0,
      { onBattleStart: () => ({ mana: -3 }) },
    );
    expect(startEvents.some((e) => e.type === "manaChanged")).toBe(false);
  });

  it("overload.hpLost is capped by the HP the hero had", () => {
    const state = makeState(gridWith([[5]]), { heroHp: 1, freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next, events } = applyTurn(state, "up", () => 0);
    expect(events).toContainEqual({ type: "overload", hpLost: 1, cleared: [{ row: 0, col: 0 }] });
    expect(next.heroHp).toBe(0);
    expect(next.status).toBe("defeat");
  });
});

describe("plan 2 review fix 5: relic plumbing", () => {
  it("a new battle starts with empty relicData", () => {
    const { state } = createBattle({ enemyId: "slime", heroHp: 10, heroMaxHp: 10 }, () => 0);
    expect(state.relicData).toEqual({});
  });

  it("a hook effect can write relicData, and later writes win", () => {
    const { state } = createBattle(
      { enemyId: "slime", heroHp: 10, heroMaxHp: 10 },
      () => 0,
      { onBattleStart: () => ({ relicData: { a: 1, b: 2 } }) },
    );
    expect(state.relicData).toEqual({ a: 1, b: 2 });
    const next = applyTurn(
      { ...makeState(gridWith([[4, 6]])), relicData: state.relicData },
      "left",
      () => 0,
      { onPairCleared: () => ({ relicData: { b: 5 } }) },
    );
    expect(next.state.relicData).toEqual({ a: 1, b: 5 });
  });

  it("an explicit undefined hook falls back to the default instead of crashing", () => {
    const state = makeState(gridWith([[4, 6, 4, 6]]));
    const hooks = { chainMultiplier: undefined, onPairCleared: undefined, spellCost: undefined };
    const result = applyTurn(state, "left", () => 0, hooks);
    expect(result.events.find((e) => e.type === "pairCleared")).toMatchObject({ damagePerPair: 15 });
  });
});

describe("review follow-up: a spell that empties the board is not punished", () => {
  it("bombing the last tile refills one tile and costs no HP", () => {
    const state = makeState(gridWith([[5]]), { mana: 4 });
    const result = castSpell(state, "bomb", { row: 0, col: 0 }, scripted(0, 0));
    expect(result.applied).toBe(true);
    expect(result.state.heroHp).toBe(10);
    expect(result.state.overloads).toBe(0);
    expect(result.state.grid.flat().filter((c) => c !== null)).toHaveLength(1);
    expect(result.events.some((e) => e.type === "tileSpawned")).toBe(true);
  });
});
```

- [ ] **Step 0.2: Run and see it fail**

```bash
npx vitest run tests/unit/adventure/battleReview.test.ts
```

Expected: `Tests  14 failed | 1 passed (15)` (`hasPlayableSpell` is not exported yet, `relicData` does not exist, the overload still clears `floor(1/2) = 0` cells, and so on; the one test that already holds is "respects the spellCost hook: a relic that raises every cost makes the net fire").

- [ ] **Step 0.3: Apply the ten `battle.ts` edits**

In `workspace/src/adventure/battle.ts`, apply these in order.

1. `NO_UPGRADES` frozen:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
export const NO_UPGRADES: SpellUpgrades = { hammer: false, addOne: false, bomb: false, shuffle: false };
```
Replace with:
```ts
export const NO_UPGRADES: SpellUpgrades = Object.freeze({ hammer: false, addOne: false, bomb: false, shuffle: false });
```

2. `relicData` on the state:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
  overloads: number;
  status: BattleStatus;
}
```
Replace with:
```ts
  overloads: number;
  /**
   * Per-battle scratch numbers for relics (e.g. "already triggered" flags),
   * written through `HookEffect.relicData`. Reset by `createBattle`.
   */
  relicData: Record<string, number>;
  status: BattleStatus;
}
```

3. `relicData` on `HookEffect`:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
  enemyDamage?: number;
}

export interface OverloadResponse
```
Replace with:
```ts
  enemyDamage?: number;
  /** Keys to set in `state.relicData` (shallow merge; later writes win). */
  relicData?: Record<string, number>;
}

export interface OverloadResponse
```

4. Robust `resolveHooks`:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
function resolveHooks(input: BattleHooksInput): BattleHooks {
  return { ...DEFAULT_HOOKS, ...input };
}
```
Replace with:
```ts
/** Fill every missing hook with its default; an explicit `undefined` (or a non-function) is ignored, never called. */
function resolveHooks(input: BattleHooksInput): BattleHooks {
  const merged: Record<string, unknown> = { ...DEFAULT_HOOKS };
  Object.entries(input).forEach(([key, hook]) => {
    if (typeof hook === "function" && key in DEFAULT_HOOKS) merged[key] = hook;
  });
  return merged as unknown as BattleHooks;
}
```

5. `changeMana` reports the real delta:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
  if (delta === 0) return;
  const mana = Math.max(0, d.state.mana + delta);
  patch(d, { mana });
  d.events.push({ type: "manaChanged", delta, mana });
```
Replace with:
```ts
  if (delta === 0) return;
  const mana = Math.max(0, d.state.mana + delta);
  const actual = mana - d.state.mana; // report what really changed (mana never goes below 0)
  if (actual === 0) return;
  patch(d, { mana });
  d.events.push({ type: "manaChanged", delta: actual, mana });
```

6. `applyHookEffect` writes `relicData`:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
  if (!effect) return;
  if (effect.mana) changeMana(d, effect.mana);
```
Replace with:
```ts
  if (!effect) return;
  if (effect.relicData) patch(d, { relicData: { ...(d.state.relicData ?? {}), ...effect.relicData } });
  if (effect.mana) changeMana(d, effect.mana);
```

7. `hasPlayableSpell` and the new `shouldOverload`:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
/**
 * Layer-3 condition: the battle is on, no slide is legal (frozen tiles counted
 * as walls) AND mana cannot pay for the cheapest spell.
 */
export function shouldOverload(state: BattleState, hooks: BattleHooksInput = {}): boolean {
  return (
    state.status === "ongoing" &&
    !canMove(state.grid, freezeMask(state.grid.length, state.freezes)) &&
    state.mana < minSpellCost(state, hooks)
  );
}
```
Replace with:
```ts
/**
 * True when at least one spell is both affordable (upgrades and the
 * `spellCost` hook included) and has a legal effect on this board: hammer and
 * bomb need an occupied cell, addOne needs a numeric cell (not a stone), and
 * shuffle needs two unfrozen occupied cells holding different contents.
 * (Affordable-but-useless spells must not keep the layer-3 net from firing.)
 */
export function hasPlayableSpell(state: BattleState, hooks: BattleHooksInput = {}): boolean {
  const mask = freezeMask(state.grid.length, state.freezes);
  let occupied = 0;
  let numeric = 0;
  const shufflable = new Set<number>();
  state.grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell === null) return;
      occupied += 1;
      if (cell !== STONE) numeric += 1;
      if (!mask[r][c]) shufflable.add(cell);
    }),
  );
  return SPELL_IDS.some((spell) => {
    if (spellCost(state, spell, hooks) > state.mana) return false;
    if (spell === "addOne") return numeric > 0;
    if (spell === "shuffle") return shufflable.size >= 2;
    return occupied > 0;
  });
}

/**
 * Layer-3 condition: the battle is on, no slide is legal (frozen tiles counted
 * as walls) AND no affordable spell can do anything (see `hasPlayableSpell`).
 */
export function shouldOverload(state: BattleState, hooks: BattleHooksInput = {}): boolean {
  return (
    state.status === "ongoing" &&
    !canMove(state.grid, freezeMask(state.grid.length, state.freezes)) &&
    !hasPlayableSpell(state, hooks)
  );
}
```

8. Overload clears at least one cell and reports the real HP loss:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
  const cleared = pickDistinct(occupied, Math.floor(occupied.length / 2), rng);
  const hpLost = response && response.cancelHpLoss ? 0 : OVERLOAD_HP_LOSS;
```
Replace with:
```ts
  // floor(occupied / 2), but at least one cell so a lone tile cannot keep the board stuck.
  const clearCount = occupied.length === 0 ? 0 : Math.max(1, Math.floor(occupied.length / 2));
  const cleared = pickDistinct(occupied, clearCount, rng);
  const hpLost = response && response.cancelHpLoss ? 0 : Math.min(OVERLOAD_HP_LOSS, d.state.heroHp);
```

9. `createBattle` copies the upgrades and starts with empty `relicData`:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
    upgrades: setup.upgrades ?? NO_UPGRADES,
    turn: 0,
    overloads: 0,
```
Replace with:
```ts
    upgrades: { ...(setup.upgrades ?? NO_UPGRADES) },
    turn: 0,
    overloads: 0,
    relicData: {},
```

10. A spell that wipes the board refills one tile:

Edit `workspace/src/adventure/battle.ts`. Find (must occur exactly once):
```ts
  if (pairCleared) resolvePairs(d, 1, "addOne");

  if (!settle(d) && shouldOverload(d.state, d.hooks)) runOverload(d, rng, true);
```
Replace with:
```ts
  if (pairCleared) resolvePairs(d, 1, "addOne");

  // A spell that wipes the board must not be punished by an overload: refill with one tile.
  if (!settle(d) && d.state.grid.every((row) => row.every((cell) => cell === null))) spawnTile(d, rng);
  if (!settle(d) && shouldOverload(d.state, d.hooks)) runOverload(d, rng, true);
```

- [ ] **Step 0.4: Run the new test and the whole suite**

```bash
npx vitest run tests/unit/adventure/battleReview.test.ts
npx vitest run
```

Expected: the new file `Tests  15 passed (15)`; the full run shows exactly one failure, `battleOverload.test.ts > overload as a safety net on an invalid swipe > a stuck board with too little mana resolves the overload when the player swipes` (`expected [] to deeply equal [ { row: 0, col: 0, turns: 2 } ]`). That is the intended behaviour change (E2): the overload now clears the lone frozen tile.

- [ ] **Step 0.5: Update that one Plan 2 assertion**

In `workspace/tests/unit/adventure/battleOverload.test.ts`:

Edit `workspace/tests/unit/adventure/battleOverload.test.ts`. Find (must occur exactly once):
```ts
    expect(next.freezes).toEqual([{ row: 0, col: 0, turns: 2 }]);
    expect(events.some((e) => e.type === "overload")).toBe(true);
```
Replace with:
```ts
    expect(next.freezes).toEqual([]); // the overload now clears at least one cell, so the lone frozen tile goes
    expect(events.some((e) => e.type === "overload")).toBe(true);
```

- [ ] **Step 0.6: Types and the full unit suite**

```bash
npx tsc --noEmit
npm run test:unit
```

Expected: `tsc` clean; `Test Files  28 passed (28)`, `Tests  404 passed (404)`.

- [ ] **Step 0.7: Commit**

```bash
git add workspace/src/adventure/battle.ts workspace/tests/unit/adventure/battleReview.test.ts workspace/tests/unit/adventure/battleOverload.test.ts
git commit -m "$(cat <<'EOT'
fix(merge10): plan 2 review fixes (playable-spell overload check, relicData, real deltas)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 1: The 12 relics and the hook composer in `src/adventure/relics.ts`

**Files:**
- Create: `workspace/src/adventure/relics.ts`
- Create: `workspace/tests/unit/adventure/relics.test.ts`

**Interfaces:**

Consumes: `battle.ts` (`DEFAULT_HOOKS`, `BASE_CHAIN_MULTIPLIER`, `BattleHooks`, `BattleHooksInput`, `BattleState`, `HookEffect`, `OverloadResponse`, `SpellId`), `grid.ts` (`COMPLEMENT_BIAS`, `SpawnStrategy`).

Produces (exported from `src/adventure/relics.ts`):
```ts
export interface RelicDef { id: string; name: string; icon: string; description: string; starter: boolean; hooks: BattleHooksInput }
export const RELICS: readonly RelicDef[];                 // 12
export const STARTER_RELIC_IDS: readonly string[];        // the 6 opening-pool relics, spec 7 order
export const UNLOCKABLE_RELIC_IDS: readonly string[];     // the 6 trophy relics
export function getRelic(id: string): RelicDef | undefined;
export function mergeRelicHooks(relicIds: readonly string[]): BattleHooks;   // rules in decision E5
```

- [ ] **Step 1.1: Write the failing test**

Create `workspace/tests/unit/adventure/relics.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import { applyTurn, castSpell, createBattle, spellCost, type BattleState } from "../../../src/adventure/battle";
import {
  RELICS,
  STARTER_RELIC_IDS,
  UNLOCKABLE_RELIC_IDS,
  getRelic,
  mergeRelicHooks,
} from "../../../src/adventure/relics";
import { gridWith, makeState, scripted } from "./battleHelpers";

const fresh = (changes: Partial<BattleState> = {}, enemyId = "treeKing") =>
  makeState(gridWith([[4, 6, 4, 6]]), changes, enemyId);

describe("relic roster (spec 7)", () => {
  it("has 12 relics with unique ids: 6 in the opening pool, 6 unlocked by trophies", () => {
    expect(RELICS).toHaveLength(12);
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(12);
    expect(STARTER_RELIC_IDS).toEqual([
      "manaCrystal", "chainRing", "lifeStaff", "surgeHeart", "complementCharm", "masonGloves",
    ]);
    expect(UNLOCKABLE_RELIC_IDS).toHaveLength(6);
  });

  it("every relic has a name, icon and description, and defines at least one hook", () => {
    RELICS.forEach((r) => {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.icon.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect(Object.keys(r.hooks).length).toBeGreaterThan(0);
    });
  });

  it("getRelic finds ids and returns undefined for unknown ones", () => {
    expect(getRelic("chainRing")?.name).toBe("連鎖之戒");
    expect(getRelic("nope")).toBeUndefined();
  });
});

describe("mergeRelicHooks: the composer", () => {
  it("no relics behaves like the defaults", () => {
    const hooks = mergeRelicHooks([]);
    expect(hooks.chainMultiplier(fresh())).toBe(1.5);
    expect(hooks.spellCost(fresh(), "bomb", 4)).toBe(4);
    expect(hooks.onBattleStart(fresh())).toBeUndefined();
  });

  it("unknown ids are skipped", () => {
    const hooks = mergeRelicHooks(["ghost", "manaCrystal"]);
    expect(hooks.onBattleStart(fresh())).toEqual({ mana: 2 });
  });

  it("two relics on the same event hook add up instead of overwriting", () => {
    const hooks = mergeRelicHooks(["manaCrystal", "surgeConduit", "surgeHeart"]);
    expect(hooks.onOverload(fresh())).toEqual({ mana: 3, enemyDamage: 20, cancelHpLoss: true });
    const stones = mergeRelicHooks(["masonGloves", "magmaCore"]);
    expect(stones.onStoneBroken(fresh(), [{ row: 0, col: 0 }, { row: 1, col: 1 }], "adjacent")).toEqual({
      mana: 2,
      enemyDamage: 10,
    });
  });

  it("chain multiplier takes the highest relic value (ring 2, eye 2.5), never below 1.5", () => {
    expect(mergeRelicHooks(["chainRing"]).chainMultiplier(fresh())).toBe(2);
    expect(mergeRelicHooks(["chainRing", "voidEye"]).chainMultiplier(fresh())).toBe(2.5);
    expect(mergeRelicHooks(["manaCrystal"]).chainMultiplier(fresh())).toBe(1.5);
  });

  it("spawn strategy merges field-wise with the default bias", () => {
    expect(mergeRelicHooks(["complementCharm"]).spawnStrategy(fresh())).toEqual({
      emptyThreshold: 4,
      probability: 0.5,
      baseProbability: 0.3,
    });
    expect(mergeRelicHooks(["manaCrystal"]).spawnStrategy(fresh())).toEqual({
      emptyThreshold: 4,
      probability: 0.5,
      baseProbability: 0,
    });
  });

  it("spell cost deltas add up and never go below 0", () => {
    const hooks = mergeRelicHooks(["inlayHammer"]);
    expect(hooks.spellCost(fresh(), "hammer", 2)).toBe(1);
    expect(hooks.spellCost(fresh(), "addOne", 1)).toBe(0);
    expect(hooks.spellCost(fresh(), "bomb", 4)).toBe(4);
    expect(spellCost(fresh(), "hammer", hooks)).toBe(1);
  });

  it("relicData writes from several relics merge", () => {
    const hooks = mergeRelicHooks(["forestHeart"]);
    expect(hooks.onPairCleared(fresh(), { count: 1, chain: false, damagePerPair: 10 })).toEqual({
      heroHp: 1,
      relicData: { forestHeartUsed: 1 },
    });
  });
});

describe("the 6 opening relics inside real battles", () => {
  it("魔力水晶: +2 mana when the battle starts", () => {
    const { state } = createBattle({ enemyId: "slime", heroHp: 10, heroMaxHp: 10 }, () => 0, mergeRelicHooks(["manaCrystal"]));
    expect(state.mana).toBe(2);
  });

  it("連鎖之戒: two pairs in one slide deal 20 each instead of 15", () => {
    const base = applyTurn(fresh(), "left", () => 0, mergeRelicHooks([]));
    const ring = applyTurn(fresh(), "left", () => 0, mergeRelicHooks(["chainRing"]));
    expect(base.state.enemyHp).toBe(150 - 30);
    expect(ring.state.enemyHp).toBe(150 - 40);
  });

  it("生命之杖: +2 HP after a victory only", () => {
    const hooks = mergeRelicHooks(["lifeStaff"]);
    const win = applyTurn(
      makeState(gridWith([[4, 6]]), { heroHp: 5, enemyHp: 10 }, "slime"),
      "left",
      () => 0,
      hooks,
    );
    expect(win.state.status).toBe("victory");
    expect(win.state.heroHp).toBe(7);
    const lose = applyTurn(
      makeState(gridWith([[5]]), { heroHp: 1, countdown: 1 }, "slime"),
      "right",
      () => 0,
      hooks,
    );
    expect(lose.state.status).toBe("defeat");
    expect(lose.state.heroHp).toBe(0);
  });

  it("暴走之心: an overload costs no HP and deals 20 damage", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next } = applyTurn(state, "up", () => 0, mergeRelicHooks(["surgeHeart"]));
    expect(next.heroHp).toBe(10);
    expect(next.enemyHp).toBe(20);
  });

  it("補數護符: a complement spawn can happen with plenty of room (30%)", () => {
    // 15 empty cells; rng 0 rolls under 30%, picks the first complement option (cell above/left of the 3 -> value 7)
    const state = makeState(gridWith([[null, 3, 4, 6]]), { countdown: 4 });
    const plain = applyTurn(state, "down", scripted(0, 0, 0), mergeRelicHooks([]));
    const charm = applyTurn(state, "down", scripted(0, 0, 0), mergeRelicHooks(["complementCharm"]));
    const spawned = (s: BattleState) => s.grid.flat().filter((c) => c !== null).length;
    expect(spawned(plain.state)).toBe(spawned(charm.state));
    const spawnEvent = (r: { events: Array<{ type: string; value?: number }> }) =>
      r.events.find((e) => e.type === "tileSpawned")?.value;
    expect(spawnEvent(plain)).toBe(1); // unbiased rng 0 -> value 1
    expect(spawnEvent(charm)).toBe(7); // biased: complement of the 3 above
  });

  it("石匠手套: each stone broken by a pair deals 5 damage", () => {
    const state = makeState(gridWith([[4, 6, STONE]]), {}, "treeKing");
    const { state: next } = applyTurn(state, "left", () => 0, mergeRelicHooks(["masonGloves"]));
    expect(next.enemyHp).toBe(150 - 10 - 5);
  });
});

describe("the 6 trophy relics inside real battles", () => {
  it("森林之心: heals 1 on the first elimination of a battle only", () => {
    const hooks = mergeRelicHooks(["forestHeart"]);
    const first = applyTurn(fresh({ heroHp: 5 }), "left", () => 0, hooks);
    expect(first.state.heroHp).toBe(6);
    expect(first.state.relicData).toEqual({ forestHeartUsed: 1 });
    const again = applyTurn(
      makeState(gridWith([[4, 6]]), { heroHp: 6, relicData: first.state.relicData }, "treeKing"),
      "left",
      () => 0,
      hooks,
    );
    expect(again.state.heroHp).toBe(6);
  });

  it("冰晶棱鏡: +2 damage per pair", () => {
    const { state } = applyTurn(fresh(), "left", () => 0, mergeRelicHooks(["iceShard"]));
    expect(state.enemyHp).toBe(150 - 30 - 4);
  });

  it("虛無之眼: chains deal floor(10 x 2.5) = 25 per pair", () => {
    const { state } = applyTurn(fresh(), "left", () => 0, mergeRelicHooks(["voidEye"]));
    expect(state.enemyHp).toBe(150 - 50);
  });

  it("暴走導管: an overload gives +3 mana (and still costs the 2 HP)", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next } = applyTurn(state, "up", () => 0, mergeRelicHooks(["surgeConduit"]));
    expect(next.mana).toBe(3);
    expect(next.heroHp).toBe(8);
  });

  it("鑲嵌鎚: hammer costs 1 and addOne costs 1 less; bomb is unchanged", () => {
    const hooks = mergeRelicHooks(["inlayHammer"]);
    const state = makeState(gridWith([[5, 6]]), { mana: 1 });
    const cast = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0, hooks);
    expect(cast.applied).toBe(true);
    expect(cast.state.mana).toBe(0);
    expect(castSpell(state, "bomb", { row: 0, col: 0 }, () => 0, hooks).reason).toBe("notEnoughMana");
  });

  it("熔岩核心: each stone broken gives +1 mana (also via the hammer)", () => {
    const hooks = mergeRelicHooks(["magmaCore"]);
    const state = makeState(gridWith([[STONE, 5]]), { mana: 2 });
    const cast = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0, hooks);
    expect(cast.state.mana).toBe(1); // 2 - 2 + 1
  });
});
```

- [ ] **Step 1.2: Run and see it fail**

```bash
npx vitest run tests/unit/adventure/relics.test.ts
```

Expected: the file fails to load (`Failed to load url ../../../src/adventure/relics ... Does the file exist?`), `Test Files  1 failed`.

- [ ] **Step 1.3: Implement `relics.ts`**

Create `workspace/src/adventure/relics.ts`:
```ts
/**
 * The 12 adventure relics (spec 7) and the merge of owned relics into the one
 * `BattleHooks` object battle.ts consumes. Pure data and pure functions.
 *
 * Six relics are in the opening pool (`starter: true`); the other six are
 * unlocked one-to-one by adventure trophies (see unlocks.ts).
 */
import { COMPLEMENT_BIAS, type SpawnStrategy } from "../grid";
import {
  BASE_CHAIN_MULTIPLIER,
  DEFAULT_HOOKS,
  type BattleHooks,
  type BattleHooksInput,
  type BattleState,
  type HookEffect,
  type OverloadResponse,
  type SpellId,
} from "./battle";

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** True = in the opening pool; false = unlocked by an adventure trophy. */
  starter: boolean;
  hooks: BattleHooksInput;
}

export const RELICS: readonly RelicDef[] = [
  // ── opening pool (spec 7) ──
  { id: "manaCrystal", name: "魔力水晶", icon: "💎", starter: true,
    description: "每場戰鬥開始時魔力 +2",
    hooks: { onBattleStart: () => ({ mana: 2 }) } },
  { id: "chainRing", name: "連鎖之戒", icon: "💍", starter: true,
    description: "連鎖倍率由 ×1.5 變為 ×2",
    hooks: { chainMultiplier: () => 2 } },
  { id: "lifeStaff", name: "生命之杖", icon: "🪄", starter: true,
    description: "每場戰鬥勝利後回 2 血",
    hooks: { onBattleEnd: (_state, result) => (result === "victory" ? { heroHp: 2 } : undefined) } },
  { id: "surgeHeart", name: "暴走之心", icon: "🔥", starter: true,
    description: "魔力暴走時不扣血，改為對敵人造成 20 傷害",
    hooks: { onOverload: () => ({ cancelHpLoss: true, enemyDamage: 20 }) } },
  { id: "complementCharm", name: "補數護符", icon: "🧿", starter: true,
    description: "預防層在任何空格數下都有 30% 機率生效",
    hooks: { spawnStrategy: () => ({ emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 }) } },
  { id: "masonGloves", name: "石匠手套", icon: "🧤", starter: true,
    description: "每碎一塊石塊，對敵人造成 5 傷害",
    hooks: { onStoneBroken: (_state, cells) => ({ enemyDamage: 5 * cells.length }) } },

  // ── unlocked by adventure trophies ──
  { id: "forestHeart", name: "森林之心", icon: "🌳", starter: false,
    description: "每場戰鬥第一次消除時回 1 血",
    hooks: {
      onPairCleared: (state) =>
        state.relicData?.forestHeartUsed ? undefined : { heroHp: 1, relicData: { forestHeartUsed: 1 } },
    } },
  { id: "iceShard", name: "冰晶棱鏡", icon: "🔷", starter: false,
    description: "每消除一對，額外對敵人造成 2 傷害",
    hooks: { onPairCleared: (_state, info) => ({ enemyDamage: 2 * info.count }) } },
  { id: "voidEye", name: "虛無之眼", icon: "👁️", starter: false,
    description: "連鎖倍率變為 ×2.5（與連鎖之戒不疊加，取較高者）",
    hooks: { chainMultiplier: () => 2.5 } },
  { id: "surgeConduit", name: "暴走導管", icon: "🔌", starter: false,
    description: "魔力暴走時魔力 +3",
    hooks: { onOverload: () => ({ mana: 3 }) } },
  { id: "inlayHammer", name: "鑲嵌鎚", icon: "🔨", starter: false,
    description: "碎石與增幅的魔力消耗 -1",
    hooks: {
      spellCost: (_state, spell, baseCost) => (spell === "hammer" || spell === "addOne" ? baseCost - 1 : baseCost),
    } },
  { id: "magmaCore", name: "熔岩核心", icon: "🌋", starter: false,
    description: "每碎一塊石塊，魔力 +1",
    hooks: { onStoneBroken: (_state, cells) => ({ mana: cells.length }) } },
];

export const STARTER_RELIC_IDS: readonly string[] = RELICS.filter((r) => r.starter).map((r) => r.id);
export const UNLOCKABLE_RELIC_IDS: readonly string[] = RELICS.filter((r) => !r.starter).map((r) => r.id);

/** Look a relic up by id; undefined for unknown ids so save loading can reject corrupt data. */
export function getRelic(id: string): RelicDef | undefined {
  return RELICS.find((relic) => relic.id === id);
}

// ── merging owned relics into one BattleHooks ───────────────────────────────

function sumEffects(effects: Array<HookEffect | OverloadResponse | void>): OverloadResponse | undefined {
  let mana = 0;
  let heroHp = 0;
  let enemyDamage = 0;
  let cancelHpLoss = false;
  let relicData: Record<string, number> | undefined;
  let any = false;
  effects.forEach((effect) => {
    if (!effect) return;
    any = true;
    mana += effect.mana ?? 0;
    heroHp += effect.heroHp ?? 0;
    enemyDamage += effect.enemyDamage ?? 0;
    cancelHpLoss = cancelHpLoss || Boolean((effect as OverloadResponse).cancelHpLoss);
    if (effect.relicData) relicData = { ...relicData, ...effect.relicData };
  });
  if (!any) return undefined;
  const merged: OverloadResponse = {};
  if (mana) merged.mana = mana;
  if (heroHp) merged.heroHp = heroHp;
  if (enemyDamage) merged.enemyDamage = enemyDamage;
  if (cancelHpLoss) merged.cancelHpLoss = true;
  if (relicData) merged.relicData = relicData;
  return merged;
}

/**
 * Merge the hooks of the owned relics (unknown ids are skipped).
 * Rules: chain multiplier = highest of the base 1.5 and every relic's; spawn
 * strategy = field-wise highest of the default bias and every relic's; spell
 * cost = base cost plus the sum of every relic's delta (never below 0); event
 * hooks = sum of every relic's effect (`cancelHpLoss` is true if any says so).
 */
export function mergeRelicHooks(relicIds: readonly string[]): BattleHooks {
  const hooks = relicIds.flatMap((id) => {
    const relic = getRelic(id);
    return relic ? [relic.hooks] : [];
  });
  if (hooks.length === 0) return DEFAULT_HOOKS;

  const chainHooks = hooks.flatMap((h) => (h.chainMultiplier ? [h.chainMultiplier] : []));
  const spawnHooks = hooks.flatMap((h) => (h.spawnStrategy ? [h.spawnStrategy] : []));
  const costHooks = hooks.flatMap((h) => (h.spellCost ? [h.spellCost] : []));
  const startHooks = hooks.flatMap((h) => (h.onBattleStart ? [h.onBattleStart] : []));
  const pairHooks = hooks.flatMap((h) => (h.onPairCleared ? [h.onPairCleared] : []));
  const stoneHooks = hooks.flatMap((h) => (h.onStoneBroken ? [h.onStoneBroken] : []));
  const overloadHooks = hooks.flatMap((h) => (h.onOverload ? [h.onOverload] : []));
  const endHooks = hooks.flatMap((h) => (h.onBattleEnd ? [h.onBattleEnd] : []));

  return {
    chainMultiplier: (state: BattleState) =>
      Math.max(BASE_CHAIN_MULTIPLIER, ...chainHooks.map((hook) => hook(state))),
    spawnStrategy: (state: BattleState): SpawnStrategy => {
      const all = [COMPLEMENT_BIAS, ...spawnHooks.map((hook) => hook(state))];
      return {
        emptyThreshold: Math.max(...all.map((s) => s.emptyThreshold)),
        probability: Math.max(...all.map((s) => s.probability)),
        baseProbability: Math.max(...all.map((s) => s.baseProbability ?? 0)),
      };
    },
    spellCost: (state: BattleState, spell: SpellId, baseCost: number) =>
      Math.max(0, baseCost + costHooks.reduce((sum, hook) => sum + (hook(state, spell, baseCost) - baseCost), 0)),
    onBattleStart: (state) => sumEffects(startHooks.map((hook) => hook(state))),
    onPairCleared: (state, info) => sumEffects(pairHooks.map((hook) => hook(state, info))),
    onStoneBroken: (state, cells, cause) => sumEffects(stoneHooks.map((hook) => hook(state, cells, cause))),
    onOverload: (state) => sumEffects(overloadHooks.map((hook) => hook(state))),
    onBattleEnd: (state, result) => sumEffects(endHooks.map((hook) => hook(state, result))),
  };
}
```

- [ ] **Step 1.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure/relics.test.ts && npm run test:unit && npx tsc --noEmit
```

Expected: new file `22 passed`; full unit `Test Files  29 passed (29)`, `Tests  426 passed (426)`; `tsc` clean.

- [ ] **Step 1.5: Commit**

```bash
git add workspace/src/adventure/relics.ts workspace/tests/unit/adventure/relics.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): twelve adventure relics and the relic hook composer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 2: Adventure trophies and relic unlocks in `src/adventure/unlocks.ts`

**Files:**
- Create: `workspace/src/adventure/storage.ts`
- Create: `workspace/src/adventure/unlocks.ts`
- Create: `workspace/tests/unit/adventure/storeHelper.ts` (test helper, not a test file)
- Create: `workspace/tests/unit/adventure/unlocks.test.ts`

**Interfaces:**

Consumes: `relics.ts` (`STARTER_RELIC_IDS`, `getRelic`, `UNLOCKABLE_RELIC_IDS` in tests).

Produces:
```ts
// storage.ts
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
// unlocks.ts
export const ADVENTURE_TROPHY_KEY = "mathMerge10AdventureTrophies";
export interface AdventureTrophyDef { id: string; name: string; icon: string; description: string; relicId: string }
export type AdventureTrophyEvent =
  | { type: "battleWon"; enemyId: string; overloads: number; maxChain: number; stonesBroken: number }
  | { type: "runWon" };
export const ADVENTURE_TROPHIES: readonly AdventureTrophyDef[];          // 6
export function getAdventureTrophy(id: string): AdventureTrophyDef | undefined;
export function loadAdventureTrophies(store: KeyValueStore): Record<string, number>;
export function checkAdventureTrophies(event: AdventureTrophyEvent, store: KeyValueStore, now?: number): string[];  // newly unlocked ids
export function unlockedRelicIds(store: KeyValueStore): string[];        // 6 starters + one per unlocked trophy
```
Test helper `memoryStore(initial?, failWrites?)` (in `storeHelper.ts`) returns a `KeyValueStore` plus its `.data` record.

- [ ] **Step 2.1: Write the failing test and its helper**

Create `workspace/tests/unit/adventure/storeHelper.ts`:
```ts
import type { KeyValueStore } from "../../../src/adventure/storage";

/** In-memory KeyValueStore; `failWrites` makes setItem throw like a full or blocked localStorage. */
export function memoryStore(initial: Record<string, string> = {}, failWrites = false): KeyValueStore & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      if (failWrites) throw new Error("QuotaExceededError");
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}
```
Create `workspace/tests/unit/adventure/unlocks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  ADVENTURE_TROPHIES,
  ADVENTURE_TROPHY_KEY,
  checkAdventureTrophies,
  getAdventureTrophy,
  loadAdventureTrophies,
  unlockedRelicIds,
  type AdventureTrophyEvent,
} from "../../../src/adventure/unlocks";
import { STARTER_RELIC_IDS, UNLOCKABLE_RELIC_IDS, getRelic } from "../../../src/adventure/relics";
import { memoryStore } from "./storeHelper";

const won = (extra: Partial<Extract<AdventureTrophyEvent, { type: "battleWon" }>> = {}): AdventureTrophyEvent => ({
  type: "battleWon",
  enemyId: "slime",
  overloads: 0,
  maxChain: 1,
  stonesBroken: 0,
  ...extra,
});

describe("adventure trophy table (spec 8)", () => {
  it("has 6 trophies, each unlocking a different one of the 6 non-starter relics", () => {
    expect(ADVENTURE_TROPHIES).toHaveLength(6);
    expect(new Set(ADVENTURE_TROPHIES.map((t) => t.id)).size).toBe(6);
    expect([...ADVENTURE_TROPHIES.map((t) => t.relicId)].sort()).toEqual([...UNLOCKABLE_RELIC_IDS].sort());
    ADVENTURE_TROPHIES.forEach((t) => expect(getRelic(t.relicId)?.starter).toBe(false));
  });

  it("includes the spec examples: treeKing, first clear, 3 overloads in one battle", () => {
    expect(getAdventureTrophy("adv_treeKing")?.relicId).toBe("forestHeart");
    expect(getAdventureTrophy("adv_clear")?.description).toContain("通關");
    expect(getAdventureTrophy("adv_overload3")?.relicId).toBe("surgeConduit");
  });
});

describe("checkAdventureTrophies", () => {
  it("beating the tree king unlocks adv_treeKing once", () => {
    const store = memoryStore();
    expect(checkAdventureTrophies(won({ enemyId: "treeKing" }), store, 111)).toEqual(["adv_treeKing"]);
    expect(checkAdventureTrophies(won({ enemyId: "treeKing" }), store, 222)).toEqual([]);
    expect(loadAdventureTrophies(store)).toEqual({ adv_treeKing: 111 });
  });

  it("the ice queen, the clear, 3 overloads, a 3-pair slide and 6 stones each unlock their own trophy", () => {
    const store = memoryStore();
    expect(checkAdventureTrophies(won({ enemyId: "iceQueen" }), store)).toEqual(["adv_iceQueen"]);
    expect(checkAdventureTrophies({ type: "runWon" }, store)).toEqual(["adv_clear"]);
    expect(checkAdventureTrophies(won({ overloads: 3 }), store)).toEqual(["adv_overload3"]);
    expect(checkAdventureTrophies(won({ maxChain: 3 }), store)).toEqual(["adv_chain3"]);
    expect(checkAdventureTrophies(won({ stonesBroken: 6 }), store)).toEqual(["adv_stones6"]);
  });

  it("thresholds are exact: 2 overloads, a 2-pair chain and 5 stones do not count", () => {
    const store = memoryStore();
    expect(checkAdventureTrophies(won({ overloads: 2, maxChain: 2, stonesBroken: 5 }), store)).toEqual([]);
  });

  it("one event can unlock several trophies", () => {
    const store = memoryStore();
    const ids = checkAdventureTrophies(won({ enemyId: "treeKing", overloads: 3, maxChain: 3, stonesBroken: 6 }), store);
    expect([...ids].sort()).toEqual(["adv_chain3", "adv_overload3", "adv_stones6", "adv_treeKing"]);
  });

  it("a failed storage write does not throw (the unlock is still reported)", () => {
    const store = memoryStore({}, true);
    expect(checkAdventureTrophies({ type: "runWon" }, store)).toEqual(["adv_clear"]);
  });
});

describe("loadAdventureTrophies / unlockedRelicIds", () => {
  it("corrupt or foreign storage reads as nothing unlocked", () => {
    expect(loadAdventureTrophies(memoryStore({ [ADVENTURE_TROPHY_KEY]: "{{{" }))).toEqual({});
    expect(loadAdventureTrophies(memoryStore({ [ADVENTURE_TROPHY_KEY]: "[1,2]" }))).toEqual({});
    expect(loadAdventureTrophies(memoryStore({ [ADVENTURE_TROPHY_KEY]: '{"bogus":1,"adv_clear":"x"}' }))).toEqual({});
  });

  it("the run pool is the 6 starters plus one relic per unlocked trophy", () => {
    const store = memoryStore();
    expect(unlockedRelicIds(store)).toEqual([...STARTER_RELIC_IDS]);
    checkAdventureTrophies(won({ enemyId: "treeKing" }), store);
    checkAdventureTrophies({ type: "runWon" }, store);
    expect(unlockedRelicIds(store)).toEqual([...STARTER_RELIC_IDS, "forestHeart", "voidEye"]);
  });
});
```

- [ ] **Step 2.2: Run and see it fail**

```bash
npx vitest run tests/unit/adventure/unlocks.test.ts
```

Expected: import failure for `src/adventure/unlocks`, `Test Files  1 failed`.

- [ ] **Step 2.3: Implement `storage.ts` and `unlocks.ts`**

Create `workspace/src/adventure/storage.ts`:
```ts
/** The slice of `Storage` the adventure code needs, so tests can inject an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```
Create `workspace/src/adventure/unlocks.ts`:
```ts
/**
 * Adventure trophies and the relic unlocks they grant (spec 8). Kept apart
 * from `trophies.ts` (the endless-mode career trophies and their 67-entry
 * contract); the storage key is its own too. Each trophy unlocks exactly one
 * of the six non-starter relics.
 */
import { STARTER_RELIC_IDS } from "./relics";
import type { KeyValueStore } from "./storage";

export const ADVENTURE_TROPHY_KEY = "mathMerge10AdventureTrophies";

export interface AdventureTrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** The relic this trophy adds to the opening pool. */
  relicId: string;
}

/** What the run layer reports; `maxChain` = most pairs cleared by one slide this battle. */
export type AdventureTrophyEvent =
  | { type: "battleWon"; enemyId: string; overloads: number; maxChain: number; stonesBroken: number }
  | { type: "runWon" };

interface TrophyRule extends AdventureTrophyDef {
  check: (event: AdventureTrophyEvent) => boolean;
}

const RULES: readonly TrophyRule[] = [
  { id: "adv_treeKing", name: "森林征服者", icon: "🌳", relicId: "forestHeart",
    description: "擊敗三角樹王",
    check: (e) => e.type === "battleWon" && e.enemyId === "treeKing" },
  { id: "adv_iceQueen", name: "冰窟征服者", icon: "❄️", relicId: "iceShard",
    description: "擊敗六角冰后",
    check: (e) => e.type === "battleWon" && e.enemyId === "iceQueen" },
  { id: "adv_clear", name: "歸零者", icon: "👑", relicId: "voidEye",
    description: "首次通關（擊敗零之魔王）",
    check: (e) => e.type === "runWon" },
  { id: "adv_overload3", name: "暴走大師", icon: "🔥", relicId: "surgeConduit",
    description: "單場戰鬥觸發 3 次魔力暴走並獲勝",
    check: (e) => e.type === "battleWon" && e.overloads >= 3 },
  { id: "adv_chain3", name: "連鎖法師", icon: "⚡", relicId: "inlayHammer",
    description: "單次滑動消除 3 對以上並贏得該場戰鬥",
    check: (e) => e.type === "battleWon" && e.maxChain >= 3 },
  { id: "adv_stones6", name: "碎石工", icon: "🪨", relicId: "magmaCore",
    description: "單場戰鬥碎掉 6 塊石塊並獲勝",
    check: (e) => e.type === "battleWon" && e.stonesBroken >= 6 },
];

export const ADVENTURE_TROPHIES: readonly AdventureTrophyDef[] = RULES.map(
  ({ check: _check, ...def }) => def,
);

export function getAdventureTrophy(id: string): AdventureTrophyDef | undefined {
  return ADVENTURE_TROPHIES.find((t) => t.id === id);
}

/** trophy id -> unlock timestamp. Corrupt storage reads as "nothing unlocked". */
export function loadAdventureTrophies(store: KeyValueStore): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(store.getItem(ADVENTURE_TROPHY_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    Object.entries(parsed).forEach(([id, at]) => {
      if (getAdventureTrophy(id) && typeof at === "number") result[id] = at;
    });
    return result;
  } catch {
    return {};
  }
}

/** Record an event; returns the ids of the trophies it unlocked for the first time. */
export function checkAdventureTrophies(
  event: AdventureTrophyEvent,
  store: KeyValueStore,
  now: number = Date.now(),
): string[] {
  const unlocked = loadAdventureTrophies(store);
  const fresh = RULES.filter((rule) => !(rule.id in unlocked) && rule.check(event)).map((rule) => rule.id);
  if (fresh.length === 0) return [];
  fresh.forEach((id) => {
    unlocked[id] = now;
  });
  try {
    store.setItem(ADVENTURE_TROPHY_KEY, JSON.stringify(unlocked));
  } catch {
    /* storage full or unavailable: the unlock just will not persist */
  }
  return fresh;
}

/** The relic pool for a new run: the 6 opening relics plus one per unlocked trophy. */
export function unlockedRelicIds(store: KeyValueStore): string[] {
  const unlocked = loadAdventureTrophies(store);
  const earned = ADVENTURE_TROPHIES.filter((t) => t.id in unlocked).map((t) => t.relicId);
  return [...STARTER_RELIC_IDS, ...earned];
}
```

- [ ] **Step 2.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure/unlocks.test.ts && npm run test:unit && npx tsc --noEmit
```

Expected: new file `9 passed`; full unit `Test Files  30 passed (30)`, `Tests  435 passed (435)`; `tsc` clean.

- [ ] **Step 2.5: Commit**

```bash
git add workspace/src/adventure/storage.ts workspace/src/adventure/unlocks.ts workspace/tests/unit/adventure/storeHelper.ts workspace/tests/unit/adventure/unlocks.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure trophies that unlock the six trophy relics

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 3: The run flow in `src/adventure/run.ts`

**Files:**
- Create: `workspace/src/adventure/run.ts`
- Create: `workspace/tests/unit/adventure/runHelpers.ts` (test helper)
- Create: `workspace/tests/unit/adventure/run.test.ts`

**Interfaces:**

Consumes: `battle.ts` (`applyTurn`, `castSpell`, `createBattle`, `HERO_START_HP`, `NO_UPGRADES`, `SPELL_IDS`, types), `enemies.ts` (`ENEMIES`, `getEnemy`), `intents.ts` (`pickDistinct`), `relics.ts` (`getRelic`, `mergeRelicHooks`), `unlocks.ts` (type `AdventureTrophyEvent`).

Produces (exported from `src/adventure/run.ts`):
```ts
export const BATTLE_ORDER: readonly string[];      // slime, stoneGolem, treeKing, snowSprite, crystalGuard, iceQueen, spiralMage, shadowBlock, zeroLord
export const TOTAL_BATTLES: number;                // 9
export const HEAL_OPTION_AMOUNT: number;           // 3
export type RunPhase = "relicPick" | "battle" | "reward" | "victory" | "defeat";
export type RewardOption =
  | { kind: "relic"; relicId: string } | { kind: "upgrade"; spell: SpellId } | { kind: "heal"; amount: number };
export interface BattleStats { stonesBroken: number; maxChain: number }
export interface RunState {
  phase: RunPhase; battleIndex: number; heroHp: number; heroMaxHp: number;
  relics: string[]; upgrades: SpellUpgrades; pool: string[];
  battle: BattleState | null; stats: BattleStats; offers: RewardOption[];
}
export interface RunStep {
  run: RunState; events: BattleEvent[]; trophyEvents: AdventureTrophyEvent[];
  applied: boolean;   // false = nothing happened and `run` is the same object
  reason?: SpellFailure | "wrongPhase" | "badChoice";
}
export function createRun(rng: Rng, pool: readonly string[]): RunState;               // phase relicPick, 3 relic offers
export function rollOffers(run: RunState, boss: boolean, rng: Rng): RewardOption[];
export function chooseOffer(run: RunState, index: number, rng: Rng): RunStep;          // relicPick -> battle 0; reward -> next battle
export function runTurn(run: RunState, direction: Direction, rng: Rng): RunStep;
export function runCast(run: RunState, spell: SpellId, target: CellPosition | null, rng: Rng): RunStep;
```
Test helper `runInBattle(grid, battleChanges?, runChanges?, battleIndex?)` (in `runHelpers.ts`) builds a battle-phase `RunState` around a hand-made board.

- [ ] **Step 3.1: Write the failing test and its helper**

Create `workspace/tests/unit/adventure/runHelpers.ts`:
```ts
import type { GameGrid } from "../../../src/grid";
import { NO_UPGRADES, type BattleState } from "../../../src/adventure/battle";
import { BATTLE_ORDER, type RunState } from "../../../src/adventure/run";
import { STARTER_RELIC_IDS } from "../../../src/adventure/relics";
import { makeState } from "./battleHelpers";

/** A run in the battle phase at `battleIndex`, with a hand-built battle on `grid`. */
export function runInBattle(
  grid: GameGrid,
  battleChanges: Partial<BattleState> = {},
  runChanges: Partial<RunState> = {},
  battleIndex = 0,
): RunState {
  // makeState predates BattleState.relicData, so add it here.
  const battle = { ...makeState(grid, battleChanges, BATTLE_ORDER[battleIndex]), relicData: battleChanges.relicData ?? {} };
  return {
    phase: "battle",
    battleIndex,
    heroHp: battle.heroHp,
    heroMaxHp: battle.heroMaxHp,
    relics: [],
    upgrades: { ...NO_UPGRADES },
    pool: [...STARTER_RELIC_IDS],
    battle,
    stats: { stonesBroken: 0, maxChain: 0 },
    offers: [],
    ...runChanges,
  };
}
```
Create `workspace/tests/unit/adventure/run.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import { NO_UPGRADES } from "../../../src/adventure/battle";
import {
  BATTLE_ORDER,
  HEAL_OPTION_AMOUNT,
  chooseOffer,
  createRun,
  rollOffers,
  runCast,
  runTurn,
  type RunState,
} from "../../../src/adventure/run";
import { STARTER_RELIC_IDS, UNLOCKABLE_RELIC_IDS } from "../../../src/adventure/relics";
import { gridWith, scripted, seededRng } from "./battleHelpers";
import { runInBattle } from "./runHelpers";

const POOL = [...STARTER_RELIC_IDS];

describe("createRun", () => {
  it("starts at the relic pick with full HP, no relics and 3 different opening relics from the pool", () => {
    const run = createRun(seededRng(1), POOL);
    expect(run.phase).toBe("relicPick");
    expect(run.battle).toBeNull();
    expect(run.heroHp).toBe(10);
    expect(run.heroMaxHp).toBe(10);
    expect(run.relics).toEqual([]);
    expect(run.upgrades).toEqual(NO_UPGRADES);
    expect(run.offers).toHaveLength(3);
    const ids = run.offers.map((o) => (o.kind === "relic" ? o.relicId : ""));
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(POOL).toContain(id));
  });

  it("is deterministic for a fixed seed and drops unknown pool ids", () => {
    expect(createRun(seededRng(7), POOL)).toEqual(createRun(seededRng(7), POOL));
    expect(createRun(seededRng(7), [...POOL, "ghost"]).pool).toEqual(POOL);
  });

  it("unlocked relics can show up in the opening offers", () => {
    const pool = [...POOL, ...UNLOCKABLE_RELIC_IDS];
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      createRun(seededRng(seed), pool).offers.forEach((o) => o.kind === "relic" && seen.add(o.relicId));
    }
    expect(UNLOCKABLE_RELIC_IDS.some((id) => seen.has(id))).toBe(true);
  });
});

describe("the battle order (spec 6)", () => {
  it("is 9 fights: normal, normal, boss in forest, ice cave and demon tower", () => {
    expect(BATTLE_ORDER).toEqual([
      "slime", "stoneGolem", "treeKing",
      "snowSprite", "crystalGuard", "iceQueen",
      "spiralMage", "shadowBlock", "zeroLord",
    ]);
  });
});

describe("chooseOffer at the relic pick", () => {
  it("takes the relic and starts battle 0 with it in play", () => {
    const run = createRun(seededRng(3), POOL);
    const pick = run.offers[1];
    const step = chooseOffer(run, 1, seededRng(4));
    expect(step.applied).toBe(true);
    expect(step.run.phase).toBe("battle");
    expect(step.run.battleIndex).toBe(0);
    expect(step.run.relics).toEqual([pick.kind === "relic" ? pick.relicId : ""]);
    expect(step.run.battle?.enemyId).toBe("slime");
    expect(step.run.offers).toEqual([]);
    expect(step.events.length).toBeGreaterThan(0);
  });

  it("魔力水晶 as the opening relic shows up as 2 mana at the start of battle 0", () => {
    const run: RunState = { ...createRun(seededRng(3), POOL), offers: [{ kind: "relic", relicId: "manaCrystal" }] };
    expect(chooseOffer(run, 0, seededRng(4)).run.battle?.mana).toBe(2);
  });

  it("a bad index or the wrong phase changes nothing", () => {
    const run = createRun(seededRng(3), POOL);
    expect(chooseOffer(run, 9, seededRng(4))).toMatchObject({ applied: false, reason: "badChoice", run });
    const inBattle = runInBattle(gridWith([[1, 2]]));
    expect(chooseOffer(inBattle, 0, seededRng(4))).toMatchObject({ applied: false, reason: "wrongPhase" });
  });
});

describe("rollOffers (spec 6)", () => {
  const base = runInBattle(gridWith([]), {}, { relics: ["chainRing"] });

  it("a normal win offers one unowned relic, one un-upgraded spell and the 3 HP heal", () => {
    const offers = rollOffers(base, false, seededRng(5));
    expect(offers.map((o) => o.kind)).toEqual(["relic", "upgrade", "heal"]);
    const relic = offers[0];
    expect(relic.kind === "relic" && relic.relicId).not.toBe("chainRing");
    expect(offers[2]).toEqual({ kind: "heal", amount: HEAL_OPTION_AMOUNT });
  });

  it("skips kinds that ran out: all spells upgraded, all pool relics owned", () => {
    const allUp = { hammer: true, addOne: true, bomb: true, shuffle: true };
    const run = { ...base, upgrades: allUp, relics: [...POOL] };
    expect(rollOffers(run, false, seededRng(5))).toEqual([{ kind: "heal", amount: 3 }]);
  });

  it("a boss win offers three different unowned relics", () => {
    const offers = rollOffers(base, true, seededRng(5));
    expect(offers).toHaveLength(3);
    const ids = offers.map((o) => (o.kind === "relic" ? o.relicId : "x"));
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain("chainRing");
  });

  it("a boss win with fewer than 3 relics left offers what is left, then falls back to the normal offers", () => {
    const fewLeft = { ...base, relics: POOL.slice(0, 5) };
    expect(rollOffers(fewLeft, true, seededRng(5))).toEqual([{ kind: "relic", relicId: POOL[5] }]);
    const none = { ...base, relics: [...POOL] };
    expect(rollOffers(none, true, seededRng(5)).map((o) => o.kind)).toEqual(["upgrade", "heal"]);
  });
});

describe("chooseOffer in the reward phase", () => {
  const rewardRun = (offer: RunState["offers"][number], changes: Partial<RunState> = {}): RunState => ({
    ...runInBattle(gridWith([]), { status: "victory", enemyHp: 0 }),
    phase: "reward",
    offers: [offer],
    ...changes,
  });

  it("a relic is added and the next enemy appears", () => {
    const step = chooseOffer(rewardRun({ kind: "relic", relicId: "iceShard" }), 0, seededRng(1));
    expect(step.run.relics).toEqual(["iceShard"]);
    expect(step.run.battleIndex).toBe(1);
    expect(step.run.battle?.enemyId).toBe("stoneGolem");
    expect(step.run.phase).toBe("battle");
  });

  it("a spell upgrade is stored and carried into the next battle", () => {
    const step = chooseOffer(rewardRun({ kind: "upgrade", spell: "bomb" }), 0, seededRng(1));
    expect(step.run.upgrades.bomb).toBe(true);
    expect(step.run.battle?.upgrades.bomb).toBe(true);
    expect(step.run.battle?.upgrades.hammer).toBe(false);
  });

  it("the heal is capped at max HP and HP carries into the next battle; mana, shield and freezes reset", () => {
    const hurt = rewardRun({ kind: "heal", amount: 3 }, { heroHp: 4 });
    const step = chooseOffer(hurt, 0, seededRng(1));
    expect(step.run.heroHp).toBe(7);
    expect(step.run.battle).toMatchObject({ heroHp: 7, mana: 0, enemyShield: 0, freezes: [], overloads: 0, turn: 0 });
    const nearFull = chooseOffer(rewardRun({ kind: "heal", amount: 3 }, { heroHp: 9 }), 0, seededRng(1));
    expect(nearFull.run.heroHp).toBe(10);
  });

  it("per-battle stats reset when the next battle starts", () => {
    const run = rewardRun({ kind: "heal", amount: 3 }, { stats: { stonesBroken: 5, maxChain: 3 } });
    expect(chooseOffer(run, 0, seededRng(1)).run.stats).toEqual({ stonesBroken: 0, maxChain: 0 });
  });
});

describe("runTurn", () => {
  it("an invalid swipe is not a turn", () => {
    const run = runInBattle(gridWith([[1, 2, 3, 4]]));
    const step = runTurn(run, "left", () => 0);
    expect(step.applied).toBe(false);
    expect(step.run).toBe(run);
  });

  it("a normal turn updates the battle and copies hero HP into the run", () => {
    const run = runInBattle(gridWith([[5]]), { countdown: 1, heroHp: 5 });
    const step = runTurn(run, "right", scripted(0, 0, 0));
    expect(step.applied).toBe(true);
    expect(step.run.heroHp).toBe(4); // slime attack 1
    expect(step.run.battle?.heroHp).toBe(4);
    expect(step.run.phase).toBe("battle");
    expect(step.trophyEvents).toEqual([]);
  });

  it("winning a normal fight moves to the reward phase with offers and reports battleWon", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10, overloads: 2 }, { stats: { stonesBroken: 4, maxChain: 2 } });
    const step = runTurn(run, "left", seededRng(2));
    expect(step.run.phase).toBe("reward");
    expect(step.run.battle?.status).toBe("victory");
    expect(step.run.offers.map((o) => o.kind)).toEqual(["relic", "upgrade", "heal"]);
    expect(step.trophyEvents).toEqual([
      { type: "battleWon", enemyId: "slime", overloads: 2, maxChain: 2, stonesBroken: 4 },
    ]);
  });

  it("生命之杖 heals after the win and the heal reaches the run", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10, heroHp: 5 }, { relics: ["lifeStaff"] });
    expect(runTurn(run, "left", seededRng(2)).run.heroHp).toBe(7);
  });

  it("a boss win heals half the max HP (floor) and offers three relics", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10, heroHp: 3 }, {}, 2);
    const step = runTurn(run, "left", seededRng(2));
    expect(step.run.heroHp).toBe(8);
    expect(step.run.offers.map((o) => o.kind)).toEqual(["relic", "relic", "relic"]);
    expect(step.trophyEvents[0]).toMatchObject({ type: "battleWon", enemyId: "treeKing" });
    const full = runTurn(runInBattle(gridWith([[4, 6]]), { enemyHp: 10, heroHp: 9 }, {}, 2), "left", seededRng(2));
    expect(full.run.heroHp).toBe(10);
  });

  it("beating the zero lord ends the run in victory with battleWon and runWon, and no offers", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10 }, {}, 8);
    const step = runTurn(run, "left", seededRng(2));
    expect(step.run.phase).toBe("victory");
    expect(step.run.offers).toEqual([]);
    expect(step.trophyEvents.map((e) => e.type)).toEqual(["battleWon", "runWon"]);
  });

  it("losing all HP ends the run in defeat but keeps the battle for the result screen", () => {
    const run = runInBattle(gridWith([[5]]), { heroHp: 1, countdown: 1 });
    const step = runTurn(run, "right", scripted(0, 0, 0));
    expect(step.run.phase).toBe("defeat");
    expect(step.run.heroHp).toBe(0);
    expect(step.run.battle?.status).toBe("defeat");
    expect(step.trophyEvents).toEqual([]);
  });

  it("tracks the biggest slide chain and the stones broken in the battle", () => {
    const run = runInBattle(gridWith([[4, 6, 4, 6, STONE]]), { enemyHp: 100 }, {}, 2);
    const step = runTurn(run, "left", scripted(0, 0, 0));
    expect(step.run.stats.maxChain).toBe(2);
    const stoneRun = runInBattle(gridWith([[4, 6, STONE]]), {}, { stats: { stonesBroken: 1, maxChain: 1 } });
    const after = runTurn(stoneRun, "left", scripted(0, 0, 0));
    expect(after.run.stats).toEqual({ stonesBroken: 2, maxChain: 1 });
  });

  it("does nothing outside the battle phase", () => {
    const run = createRun(seededRng(1), POOL);
    expect(runTurn(run, "left", () => 0)).toMatchObject({ applied: false, reason: "wrongPhase" });
  });
});

describe("runCast", () => {
  it("casts through the relic-merged hooks and reports failures", () => {
    const run = runInBattle(gridWith([[STONE, 5]]), { mana: 1 }, { relics: ["inlayHammer"] });
    const ok = runCast(run, "hammer", { row: 0, col: 0 }, () => 0);
    expect(ok.applied).toBe(true);
    expect(ok.run.battle?.mana).toBe(0);
    const poor = runCast(runInBattle(gridWith([[STONE, 5]]), { mana: 1 }), "hammer", { row: 0, col: 0 }, () => 0);
    expect(poor).toMatchObject({ applied: false, reason: "notEnoughMana" });
    const badTarget = runCast(runInBattle(gridWith([[5]]), { mana: 4 }), "hammer", { row: 3, col: 3 }, () => 0);
    expect(badTarget).toMatchObject({ applied: false, reason: "invalidTarget" });
  });

  it("a spell can win the fight (addOne on a 9 deals 10)", () => {
    const run = runInBattle(gridWith([[9]]), { mana: 2, enemyHp: 10 });
    const step = runCast(run, "addOne", { row: 0, col: 0 }, seededRng(1));
    expect(step.run.phase).toBe("reward");
  });

  it("does nothing outside the battle phase", () => {
    expect(runCast(createRun(seededRng(1), POOL), "shuffle", null, () => 0)).toMatchObject({
      applied: false,
      reason: "wrongPhase",
    });
  });
});
```

- [ ] **Step 3.2: Run and see it fail**

```bash
npx vitest run tests/unit/adventure/run.test.ts
```

Expected: import failure for `src/adventure/run`, `Test Files  1 failed`.

- [ ] **Step 3.3: Implement `run.ts`**

Create `workspace/src/adventure/run.ts`:
```ts
/**
 * One adventure run (spec 6): 9 battles in a fixed line, HP carried between
 * them, a three-pick reward after every win. Pure: every function takes a
 * `RunState` and returns a new one, with randomness injected as an `Rng`.
 * `RunState` is plain JSON (see save.ts). Relic effects reach battle.ts only
 * through `mergeRelicHooks(run.relics)`.
 *
 * Phases: relicPick (choose the opening relic) -> battle -> reward (not after
 * the last boss) -> battle -> ... -> victory | defeat.
 */
import type { Direction, Rng } from "../grid";
import type { CellPosition } from "../gridDiff";
import {
  HERO_START_HP,
  NO_UPGRADES,
  SPELL_IDS,
  applyTurn,
  castSpell,
  createBattle,
  type BattleEvent,
  type BattleState,
  type SpellFailure,
  type SpellId,
  type SpellUpgrades,
} from "./battle";
import { ENEMIES, getEnemy } from "./enemies";
import { pickDistinct } from "./intents";
import { getRelic, mergeRelicHooks } from "./relics";
import type { AdventureTrophyEvent } from "./unlocks";

/** Enemy ids in fight order: forest, ice cave, demon tower; normal, normal, boss. */
export const BATTLE_ORDER: readonly string[] = ENEMIES.map((enemy) => enemy.id);
export const TOTAL_BATTLES = BATTLE_ORDER.length;
/** Heal offered by the "回 3 血" reward. */
export const HEAL_OPTION_AMOUNT = 3;
export const OPENING_RELIC_CHOICES = 3;
export const BOSS_RELIC_CHOICES = 3;

export type RunPhase = "relicPick" | "battle" | "reward" | "victory" | "defeat";

export type RewardOption =
  | { kind: "relic"; relicId: string }
  | { kind: "upgrade"; spell: SpellId }
  | { kind: "heal"; amount: number };

/** Per-battle counters the trophies need (reset when a battle starts). */
export interface BattleStats {
  stonesBroken: number;
  /** Most pairs cleared by a single slide. */
  maxChain: number;
}

export interface RunState {
  phase: RunPhase;
  /** Index into BATTLE_ORDER of the current (or just finished) battle. */
  battleIndex: number;
  heroHp: number;
  heroMaxHp: number;
  relics: string[];
  upgrades: SpellUpgrades;
  /** Relic ids this run may offer: starter pool plus trophy unlocks at run start. */
  pool: string[];
  /** The current battle; null only in the relicPick phase. Kept after the win/loss for display. */
  battle: BattleState | null;
  stats: BattleStats;
  /** Choices while phase is relicPick or reward; empty otherwise. */
  offers: RewardOption[];
}

export interface RunStep {
  run: RunState;
  events: BattleEvent[];
  trophyEvents: AdventureTrophyEvent[];
  /** False = nothing happened (invalid swipe, illegal spell, wrong phase); `run` is the same object. */
  applied: boolean;
  reason?: SpellFailure | "wrongPhase" | "badChoice";
}

function noop(run: RunState, reason?: RunStep["reason"]): RunStep {
  return { run, events: [], trophyEvents: [], applied: false, reason };
}

const NO_STATS: BattleStats = { stonesBroken: 0, maxChain: 0 };

/** A new run: full HP, no relics, choosing 1 of 3 opening relics from `pool`. */
export function createRun(rng: Rng, pool: readonly string[]): RunState {
  const known = pool.filter((id) => getRelic(id));
  const offers = pickDistinct(known, OPENING_RELIC_CHOICES, rng).map(
    (relicId): RewardOption => ({ relicId, kind: "relic" }),
  );
  return {
    phase: "relicPick",
    battleIndex: 0,
    heroHp: HERO_START_HP,
    heroMaxHp: HERO_START_HP,
    relics: [],
    upgrades: { ...NO_UPGRADES },
    pool: [...known],
    battle: null,
    stats: { ...NO_STATS },
    offers,
  };
}

// ── rewards (spec 6) ────────────────────────────────────────────────────────

/**
 * Offers after a win. Normal fight: one random unowned relic, one random
 * not-yet-upgraded spell, and "回 3 血" (missing kinds are skipped, the heal
 * is always there). Boss: up to three different unowned relics; if none are
 * left it falls back to the normal offers. rng order: relics, then the spell.
 */
export function rollOffers(run: RunState, boss: boolean, rng: Rng): RewardOption[] {
  const owned = new Set(run.relics);
  const relicIds = run.pool.filter((id) => !owned.has(id));
  if (boss && relicIds.length > 0) {
    return pickDistinct(relicIds, BOSS_RELIC_CHOICES, rng).map((relicId): RewardOption => ({ kind: "relic", relicId }));
  }
  const offers: RewardOption[] = [];
  pickDistinct(relicIds, 1, rng).forEach((relicId) => offers.push({ kind: "relic", relicId }));
  pickDistinct(SPELL_IDS.filter((spell) => !run.upgrades[spell]), 1, rng).forEach((spell) =>
    offers.push({ kind: "upgrade", spell }),
  );
  offers.push({ kind: "heal", amount: HEAL_OPTION_AMOUNT });
  return offers;
}

function applyOffer(run: RunState, option: RewardOption): RunState {
  switch (option.kind) {
    case "relic":
      return { ...run, relics: [...run.relics, option.relicId] };
    case "upgrade":
      return { ...run, upgrades: { ...run.upgrades, [option.spell]: true } };
    case "heal":
      return { ...run, heroHp: Math.min(run.heroMaxHp, run.heroHp + option.amount) };
  }
}

function beginBattle(run: RunState, rng: Rng): { run: RunState; events: BattleEvent[] } {
  const created = createBattle(
    {
      enemyId: BATTLE_ORDER[run.battleIndex],
      heroHp: run.heroHp,
      heroMaxHp: run.heroMaxHp,
      upgrades: run.upgrades,
    },
    rng,
    mergeRelicHooks(run.relics),
  );
  return {
    run: { ...run, phase: "battle", battle: created.state, stats: { ...NO_STATS }, offers: [] },
    events: created.events,
  };
}

/**
 * Pick offer `index` in the relicPick or reward phase, then start the next
 * battle (battle 0 for relicPick).
 */
export function chooseOffer(run: RunState, index: number, rng: Rng): RunStep {
  if (run.phase !== "relicPick" && run.phase !== "reward") return noop(run, "wrongPhase");
  const option = run.offers[index];
  if (!option) return noop(run, "badChoice");
  const chosen = applyOffer(run, option);
  const next: RunState = run.phase === "reward" ? { ...chosen, battleIndex: run.battleIndex + 1 } : chosen;
  const started = beginBattle(next, rng);
  return { ...settleBattle(started.run, started.run.battle, started.events, rng), applied: true };
}

// ── playing a battle ────────────────────────────────────────────────────────

function largestSlideChain(events: BattleEvent[]): number {
  return events.reduce(
    (best, e) => (e.type === "pairCleared" && e.source === "slide" ? Math.max(best, e.count) : best),
    0,
  );
}

/**
 * Fold a battle state back into the run: copy HP, update the trophy counters,
 * and when the battle is over move the run to reward / victory / defeat
 * (a boss win first heals half the max HP, spec 6; the last boss ends the run).
 * rng is only used to roll the reward offers.
 */
function settleBattle(
  run: RunState,
  battle: BattleState | null,
  events: BattleEvent[],
  rng: Rng,
): Omit<RunStep, "applied"> {
  if (!battle) return { run, events, trophyEvents: [] };
  const stats: BattleStats = {
    stonesBroken: run.stats.stonesBroken + events.filter((e) => e.type === "stoneBroken").length,
    maxChain: Math.max(run.stats.maxChain, largestSlideChain(events)),
  };
  const next: RunState = { ...run, battle, stats, heroHp: battle.heroHp };
  if (battle.status === "ongoing") return { run: next, events, trophyEvents: [] };
  if (battle.status === "defeat") return { run: { ...next, phase: "defeat", offers: [] }, events, trophyEvents: [] };

  const enemy = getEnemy(battle.enemyId)!;
  const trophyEvents: AdventureTrophyEvent[] = [
    {
      type: "battleWon",
      enemyId: enemy.id,
      overloads: battle.overloads,
      maxChain: stats.maxChain,
      stonesBroken: stats.stonesBroken,
    },
  ];
  if (run.battleIndex === TOTAL_BATTLES - 1) {
    trophyEvents.push({ type: "runWon" });
    return { run: { ...next, phase: "victory", offers: [] }, events, trophyEvents };
  }
  const healed = enemy.boss
    ? { ...next, heroHp: Math.min(next.heroMaxHp, next.heroHp + Math.floor(next.heroMaxHp / 2)) }
    : next;
  return { run: { ...healed, phase: "reward", offers: rollOffers(healed, enemy.boss, rng) }, events, trophyEvents };
}

/** One turn (a swipe). An invalid swipe changes nothing (`applied: false`). */
export function runTurn(run: RunState, direction: Direction, rng: Rng): RunStep {
  if (run.phase !== "battle" || !run.battle) return noop(run, "wrongPhase");
  const result = applyTurn(run.battle, direction, rng, mergeRelicHooks(run.relics));
  if (result.state === run.battle) return noop(run);
  return { ...settleBattle(run, result.state, result.events, rng), applied: true };
}

/** Cast a spell (not a turn). Failures come back as `applied: false` with the reason. */
export function runCast(run: RunState, spell: SpellId, target: CellPosition | null, rng: Rng): RunStep {
  if (run.phase !== "battle" || !run.battle) return noop(run, "wrongPhase");
  const result = castSpell(run.battle, spell, target, rng, mergeRelicHooks(run.relics));
  if (!result.applied) return noop(run, result.reason);
  return { ...settleBattle(run, result.state, result.events, rng), applied: true };
}
```

- [ ] **Step 3.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure/run.test.ts && npm run test:unit && npx tsc --noEmit
```

Expected: new file `27 passed`; full unit `Test Files  31 passed (31)`, `Tests  462 passed (462)`; `tsc` clean.

- [ ] **Step 3.5: Commit**

```bash
git add workspace/src/adventure/run.ts workspace/tests/unit/adventure/runHelpers.ts workspace/tests/unit/adventure/run.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure run flow with relics, rewards and HP carry-over

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 4: Versioned, validated save/load in `src/adventure/save.ts`

**Files:**
- Create: `workspace/src/adventure/save.ts`
- Create: `workspace/tests/unit/adventure/save.test.ts`

**Interfaces:**

Consumes: `run.ts` (`RunState`, `BATTLE_ORDER`, `TOTAL_BATTLES`, `RewardOption`, `RunPhase`), `battle.ts`, `enemies.ts`, `intents.ts` (`FREEZE_TURNS`), `relics.ts`, `storage.ts`.

Produces (exported from `src/adventure/save.ts`):
```ts
export const RUN_SAVE_KEY = "mathMerge10AdventureRun";
export const RUN_SAVE_VERSION = 1;
export function validateRun(value: unknown): RunState | null;      // never throws
export function serializeRun(run: RunState): string;               // '{"version":1,"run":{...}}'
export function parseRun(raw: string | null): RunState | null;
export function saveRun(store: KeyValueStore, run: RunState): void;   // finished runs delete the save; errors swallowed
export function loadRun(store: KeyValueStore): RunState | null;       // invalid save is removed and reads as null
export function clearRun(store: KeyValueStore): void;
```

- [ ] **Step 4.1: Write the failing test**

Create `workspace/tests/unit/adventure/save.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import {
  RUN_SAVE_KEY,
  RUN_SAVE_VERSION,
  clearRun,
  loadRun,
  parseRun,
  saveRun,
  serializeRun,
  validateRun,
} from "../../../src/adventure/save";
import { chooseOffer, createRun, runTurn, type RunState } from "../../../src/adventure/run";
import { STARTER_RELIC_IDS } from "../../../src/adventure/relics";
import { gridWith, seededRng } from "./battleHelpers";
import { runInBattle } from "./runHelpers";
import { memoryStore } from "./storeHelper";

const POOL = [...STARTER_RELIC_IDS];

/** A run in the middle of battle 2 with a stone, a freeze, relics and an upgrade. */
function busyRun(): RunState {
  return runInBattle(
    gridWith([[3, STONE, 0, 7], [null, 5, null, null], [9, null, null, null]]),
    { mana: 3, enemyShield: 5, freezes: [{ row: 1, col: 1, turns: 2 }], relicData: { forestHeartUsed: 1 }, turn: 12 },
    { relics: ["chainRing", "forestHeart"], upgrades: { hammer: true, addOne: false, bomb: false, shuffle: false }, stats: { stonesBroken: 2, maxChain: 2 } },
    1,
  );
}

function rewardRun(): RunState {
  const won = runTurn(runInBattle(gridWith([[4, 6]]), { enemyHp: 10 }), "left", seededRng(2));
  return won.run;
}

describe("round trip", () => {
  it("every phase survives serialize -> parse unchanged", () => {
    const opening = createRun(seededRng(1), POOL);
    const battling = chooseOffer(opening, 0, seededRng(2)).run;
    [opening, battling, busyRun(), rewardRun()].forEach((run) => {
      expect(parseRun(serializeRun(run))).toEqual(run);
    });
  });

  it("the stored text carries the version", () => {
    expect(JSON.parse(serializeRun(busyRun()))).toMatchObject({ version: RUN_SAVE_VERSION });
  });
});

describe("saveRun / loadRun / clearRun", () => {
  it("saves under mathMerge10AdventureRun and loads it back", () => {
    const store = memoryStore();
    saveRun(store, busyRun());
    expect(RUN_SAVE_KEY).toBe("mathMerge10AdventureRun");
    expect(store.data[RUN_SAVE_KEY]).toBeDefined();
    expect(loadRun(store)).toEqual(busyRun());
  });

  it("no save means null", () => {
    expect(loadRun(memoryStore())).toBeNull();
  });

  it("clearRun deletes the save", () => {
    const store = memoryStore();
    saveRun(store, busyRun());
    clearRun(store);
    expect(loadRun(store)).toBeNull();
  });

  it("a finished run (victory or defeat) deletes the save instead of writing it", () => {
    const store = memoryStore();
    saveRun(store, busyRun());
    saveRun(store, { ...busyRun(), phase: "defeat", battle: { ...busyRun().battle!, status: "defeat" } });
    expect(store.data[RUN_SAVE_KEY]).toBeUndefined();
  });

  it("a write error never throws", () => {
    expect(() => saveRun(memoryStore({}, true), busyRun())).not.toThrow();
  });

  it("corrupt data is discarded: loadRun returns null and removes the key", () => {
    const bad = ["", "{", "null", "[]", "42", '"x"', "{\"version\":1}", '{"version":99,"run":{}}'];
    bad.forEach((raw) => {
      const store = memoryStore({ [RUN_SAVE_KEY]: raw });
      expect(loadRun(store)).toBeNull();
      expect(store.data[RUN_SAVE_KEY]).toBeUndefined();
    });
  });

  it("a version mismatch discards the save", () => {
    const store = memoryStore({ [RUN_SAVE_KEY]: JSON.stringify({ version: RUN_SAVE_VERSION + 1, run: busyRun() }) });
    expect(loadRun(store)).toBeNull();
    expect(store.data[RUN_SAVE_KEY]).toBeUndefined();
  });

  it("a store whose getItem throws reads as no save", () => {
    const store = { getItem: () => { throw new Error("denied"); }, setItem: () => {}, removeItem: () => {} };
    expect(loadRun(store)).toBeNull();
  });
});

describe("validateRun rejects impossible data (never throws)", () => {
  const mutate = (change: (run: any) => void): unknown => {
    const run = JSON.parse(JSON.stringify(busyRun()));
    change(run);
    return run;
  };

  const cases: Array<[string, (run: any) => void]> = [
    ["unknown phase", (r) => { r.phase = "lobby"; }],
    ["battleIndex out of range", (r) => { r.battleIndex = 9; }],
    ["fractional battleIndex", (r) => { r.battleIndex = 1.5; }],
    ["enemy does not match battleIndex", (r) => { r.battleIndex = 0; }],
    ["unknown enemy id", (r) => { r.battle.enemyId = "dragon"; }],
    ["enemyMaxHp edited", (r) => { r.battle.enemyMaxHp = 9999; }],
    ["enemyHp above max", (r) => { r.battle.enemyHp = 51; }],
    ["negative heroHp", (r) => { r.heroHp = -1; r.battle.heroHp = -1; }],
    ["heroHp above max", (r) => { r.heroHp = 11; r.battle.heroHp = 11; }],
    ["run and battle HP disagree", (r) => { r.battle.heroHp = 4; }],
    ["grid too small", (r) => { r.battle.grid.pop(); }],
    ["grid row too short", (r) => { r.battle.grid[0].pop(); }],
    ["tile value 10", (r) => { r.battle.grid[0][0] = 10; }],
    ["tile value -2", (r) => { r.battle.grid[0][0] = -2; }],
    ["tile is a string", (r) => { r.battle.grid[0][0] = "3"; }],
    ["freeze on an empty cell", (r) => { r.battle.freezes = [{ row: 3, col: 3, turns: 2 }]; }],
    ["freeze on a stone", (r) => { r.battle.freezes = [{ row: 0, col: 1, turns: 2 }]; }],
    ["freeze turns 0", (r) => { r.battle.freezes[0].turns = 0; }],
    ["freeze turns 9", (r) => { r.battle.freezes[0].turns = 9; }],
    ["duplicate freeze", (r) => { r.battle.freezes.push({ ...r.battle.freezes[0] }); }],
    ["intentIndex beyond the cycle", (r) => { r.battle.intentIndex = 5; }],
    ["countdown 0", (r) => { r.battle.countdown = 0; }],
    ["countdown above the slot's length", (r) => { r.battle.countdown = 99; }],
    ["negative mana", (r) => { r.battle.mana = -1; }],
    ["status is a number", (r) => { r.battle.status = 3; }],
    ["battle status disagrees with the phase", (r) => { r.battle.status = "victory"; }],
    ["upgrade flag missing", (r) => { delete r.upgrades.bomb; }],
    ["unknown relic", (r) => { r.relics = ["nope"]; }],
    ["duplicate relic", (r) => { r.relics = ["chainRing", "chainRing"]; }],
    ["pool is not an array", (r) => { r.pool = "all"; }],
    ["relicData value not a number", (r) => { r.battle.relicData = { x: "1" }; }],
    ["stats missing", (r) => { delete r.stats; }],
    ["battle missing in battle phase", (r) => { r.battle = null; }],
    ["offers pending during a battle", (r) => { r.offers = [{ kind: "heal", amount: 3 }]; }],
    ["no offers in the reward phase", (r) => { r.phase = "reward"; r.battle.status = "victory"; }],
    ["victory before the last battle", (r) => { r.phase = "victory"; r.battle.status = "victory"; }],
  ];

  it.each(cases)("%s", (_name, change) => {
    expect(validateRun(mutate(change))).toBeNull();
  });

  it("non-objects are rejected", () => {
    [null, undefined, 3, "x", [], true].forEach((v) => expect(validateRun(v)).toBeNull());
  });

  it("a relic pick with a bad offer is rejected", () => {
    const run = JSON.parse(JSON.stringify(createRun(seededRng(1), POOL)));
    run.offers[0] = { kind: "relic", relicId: "ghost" };
    expect(validateRun(run)).toBeNull();
    run.offers = [{ kind: "upgrade", spell: "fireball" }];
    expect(validateRun(run)).toBeNull();
    run.offers = [];
    expect(validateRun(run)).toBeNull();
  });

  it("a valid run with the maximum-sized numbers still passes", () => {
    const run = mutate((r) => {
      r.stats.maxChain = 8;
      r.battle.turn = 5000;
    });
    expect(validateRun(run)).not.toBeNull();
  });
});
```

- [ ] **Step 4.2: Run and see it fail**

```bash
npx vitest run tests/unit/adventure/save.test.ts
```

Expected: import failure for `src/adventure/save`, `Test Files  1 failed`.

- [ ] **Step 4.3: Implement `save.ts`**

Create `workspace/src/adventure/save.ts`:
```ts
/**
 * Saving and loading a run (spec 6.1). The whole `RunState` is stored as JSON
 * under `mathMerge10AdventureRun` with a version number. Anything that does not
 * validate (bad JSON, wrong version, impossible values) is thrown away and
 * reported as "no save"; loading never throws. A finished run (victory or
 * defeat) is not worth resuming, so saving one deletes the save instead.
 */
import { STONE } from "../grid";
import { SPELL_IDS, type BattleState, type SpellId, type SpellUpgrades } from "./battle";
import { getEnemy } from "./enemies";
import { FREEZE_TURNS } from "./intents";
import { BATTLE_ORDER, TOTAL_BATTLES, type RewardOption, type RunPhase, type RunState } from "./run";
import { getRelic } from "./relics";
import type { KeyValueStore } from "./storage";

export const RUN_SAVE_KEY = "mathMerge10AdventureRun";
export const RUN_SAVE_VERSION = 1;
const MAX_HP = 999;
const GRID_SIZE = 4;

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function parseUpgrades(value: unknown): SpellUpgrades | null {
  if (!isObj(value)) return null;
  const result = {} as SpellUpgrades;
  for (const spell of SPELL_IDS) {
    const flag = value[spell];
    if (typeof flag !== "boolean") return null;
    result[spell] = flag;
  }
  return result;
}

function parseGrid(value: unknown): BattleState["grid"] | null {
  if (!Array.isArray(value) || value.length !== GRID_SIZE) return null;
  const grid: BattleState["grid"] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== GRID_SIZE) return null;
    const out: Array<number | null> = [];
    for (const cell of row) {
      if (cell === null || cell === STONE || isInt(cell, 0, 9)) out.push(cell as number | null);
      else return null;
    }
    grid.push(out);
  }
  return grid;
}

function parseRelicData(value: unknown): Record<string, number> | null {
  if (!isObj(value)) return null;
  const keys = Object.keys(value);
  if (keys.length > 16) return null;
  const result: Record<string, number> = {};
  for (const key of keys) {
    const n = value[key];
    if (!isInt(n, -999999, 999999)) return null;
    result[key] = n;
  }
  return result;
}

function parseBattle(value: unknown): BattleState | null {
  if (!isObj(value)) return null;
  const enemy = typeof value.enemyId === "string" ? getEnemy(value.enemyId) : undefined;
  const grid = parseGrid(value.grid);
  const upgrades = parseUpgrades(value.upgrades);
  const relicData = parseRelicData(value.relicData);
  if (!enemy || !grid || !upgrades || !relicData) return null;
  if (!Array.isArray(value.freezes)) return null;

  const freezes: BattleState["freezes"] = [];
  const seen = new Set<string>();
  for (const entry of value.freezes) {
    if (!isObj(entry) || !isInt(entry.row, 0, GRID_SIZE - 1) || !isInt(entry.col, 0, GRID_SIZE - 1)) return null;
    if (!isInt(entry.turns, 1, FREEZE_TURNS)) return null;
    const cell = grid[entry.row][entry.col];
    const key = `${entry.row},${entry.col}`;
    if (cell === null || cell === STONE || seen.has(key)) return null; // a freeze needs a tile and is unique
    seen.add(key);
    freezes.push({ row: entry.row, col: entry.col, turns: entry.turns });
  }

  const { heroHp, heroMaxHp, mana, enemyHp, enemyMaxHp, enemyShield, intentIndex, countdown, turn, overloads, status } =
    value;
  if (
    !isInt(heroMaxHp, 1, MAX_HP) ||
    !isInt(heroHp, 0, heroMaxHp) ||
    !isInt(mana, 0, 9999) ||
    !isInt(enemyMaxHp, 1, 9999) ||
    enemyMaxHp !== enemy.maxHp ||
    !isInt(enemyHp, 0, enemyMaxHp) ||
    !isInt(enemyShield, 0, 99999) ||
    !isInt(intentIndex, 0, enemy.cycle.length - 1) ||
    !isInt(countdown, 1, enemy.cycle[intentIndex].countdown) ||
    !isInt(turn, 0, 999999) ||
    !isInt(overloads, 0, 999999) ||
    (status !== "ongoing" && status !== "victory" && status !== "defeat")
  ) {
    return null;
  }
  return {
    grid, freezes, heroHp, heroMaxHp, mana, enemyId: enemy.id, enemyHp, enemyMaxHp, enemyShield,
    intentIndex, countdown, upgrades, turn, overloads, relicData, status,
  };
}

function parseOffers(value: unknown): RewardOption[] | null {
  if (!Array.isArray(value) || value.length > 3) return null;
  const offers: RewardOption[] = [];
  for (const entry of value) {
    if (!isObj(entry)) return null;
    if (entry.kind === "relic" && typeof entry.relicId === "string" && getRelic(entry.relicId)) {
      offers.push({ kind: "relic", relicId: entry.relicId });
    } else if (entry.kind === "upgrade" && SPELL_IDS.includes(entry.spell as SpellId)) {
      offers.push({ kind: "upgrade", spell: entry.spell as SpellId });
    } else if (entry.kind === "heal" && isInt(entry.amount, 1, MAX_HP)) {
      offers.push({ kind: "heal", amount: entry.amount });
    } else {
      return null;
    }
  }
  return offers;
}

const PHASES: readonly RunPhase[] = ["relicPick", "battle", "reward", "victory", "defeat"];

/** Validate untrusted data into a RunState, or null. Pure; never throws. */
export function validateRun(value: unknown): RunState | null {
  if (!isObj(value)) return null;
  const phase = PHASES.find((p) => p === value.phase);
  const upgrades = parseUpgrades(value.upgrades);
  const offers = parseOffers(value.offers);
  if (!phase || !upgrades || !offers) return null;
  if (!isInt(value.battleIndex, 0, TOTAL_BATTLES - 1)) return null;
  if (!isInt(value.heroMaxHp, 1, MAX_HP) || !isInt(value.heroHp, 0, value.heroMaxHp)) return null;

  const stats = value.stats;
  if (!isObj(stats) || !isInt(stats.stonesBroken, 0, 999999) || !isInt(stats.maxChain, 0, 16)) return null;

  const relics = value.relics;
  const pool = value.pool;
  if (!Array.isArray(relics) || !Array.isArray(pool)) return null;
  if (!relics.every((id) => typeof id === "string" && getRelic(id)) || new Set(relics).size !== relics.length) return null;
  if (!pool.every((id) => typeof id === "string" && getRelic(id)) || new Set(pool).size !== pool.length) return null;
  if (relics.length > 12 || pool.length > 12) return null;

  let battle: BattleState | null = null;
  if (value.battle !== null) {
    battle = parseBattle(value.battle);
    if (!battle) return null;
  }
  const picking = phase === "relicPick" || phase === "reward";
  if (picking !== (offers.length > 0)) return null; // choices exist exactly while a choice is pending
  if (phase === "relicPick") {
    if (battle !== null || value.battleIndex !== 0 || relics.length !== 0) return null;
  } else {
    if (!battle) return null;
    if (battle.enemyId !== BATTLE_ORDER[value.battleIndex]) return null;
    const expected = phase === "battle" ? "ongoing" : phase === "defeat" ? "defeat" : "victory";
    if (battle.status !== expected) return null;
    if (phase === "battle" && battle.heroHp !== value.heroHp) return null;
  }
  if (phase === "victory" && value.battleIndex !== TOTAL_BATTLES - 1) return null;

  return {
    phase,
    battleIndex: value.battleIndex,
    heroHp: value.heroHp,
    heroMaxHp: value.heroMaxHp,
    relics: [...relics] as string[],
    upgrades,
    pool: [...pool] as string[],
    battle,
    stats: { stonesBroken: stats.stonesBroken, maxChain: stats.maxChain },
    offers,
  };
}

export function serializeRun(run: RunState): string {
  return JSON.stringify({ version: RUN_SAVE_VERSION, run });
}

/** Parse a stored string; null for null, bad JSON, a wrong version or an invalid run. */
export function parseRun(raw: string | null): RunState | null {
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isObj(data) || data.version !== RUN_SAVE_VERSION) return null;
    return validateRun(data.run);
  } catch {
    return null;
  }
}

export function clearRun(store: KeyValueStore): void {
  try {
    store.removeItem(RUN_SAVE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Save after a turn. A finished run deletes the save. Storage errors are swallowed (the run just is not saved). */
export function saveRun(store: KeyValueStore, run: RunState): void {
  if (run.phase === "victory" || run.phase === "defeat") {
    clearRun(store);
    return;
  }
  try {
    store.setItem(RUN_SAVE_KEY, serializeRun(run));
  } catch {
    /* storage full or blocked */
  }
}

/** The saved run, or null. A save that fails validation is deleted so it cannot trip the next launch. */
export function loadRun(store: KeyValueStore): RunState | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(RUN_SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const run = parseRun(raw);
  if (!run) clearRun(store);
  return run;
}
```

- [ ] **Step 4.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure/save.test.ts && npm run test:unit && npx tsc --noEmit
```

Expected: new file `49 passed`; full unit `Test Files  32 passed (32)`, `Tests  511 passed (511)`; `tsc` clean.

- [ ] **Step 4.5: Commit**

```bash
git add workspace/src/adventure/save.ts workspace/tests/unit/adventure/save.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): versioned adventure save/load that discards corrupt data

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 5: Seeded whole-run simulation

**Files:**
- Create: `workspace/tests/unit/adventure/runSimulation.test.ts`

**Interfaces:** consumes everything above; produces no new exports. A greedy bot plays whole runs (best-pairs swipe, hammer on the first tile when stuck, a swipe to trigger the overload net when poor, offer 0 for every reward) against `memoryStore`.

- [ ] **Step 5.1: Write the test (it passes at once: it exercises code from Tasks 0-4)**

Create `workspace/tests/unit/adventure/runSimulation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { slide, type Direction } from "../../../src/grid";
import { freezeMask } from "../../../src/adventure/intents";
import { STARTER_RELIC_IDS, UNLOCKABLE_RELIC_IDS } from "../../../src/adventure/relics";
import { chooseOffer, createRun, runCast, runTurn, type RunState, type RunStep } from "../../../src/adventure/run";
import { loadRun, saveRun } from "../../../src/adventure/save";
import { checkAdventureTrophies, unlockedRelicIds } from "../../../src/adventure/unlocks";
import { seededRng } from "./battleHelpers";
import { memoryStore } from "./storeHelper";

const DIRECTIONS: Direction[] = ["left", "right", "up", "down"];

/** Greedy bot: pick the choice 0 reward; swipe for the most pairs; when stuck, hammer the first tile or shuffle. */
function botStep(run: RunState, rng: () => number): RunStep {
  if (run.phase === "relicPick" || run.phase === "reward") return chooseOffer(run, 0, rng);
  const battle = run.battle!;
  const mask = freezeMask(battle.grid.length, battle.freezes);
  let best: Direction | null = null;
  let bestPairs = -1;
  for (const direction of DIRECTIONS) {
    const outcome = slide(battle.grid, direction, mask);
    if (outcome.moved && outcome.eliminatedPairs.length > bestPairs) {
      best = direction;
      bestPairs = outcome.eliminatedPairs.length;
    }
  }
  if (best) return runTurn(run, best, rng);
  const target = battle.grid.flatMap((row, r) => row.flatMap((cell, c) => (cell === null ? [] : [{ row: r, col: c }])))[0];
  if (target) {
    const cast = runCast(run, "hammer", target, rng);
    if (cast.applied) return cast;
  }
  return runTurn(run, "left", rng); // stuck and poor: the swipe triggers the overload safety net
}

interface Outcome {
  run: RunState;
  steps: number;
}

function playToEnd(start: RunState, seed: number, store = memoryStore(), maxSteps = 20000): Outcome {
  const rng = seededRng(seed);
  let run = start;
  let steps = 0;
  while (run.phase !== "victory" && run.phase !== "defeat" && steps < maxSteps) {
    const step = botStep(run, rng);
    if (!step.applied) throw new Error(`bot made a rejected move in phase ${run.phase}`);
    run = step.run;
    steps += 1;
    // invariants after every step
    expect(run.heroHp).toBeGreaterThanOrEqual(0);
    expect(run.heroHp).toBeLessThanOrEqual(run.heroMaxHp);
    if (run.phase === "battle") {
      expect(run.battle!.status).toBe("ongoing");
      expect(run.battle!.heroHp).toBe(run.heroHp);
    }
    // the save round-trips exactly at every step (finished runs delete it instead)
    saveRun(store, run);
    if (run.phase !== "victory" && run.phase !== "defeat") expect(loadRun(store)).toEqual(run);
  }
  return { run, steps };
}

describe("seeded whole-run simulation", () => {
  it("ordinary runs always end (no soft lock) and every step saves and reloads exactly", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { run, steps } = playToEnd(createRun(seededRng(seed), STARTER_RELIC_IDS), seed);
      expect(["victory", "defeat"]).toContain(run.phase);
      expect(steps).toBeLessThan(20000);
    }
  });

  it("a hero with plenty of HP walks all 9 battles to victory and earns trophies on the way", () => {
    const store = memoryStore();
    const opening = createRun(seededRng(11), [...STARTER_RELIC_IDS, ...UNLOCKABLE_RELIC_IDS]);
    const start: RunState = { ...opening, heroHp: 900, heroMaxHp: 900 };
    const events: string[] = [];
    let run = start;
    const rng = seededRng(12);
    while (run.phase !== "victory" && run.phase !== "defeat") {
      const step = botStep(run, rng);
      run = step.run;
      step.trophyEvents.forEach((event) => {
        events.push(event.type);
        checkAdventureTrophies(event, store);
      });
    }
    expect(run.phase).toBe("victory");
    expect(run.battleIndex).toBe(8);
    expect(events.filter((e) => e === "battleWon")).toHaveLength(9);
    expect(events.filter((e) => e === "runWon")).toHaveLength(1);
    expect(run.relics.length).toBeGreaterThanOrEqual(4); // 1 opening + 2 boss relics + normal-fight picks (option 0 is a relic)
    expect(unlockedRelicIds(store)).toContain("voidEye"); // first clear
    expect(unlockedRelicIds(store)).toContain("forestHeart"); // tree king
    expect(unlockedRelicIds(store)).toContain("iceShard"); // ice queen
  });

  it("is deterministic: the same seeds give the same ending", () => {
    const a = playToEnd(createRun(seededRng(3), STARTER_RELIC_IDS), 3);
    const b = playToEnd(createRun(seededRng(3), STARTER_RELIC_IDS), 3);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 5.2: Run it**

```bash
npx vitest run tests/unit/adventure/runSimulation.test.ts && npm run test:unit && npx tsc --noEmit
```

Expected: `3 passed`; full unit `Test Files  33 passed (33)`, `Tests  514 passed (514)`; `tsc` clean. The three tests: six seeded ordinary runs always end (no soft lock) and `loadRun(saveRun(run))` equals the run after every step; a 900-HP hero walks all nine battles to `victory` with 9 `battleWon` + 1 `runWon` events and earns the unlocks for 森林之心 / 冰晶棱鏡 / 虛無之眼; the same seed gives the same ending.

If a future change makes a run loop forever, the test fails at the 20 000-step cap instead of hanging.

- [ ] **Step 5.3: Commit**

```bash
git add workspace/tests/unit/adventure/runSimulation.test.ts
git commit -m "$(cat <<'EOT'
test(merge10): seeded whole-run simulation with per-step save round trip

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 6: Full verification of plan 3a

**Files:** none modified.

- [ ] **Step 6.1: Types, unit, build**

Run from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`:
```bash
npx tsc --noEmit
npm run test:unit
npm run build
```

Expected: `tsc` clean; `Test Files  33 passed (33)` and `Tests  514 passed (514)`; build prints `built in ...` with no errors. (E2E is not required: no UI, `game.ts` or `index.html` change. Nothing outside `src/adventure/` imports the new modules, so the bundle is unchanged.)

- [ ] **Step 6.2: Confirm the footprint**

```bash
git -C /Users/kyo.lai82/Projects/Personal/game-factory diff --name-status 0288303 -- workspace
```
Expected: `M workspace/src/adventure/battle.ts`, `M workspace/tests/unit/adventure/battleOverload.test.ts`, and `A` lines for `src/adventure/{relics,run,save,storage,unlocks}.ts` and `tests/unit/adventure/{battleReview,relics,run,runSimulation,save,unlocks}.test.ts` plus `tests/unit/adventure/{runHelpers,storeHelper}.ts`; nothing else.

```bash
grep -rln "adventure" /Users/kyo.lai82/Projects/Personal/game-factory/workspace/src --include=*.ts | grep -v "src/adventure/"
```
Expected: prints nothing.

---

## Self-Review (done against spec §6, §6.1, §7, §8, §9.3, §10, §11 P1 items 4-6 and the Plan 2 hand-off)

| Spec / hand-off item | Covered by |
|---|---|
| §6 3 zones x 3 fights, normal -> normal -> boss, single line | Task 3 (`BATTLE_ORDER`, test "the battle order") |
| §6 HP carries between battles; board, mana, freezes, shield reset | Task 3 (`chooseOffer` + test "HP carries ... mana, shield and freezes reset") |
| §6 normal win: pick 1 of relic / spell upgrade / heal 3 (capped) | Task 3 (`rollOffers`, `chooseOffer`, tests incl. cap and skipped kinds) |
| §6 boss win: guaranteed relic pick of 3 and heal floor(max/2) | Task 3 (`settleBattle`, tests "a boss win heals half the max HP", "three different unowned relics", fallbacks) |
| §6 defeat ends the run with the reached battle; zero lord clear ends the run | Task 3 (defeat and victory tests); display text is plan #3b |
| §6 spell upgrades, 1 level each, content decided | Plan #2 D9 (cost -1); Task 3 stores and applies them (`upgrade` offer test) |
| §6.1 serialize every step under `mathMerge10AdventureRun`, versioned | Task 4 (`saveRun`, `serializeRun`, version test); Task 5 (every simulated step round-trips) |
| §6.1 version mismatch / corrupt data discarded, no crash | Task 4 (bad-JSON, wrong-version and 39 impossible-field cases, throwing store) |
| §6.1 menu shows 繼續冒險 when a save exists | `loadRun` is the check (Task 4); the menu is plan #3b |
| §7 12 relics, 6 starter + 6 unlockable, hook-based | Task 1 (roster tests; each relic in a real battle) |
| §7 the six known relic effects exactly as specified | Task 1 ("the 6 opening relics inside real battles") |
| §7 hooks `onBattleStart`, `onPairCleared`, `onOverload`, `onStoneBroken`, `onBattleEnd` all used | Task 1 (魔力水晶/森林之心 pair, 冰晶棱鏡, 暴走之心/暴走導管, 石匠手套/熔岩核心, 生命之杖) |
| §8 adventure trophies, each unlocking one relic, no other meta progress | Task 2 (6 trophies mapped 1:1 to the 6 unlockable relics; `unlockedRelicIds`) |
| §8 spec examples: beat the tree king, first clear, 3 overloads in one battle and win | Task 2 (`adv_treeKing`, `adv_clear`, `adv_overload3`) |
| §9.3 `relics.ts`, `run.ts` (order, 3-pick, HP carry, save/load) | Tasks 1, 3, 4 |
| §9.1 pure functions, injected `Rng` | All tasks; Global Constraints; storage injected as `KeyValueStore` |
| §10 unit tests: 3-pick, relic effects, save/load incl. corrupt data, fixed seeds | Tasks 1, 3, 4, 5 |
| Plan 2 risk 3 (hook composition for 12 relics) | E5 + Task 1 composer tests (sum, max, field-wise max, clamped cost, relicData merge, unknown ids) |
| Plan 2 risk 4 (run owns HP between battles, heals after `onBattleEnd`) | Task 3 (`settleBattle` copies `battle.heroHp`, boss heal after; 生命之杖 test) |
| Plan 2 risk 5 (save/load validation list) | Task 4 (`parseBattle`: enemy id, intentIndex, countdown, grid shape and values, freezes on occupied non-stone cells, no duplicates) |
| Plan 2 risk 6 (tuning is first draft) | E14 (bot statistics recorded; P2 balance owns the numbers) |
| Plan 2 risk 7 (addOne-9 mana refund) | Unchanged on purpose (spec: counts as a pair); `runCast` test "a spell can win the fight" |
| Plan 2 risks 1, 2, 8 (renderer, event-to-animation, stuck-state UI) | Plan #3b (Tasks 1, 4, 5) |
| Review fix 1 (MEDIUM soft lock) | E1, Task 0 tests "the overload net fires when no affordable spell can act" (incl. `spellCost` hook) |
| Review fixes 2, 3, 4 (shared `NO_UPGRADES`, lone tile, nominal deltas) | E2, E4, Task 0 tests |
| Review point 5 (relic state slot, hook composer, undefined hooks, each relic fits) | E4, E5, E6; Task 0 relicData and undefined-hook tests; Task 1 |
| Not in this plan (plan #3b): renderer fixes, adventure screen, mode menu, e2e, `?seed=`, iOS sync | n/a |

Type-name consistency check: names in the Interfaces blocks are exactly those in the code: `hasPlayableSpell`, `RELICS`, `STARTER_RELIC_IDS`, `UNLOCKABLE_RELIC_IDS`, `getRelic`, `mergeRelicHooks`, `KeyValueStore`, `ADVENTURE_TROPHIES`, `AdventureTrophyEvent`, `checkAdventureTrophies`, `unlockedRelicIds`, `BATTLE_ORDER`, `RunState`, `RunStep`, `RewardOption`, `createRun`, `rollOffers`, `chooseOffer`, `runTurn`, `runCast`, `validateRun`, `parseRun`, `serializeRun`, `saveRun`, `loadRun`, `clearRun`.

Pre-validation note: all code in this plan was applied, task by task in this order, to a scratch copy of `workspace/` (outside the repo, at HEAD `0288303`) before the plan was written: `npx tsc --noEmit` clean and `npx vitest run` green after every task (unit tests 389 -> 404 -> 426 -> 435 -> 462 -> 511 -> 514, 27 -> 33 files), the final tree is byte-identical to the validated tree, and `vite build` succeeds. The exact code blocks in this plan were generated from the validated files; the red runs fail as described in each task.

## Risks and ambiguities for plan #3b

1. **`view.ts` must call `runTurn` / `runCast` / `chooseOffer` and `saveRun` after every applied step** (a `RunStep` with `applied: false` changes nothing and needs no save). `step.trophyEvents` go to `checkAdventureTrophies(event, store)`; a toast for each returned id should say the relic arrives next run (E9).
2. **A run that ended deletes its save** (`saveRun` on victory/defeat). The result screen must therefore be driven by the in-memory `RunState`, not by `loadRun`.
3. **Events for animation:** `RunStep.events` is the plan #2 event list (`slid` carries `prevGrid` / `direction` / `eliminatedPairs`, `tileSpawned` cells, `overload`, `intentFired`, ...); `chooseOffer` returns the new battle's creation events (two `tileSpawned`, optional mana/HP from relic start hooks).
4. **`BattleState.relicData`** exists on states built by plan #3a code; Plan 2's `makeState` test helper predates it, so tests that save such states use `runHelpers.runInBattle`, which adds it.
5. **Frozen walls and the elimination animation** are still unresolved at this layer (renderer, plan #3b Task 1).
6. **Mid-run trophy unlocks** apply to the next run only (E9); a view that wants the relic available immediately would have to re-roll offers, which this plan deliberately avoids.
