# Math Merge 10 Adventure Mode — Plan 2 of 3: Battle Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the pure battle-rules layer of adventure mode (spec `docs/specs/math-merge-10/adventure-mode.md` §3-§5, §9.3, §10) in `workspace/src/adventure/`: (1) `enemies.ts` with the 9 enemies' data, (2) `intents.ts` with the 5 intents plus 歸零 and the frozen-tile bookkeeping, (3) `battle.ts` with the battle state, `createBattle`, `applyTurn`, `castSpell`, the three anti-stall layers' battle-side logic (complement-bias spawning, spells, 魔力暴走), win/lose detection and a typed relic hook interface (default no-op). No DOM, no Canvas, no `index.html`, no `game.ts` change; endless mode is untouched.

**Architecture:** Everything is a pure function `state in -> { state, events } out` with an injected `Rng`. `BattleState` is plain JSON-serialisable data (the enemy is referenced by id) so plan #3 can save and load it. Plan #1's grid primitives are composed directly (`applyMove` knows nothing about strategies or masks): `slide(grid, dir, frozenMask)` -> pair damage/mana -> stone break -> enemy phase (`resolveIntent`) -> `spawnRandomTile(grid, rng, strategy)` -> overload check with `canMove(grid, frozenMask)`. Internally each public function builds a local "draft" (state + event list + resolved hooks) and applies small steps to it; the caller's state is never mutated. Relics (plan #3) plug in through `BattleHooks`: three value hooks (`chainMultiplier`, `spawnStrategy`, `spellCost`) and five event hooks (`onBattleStart`, `onPairCleared`, `onStoneBroken`, `onOverload`, `onBattleEnd`) that return a small `HookEffect` (mana / hero HP / enemy damage) which battle.ts applies itself.

**Tech Stack:** Vanilla TypeScript, vitest (`tests/unit/**/*.test.ts`, which already covers the new `tests/unit/adventure/` folder, so no config change).

**Plan series:** #1 Foundation (done, HEAD `d6762fa`) -> #2 battle rules (this plan) -> #3 run flow, relics, UI, mode menu. Plan #3 depends on the exact names in each task's **Interfaces / Produces** block and on the "Decisions made" and "Risks for plan #3" sections at the end.

---

## Global Constraints

- Work from `/Users/kyo.lai82/Projects/Personal/game-factory`; source code lives in `workspace/`. Run npm/npx commands from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`; run git commands from `/Users/kyo.lai82/Projects/Personal/game-factory`.
- Only new files are created; no existing file is modified. No edits to `grid.ts`, `powerups.ts`, `game.ts`, `index.html`, or any existing test. `src/adventure/` imports from `../grid`, `../gridDiff`, `../powerups`; nothing outside `src/adventure/` imports from it yet.
- Every function is pure: inputs are never mutated, randomness is an injected `Rng` (`() => number`), no `Math.random`, no `Date`, no module-level mutable state. All tests use scripted or seeded rngs.
- Out of scope (plan #3): relics themselves, run flow, save/load, trophies, UI/view, mode menu, renderer changes.
- Verify commands:
  - unit: `npm run test:unit` (vitest)
  - types: `npx tsc --noEmit` (only `src/**` is type-checked; test files are transpiled by vitest only)
  - build: `npm run build`
- Baseline (HEAD `d6762fa`, after plan #1): **21 unit test files, 260 unit tests passing**; `tsc --noEmit` clean.
- Expected unit-test count after each task: Task 1 -> 270, Task 2 -> 298, Task 3 -> 335, Task 4 -> 351, Task 5 -> 378, Task 6 -> 389 (27 files).
- Task order: leaf data first (enemies, intents), then `battle.ts` grown in three steps (turn pipeline, overload, spells), then a seeded regression net. `battle.ts` is created in Task 3 and edited in Tasks 4 and 5; Tasks 4 and 5 give exact find/replace edits.
- Commit trailer for every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The working tree has an unrelated deleted file (`workspace-pixel-squad/public/sprites/character_rogue.png`) and untracked `verify*.png` files; always `git add` explicit paths, never `git add -A`.
- Use `Edit` find/replace blocks exactly as written; each "find" string occurs exactly once in the file at that point.

---

## Decisions made

The spec is silent or ambiguous on these; the simplest option consistent with the spec was taken. Each is pinned by a test.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Stone-break frame (resolves plan #1 risk 1).** A stone breaks if, on the board the player swiped (pre-slide grid), it was orthogonally adjacent to either endpoint (`a` or `b`) of an eliminated pair, a frozen wall included. The stone is then located on the post-slide grid by line order (the k-th stone of its row/column before the slide is the k-th stone after, since stones never reorder, vanish, or freeze). Plan #1's `eliminationSites` (meet cells) is not used. | Meet cells are in a half-compacted frame, so post-slide adjacency to them breaks unrelated stones (`[9,1,3,S]` left would break `S`). "Touching the tiles you eliminated, on the board you were looking at" is the intuitive reading and needs no animation-frame reasoning. Reuses `breakAdjacentStones` unchanged. |
| D2 | **Frozen-wall pair (plan #1 risk 4, review point 1).** Frozen entries are positional. After every slide/spell/overload, `pruneFreezes` drops entries whose cell is empty (a consumed wall is nulled by `slideRowLeftFrozen`, and no tile slides into a vacated wall cell because segments are independent), emitting `thawed { cause: "cleared" }`. Stone break at a wall pair uses the wall's own cell as endpoint (pinned by a test: stones under the endpoints break, a stone under a meet cell that held no tile does not). | Position-based pruning is stateless and also covers hammer, bomb, overload, and addOne-on-9. |
| D3 | **addOne on 0 is allowed (plan #1 risk 5).** `0 -> 1`. Only stones are refused. | Spec 4.2 excludes only stones; plan #1's `addOneEffect` already behaves so. 0 stays removable by hammer/bomb too. |
| D4 | **Freeze timing.** Each enemy phase ticks existing freezes first (counter -1, thaw at 0), then resolves the intent. A freeze created this turn therefore blocks the next 3 slides. | Gives the full "3 回合" the spec promises; the freeze never expires on the turn it is created. |
| D5 | **Intent targets.** Freeze: any tile except stones and already-frozen tiles (a 0 tile can be frozen). Scramble and 歸零: tiles holding 1-9 only. Scramble flips its sign if +-1 would leave 1-9. Rockfall: empty cells only. All picks are uniform; `amount` = count (attack/shield: points). | Matches "有數字的格子" / "數字 ±1 維持在 1～9"; a 0 cannot be zeroed again. |
| D6 | **Kill ends the turn.** If the slide's damage (or a pair hook) kills the enemy, steps 3b-7 are skipped: no intent fires, nothing spawns. Win is checked before loss. | A dead enemy must not act; the spec's step order would give the same result except for pointless events. |
| D7 | **Overload (layer 3).** Condition: no legal slide (`canMove` with the freeze mask) AND `mana < cheapest effective spell cost` (upgrades and the `spellCost` hook included). Evaluated at the end of `applyTurn`, after every `castSpell`, and as a safety net when the player swipes an invalid direction on a still-stuck board. Effect: -2 hero HP (unless the hook cancels), clear `floor(occupied / 2)` random occupied cells (freezes ignored), `overloads += 1`. The intent counts down exactly once: inside `applyTurn` it already did; after a cast or a safety-net swipe the overload runs the enemy phase itself. If the board ends up empty one tile spawns. | Spec 4.3 says "照常 -1" but not who ticks it. Checking after casts avoids a soft lock (stuck, 0 mana, cast spent the last mana); the swipe safety net covers any remaining stuck state. |
| D8 | **Shield.** Absorbs all damage (pairs and relic damage), stacks, never decays within a battle. | Spec 5.1. |
| D9 | **Spell numbers.** Costs 2 / 2 / 4 / 3 (hammer / addOne / bomb / shuffle). The single upgrade of each spell reduces its cost by 1 (1 / 1 / 3 / 2). Upgrades are `SpellUpgrades` (4 booleans) passed in `BattleSetup`. | Spec 6 allows cost reductions for the first version; zero new effect code. |
| D10 | **Spell-removed stones.** Hammer or bomb removing a stone fires `stoneBroken { cause: "spell" }` and `onStoneBroken` (so 石匠手套 triggers); spells never cause adjacency breaks. addOne on a 9 is one pair (10 damage, +1 mana, `chain: false`) and fires `onPairCleared`. | 「碎石」 literally breaks stones. Only slide eliminations are "adjacent eliminations" in 3.4. |
| D11 | **Chain math.** For `n >= 2` pairs in one slide each pair deals `floor(10 * chainMultiplier)` (default 1.5 -> 15). Mana is +1 per pair. An invalid swipe is not a turn. | Spec 3.2. |
| D12 | **Hero HP lives in `BattleState`.** `createBattle` takes `heroHp`/`heroMaxHp`; the run layer copies `state.heroHp` out after the battle. `onBattleEnd` effects (heal) apply on victory only. | HP carries across battles (spec 6); the run layer owns it between battles. |
| D13 | **Enemy tuning** (placeholders for the P2 balance script, all in `enemies.ts`): slime 40 HP attack 1/4t; stoneGolem 50 rockfall 2/4t; treeKing 150 attack 2/5t + rockfall 3/5t; snowSprite 55 freeze 1/3t; crystalGuard 60 shield 10/5t; iceQueen 180 freeze 1/4t + shield 15/5t; spiralMage 65 scramble 1/3t; shadowBlock 80 attack 2/4t, freeze 1/3t, rockfall 2/4t, shield 8/4t; zeroLord 250 attack 3/5t, 歸零 2 tiles/4t, rockfall 2/4t, scramble 1/3t, shield 15/5t. | Within the spec's HP ranges; hero attack damage is deliberately small (hero HP 10 must last 9 fights). |
| D14 | **Initial board.** Two tiles via the normal spawn path (so a relic's spawn strategy applies); mana starts 0, then `onBattleStart` runs. | Same as endless mode's start, no new rule. |

## Open questions for the user

None. (Numbers in D9/D13 are first-draft tuning in the spirit of spec 3.2 and are isolated in `enemies.ts` / the `SPELLS` table.)

---

### Task 1: Enemy data in `src/adventure/enemies.ts`

**Files:**
- Create: `workspace/src/adventure/enemies.ts`
- Create: `workspace/tests/unit/adventure/enemies.test.ts`

**Interfaces:**

Consumes: nothing.

Produces (exported from `src/adventure/enemies.ts`):
```ts
export type IntentKind = "attack" | "rockfall" | "freeze" | "shield" | "scramble" | "zero";
export interface Intent { kind: IntentKind; amount: number }
export interface IntentSlot { intent: Intent; countdown: number }
export type Zone = "forest" | "ice" | "tower";
export type EnemyShape = "circle" | "square" | "triangle" | "snowflake" | "diamond" | "hexagon" | "spiral" | "shadowSquare" | "ring";
export interface EnemyDef { id: string; name: string; zone: Zone; boss: boolean; maxHp: number; shape: EnemyShape; color: string; cycle: IntentSlot[] }
export const ENEMIES: readonly EnemyDef[];            // 9, in run order
export function getEnemy(id: string): EnemyDef | undefined;
```
`amount` means: attack = hero damage, rockfall = stones, freeze = tiles, shield = points, scramble = tiles changed, zero = tiles zeroed. `countdown` is the number of turns the intent is telegraphed.

- [ ] **Step 1.1: Write the failing test**

Create `workspace/tests/unit/adventure/enemies.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ENEMIES, getEnemy, type IntentKind } from "../../../src/adventure/enemies";

describe("ENEMIES roster (spec 5.2)", () => {
  it("has 9 enemies in run order: forest, ice, tower; normal, normal, boss", () => {
    expect(ENEMIES.map((e) => e.id)).toEqual([
      "slime", "stoneGolem", "treeKing",
      "snowSprite", "crystalGuard", "iceQueen",
      "spiralMage", "shadowBlock", "zeroLord",
    ]);
    expect(ENEMIES.map((e) => e.zone)).toEqual([
      "forest", "forest", "forest", "ice", "ice", "ice", "tower", "tower", "tower",
    ]);
    expect(ENEMIES.map((e) => e.boss)).toEqual([
      false, false, true, false, false, true, false, false, true,
    ]);
  });

  it("ids are unique", () => {
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(9);
  });

  it("normal enemies have 40-80 HP and bosses 150-250 HP (spec 3.2)", () => {
    ENEMIES.forEach((e) => {
      if (e.boss) {
        expect(e.maxHp).toBeGreaterThanOrEqual(150);
        expect(e.maxHp).toBeLessThanOrEqual(250);
      } else {
        expect(e.maxHp).toBeGreaterThanOrEqual(40);
        expect(e.maxHp).toBeLessThanOrEqual(80);
      }
    });
  });

  it("every enemy has a non-empty action cycle with positive integer countdowns", () => {
    ENEMIES.forEach((e) => {
      expect(e.cycle.length).toBeGreaterThan(0);
      e.cycle.forEach((slot) => {
        expect(Number.isInteger(slot.countdown)).toBe(true);
        expect(slot.countdown).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(slot.intent.amount)).toBe(true);
        expect(slot.intent.amount).toBeGreaterThanOrEqual(1);
      });
    });
  });

  it("every enemy has a shape name and a #rrggbb colour", () => {
    ENEMIES.forEach((e) => {
      expect(e.shape.length).toBeGreaterThan(0);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it("normal enemies follow their spec theme", () => {
    const kinds = (id: string): IntentKind[] => getEnemy(id)!.cycle.map((s) => s.intent.kind);
    expect(kinds("slime")).toEqual(["attack"]);
    expect(kinds("stoneGolem")).toEqual(["rockfall"]);
    expect(kinds("snowSprite")).toEqual(["freeze"]);
    expect(kinds("crystalGuard")).toEqual(["shield"]);
    expect(kinds("spiralMage")).toEqual(["scramble"]);
    // 暗影方陣 is the mixed enemy: at least 3 different intent kinds
    expect(new Set(kinds("shadowBlock")).size).toBeGreaterThanOrEqual(3);
  });

  it("bosses alternate as in the spec", () => {
    const kinds = (id: string): IntentKind[] => getEnemy(id)!.cycle.map((s) => s.intent.kind);
    expect(kinds("treeKing")).toEqual(["attack", "rockfall"]);
    expect(kinds("iceQueen")).toEqual(["freeze", "shield"]);
    expect(kinds("zeroLord")).toContain("zero");
  });

  it("only the zero lord has the 歸零 intent, and it zeroes 2 cells", () => {
    ENEMIES.forEach((e) => {
      const hasZero = e.cycle.some((s) => s.intent.kind === "zero");
      expect(hasZero).toBe(e.id === "zeroLord");
    });
    const zero = getEnemy("zeroLord")!.cycle.find((s) => s.intent.kind === "zero")!;
    expect(zero.intent.amount).toBe(2);
  });
});

describe("getEnemy", () => {
  it("looks an enemy up by id", () => {
    expect(getEnemy("slime")?.name).toBe("圓史萊姆");
  });

  it("returns undefined for an unknown id (corrupt save data)", () => {
    expect(getEnemy("nope")).toBeUndefined();
    expect(getEnemy("")).toBeUndefined();
  });
});
```

- [ ] **Step 1.2: Run it and see it fail**

```bash
npx vitest run tests/unit/adventure/enemies.test.ts
```
Expected: FAIL (`Failed to resolve import "../../../src/adventure/enemies"`).

- [ ] **Step 1.3: Implement**

Create `workspace/src/adventure/enemies.ts`:
```ts
/**
 * Adventure-mode enemy data (spec 5.1 / 5.2). Pure data, no logic: every HP,
 * action cycle and countdown number lives here so balance passes only touch
 * this file. All numbers are first-draft tuning values (spec 3.2: "初稿").
 */

export type IntentKind = "attack" | "rockfall" | "freeze" | "shield" | "scramble" | "zero";

/**
 * One enemy action. `amount` means, per kind:
 * attack = hero damage, rockfall = stones to drop, freeze = tiles to freeze,
 * shield = shield points gained, scramble = tiles changed by +-1, zero = tiles turned into 0.
 */
export interface Intent {
  kind: IntentKind;
  amount: number;
}

/** An intent plus how many turns the enemy telegraphs it before it fires. */
export interface IntentSlot {
  intent: Intent;
  countdown: number;
}

export type Zone = "forest" | "ice" | "tower";

/** Geometric shape name the view layer draws on the canvas. */
export type EnemyShape =
  | "circle"
  | "square"
  | "triangle"
  | "snowflake"
  | "diamond"
  | "hexagon"
  | "spiral"
  | "shadowSquare"
  | "ring";

export interface EnemyDef {
  id: string;
  name: string;
  zone: Zone;
  boss: boolean;
  maxHp: number;
  shape: EnemyShape;
  /** CSS colour, `#rrggbb`. */
  color: string;
  /** Fixed action cycle: after the last slot the enemy starts again at slot 0. */
  cycle: IntentSlot[];
}

function slot(kind: IntentKind, amount: number, countdown: number): IntentSlot {
  return { intent: { kind, amount }, countdown };
}

/** The 9 enemies in run order (3 zones x normal, normal, boss), spec 6. */
export const ENEMIES: readonly EnemyDef[] = [
  // Forest
  { id: "slime", name: "圓史萊姆", zone: "forest", boss: false, maxHp: 40, shape: "circle", color: "#86efac",
    cycle: [slot("attack", 1, 4)] },
  { id: "stoneGolem", name: "方塊石像", zone: "forest", boss: false, maxHp: 50, shape: "square", color: "#a16207",
    cycle: [slot("rockfall", 2, 4)] },
  { id: "treeKing", name: "三角樹王", zone: "forest", boss: true, maxHp: 150, shape: "triangle", color: "#15803d",
    cycle: [slot("attack", 2, 5), slot("rockfall", 3, 5)] },
  // Ice cave
  { id: "snowSprite", name: "雪花精", zone: "ice", boss: false, maxHp: 55, shape: "snowflake", color: "#bae6fd",
    cycle: [slot("freeze", 1, 3)] },
  { id: "crystalGuard", name: "菱晶盾衛", zone: "ice", boss: false, maxHp: 60, shape: "diamond", color: "#67e8f9",
    cycle: [slot("shield", 10, 5)] },
  { id: "iceQueen", name: "六角冰后", zone: "ice", boss: true, maxHp: 180, shape: "hexagon", color: "#38bdf8",
    cycle: [slot("freeze", 1, 4), slot("shield", 15, 5)] },
  // Demon tower
  { id: "spiralMage", name: "螺旋術士", zone: "tower", boss: false, maxHp: 65, shape: "spiral", color: "#c084fc",
    cycle: [slot("scramble", 1, 3)] },
  { id: "shadowBlock", name: "暗影方陣", zone: "tower", boss: false, maxHp: 80, shape: "shadowSquare", color: "#475569",
    cycle: [slot("attack", 2, 4), slot("freeze", 1, 3), slot("rockfall", 2, 4), slot("shield", 8, 4)] },
  { id: "zeroLord", name: "零之魔王", zone: "tower", boss: true, maxHp: 250, shape: "ring", color: "#f43f5e",
    cycle: [slot("attack", 3, 5), slot("zero", 2, 4), slot("rockfall", 2, 4), slot("scramble", 1, 3), slot("shield", 15, 5)] },
];

/** Look an enemy up by id; undefined for unknown ids so save loading can reject corrupt data. */
export function getEnemy(id: string): EnemyDef | undefined {
  return ENEMIES.find((enemy) => enemy.id === id);
}
```

- [ ] **Step 1.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure/enemies.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `10 passed`; full unit `Tests  270 passed (270)`; `tsc` clean.

- [ ] **Step 1.5: Commit**

```bash
git add workspace/src/adventure/enemies.ts workspace/tests/unit/adventure/enemies.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure enemy roster with intent cycles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 2: Intents and freeze bookkeeping in `src/adventure/intents.ts`

**Files:**
- Create: `workspace/src/adventure/intents.ts`
- Create: `workspace/tests/unit/adventure/intents.test.ts`

**Interfaces:**

Consumes: `STONE`, `GameGrid`, `Rng`, `FrozenMask` from `../grid`; `CellPosition` from `../gridDiff`; `Intent` from `./enemies`.

Produces (exported from `src/adventure/intents.ts`):
```ts
export const FREEZE_TURNS: number;                        // 3
export interface FreezeEntry { row: number; col: number; turns: number }
export interface IntentBoard { grid: GameGrid; freezes: FreezeEntry[]; heroHp: number; enemyShield: number }
export type IntentEffect =
  | { kind: "attack"; damage: number } | { kind: "rockfall"; placed: CellPosition[] }
  | { kind: "freeze"; frozen: CellPosition[] } | { kind: "shield"; gained: number }
  | { kind: "scramble"; changed: Array<{ row: number; col: number; from: number; to: number }> }
  | { kind: "zero"; zeroed: CellPosition[] };
export interface IntentResolution { board: IntentBoard; effect: IntentEffect }
export function freezeMask(size: number, freezes: readonly FreezeEntry[]): FrozenMask;
export function tickFreezes(freezes): { freezes: FreezeEntry[]; thawed: CellPosition[] };
export function pruneFreezes(grid, freezes): { freezes: FreezeEntry[]; removed: CellPosition[] };
export function pickDistinct<T>(items: readonly T[], count: number, rng: Rng): T[];
export function resolveAttack(board, amount): IntentResolution;
export function resolveRockfall(board, count, rng): IntentResolution;
export function resolveFreeze(board, count, rng): IntentResolution;
export function resolveShield(board, amount): IntentResolution;
export function resolveScramble(board, count, rng): IntentResolution;
export function resolveZero(board, count, rng): IntentResolution;
export function resolveIntent(board, intent: Intent, rng): IntentResolution;
```
rng contract (tests rely on it): `pickDistinct` is a partial Fisher-Yates, one call per pick (`j = i + floor(rng() * (n - i))`); candidate lists are row-major. Scramble uses, per tile, one call to pick the tile (`floor(rng() * remaining)`) and one for the sign (`>= 0.5` = +1). Attack and shield use no rng.

- [ ] **Step 2.1: Write the failing test**

Create `workspace/tests/unit/adventure/intents.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE, createEmptyGrid, type GameGrid } from "../../../src/grid";
import {
  FREEZE_TURNS,
  freezeMask,
  pickDistinct,
  pruneFreezes,
  resolveAttack,
  resolveFreeze,
  resolveIntent,
  resolveRockfall,
  resolveScramble,
  resolveShield,
  resolveZero,
  tickFreezes,
  type IntentBoard,
} from "../../../src/adventure/intents";

/** rng that returns the scripted values in order, then 0 forever. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

function board(grid: GameGrid, extra: Partial<IntentBoard> = {}): IntentBoard {
  return { grid, freezes: [], heroHp: 10, enemyShield: 0, ...extra };
}

describe("pickDistinct", () => {
  it("picks count distinct items with one rng call per pick (partial Fisher-Yates)", () => {
    expect(pickDistinct(["a", "b", "c", "d"], 2, scripted(0, 0))).toEqual(["a", "b"]);
    expect(pickDistinct(["a", "b", "c", "d"], 2, scripted(0.99, 0))).toEqual(["d", "b"]);
  });

  it("returns all items when count exceeds the list, and does not mutate the input", () => {
    const items = [1, 2, 3];
    expect(pickDistinct(items, 9, () => 0).sort()).toEqual([1, 2, 3]);
    expect(items).toEqual([1, 2, 3]);
  });

  it("returns an empty list for count 0 without calling rng", () => {
    let calls = 0;
    expect(pickDistinct([1, 2], 0, () => (calls += 1, 0))).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("resolveAttack", () => {
  it("removes N hero HP and reports the damage", () => {
    const result = resolveAttack(board(createEmptyGrid(4), { heroHp: 10 }), 3);
    expect(result.board.heroHp).toBe(7);
    expect(result.effect).toEqual({ kind: "attack", damage: 3 });
  });

  it("never drops hero HP below 0 and reports the real damage", () => {
    const result = resolveAttack(board(createEmptyGrid(4), { heroHp: 2 }), 5);
    expect(result.board.heroHp).toBe(0);
    expect(result.effect).toEqual({ kind: "attack", damage: 2 });
  });
});

describe("resolveRockfall", () => {
  it("drops K stones on random empty cells (row-major candidate list, one rng call per stone)", () => {
    const grid = createEmptyGrid(4);
    const result = resolveRockfall(board(grid), 2, scripted(0, 0));
    expect(result.board.grid[0][0]).toBe(STONE);
    expect(result.board.grid[0][1]).toBe(STONE);
    expect(result.effect).toEqual({
      kind: "rockfall",
      placed: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    });
  });

  it("only uses empty cells", () => {
    const grid: GameGrid = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, null, 7],
    ];
    const result = resolveRockfall(board(grid), 1, () => 0.99);
    expect(result.board.grid[3][2]).toBe(STONE);
    expect(result.effect).toEqual({ kind: "rockfall", placed: [{ row: 3, col: 2 }] });
  });

  it("fills every empty cell when there are fewer than K", () => {
    const grid: GameGrid = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, null, null],
    ];
    const result = resolveRockfall(board(grid), 5, () => 0);
    expect(result.board.grid[3][2]).toBe(STONE);
    expect(result.board.grid[3][3]).toBe(STONE);
    expect((result.effect as { placed: unknown[] }).placed).toHaveLength(2);
  });

  it("places nothing on a full board and returns the same grid object", () => {
    const grid: GameGrid = [[1, 2], [3, 4]];
    const result = resolveRockfall(board(grid), 3, () => 0);
    expect(result.board.grid).toBe(grid);
    expect(result.effect).toEqual({ kind: "rockfall", placed: [] });
  });

  it("does not mutate the input grid", () => {
    const grid = createEmptyGrid(4);
    resolveRockfall(board(grid), 3, () => 0.5);
    expect(grid).toEqual(createEmptyGrid(4));
  });
});

describe("freeze helpers", () => {
  it("FREEZE_TURNS is 3 (spec 5.1)", () => {
    expect(FREEZE_TURNS).toBe(3);
  });

  it("freezeMask marks the frozen cells", () => {
    const mask = freezeMask(4, [{ row: 1, col: 2, turns: 3 }, { row: 3, col: 0, turns: 1 }]);
    expect(mask).toHaveLength(4);
    expect(mask[1][2]).toBe(true);
    expect(mask[3][0]).toBe(true);
    expect(mask.flat().filter(Boolean)).toHaveLength(2);
  });

  it("tickFreezes lowers every counter and thaws the ones that reach 0", () => {
    const result = tickFreezes([{ row: 0, col: 0, turns: 3 }, { row: 1, col: 1, turns: 1 }]);
    expect(result.freezes).toEqual([{ row: 0, col: 0, turns: 2 }]);
    expect(result.thawed).toEqual([{ row: 1, col: 1 }]);
  });

  it("pruneFreezes drops entries whose cell is empty or holds a stone", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 5;
    grid[2][2] = STONE;
    const result = pruneFreezes(grid, [
      { row: 0, col: 0, turns: 2 },
      { row: 1, col: 1, turns: 2 },
      { row: 2, col: 2, turns: 2 },
    ]);
    expect(result.freezes).toEqual([{ row: 0, col: 0, turns: 2 }]);
    expect(result.removed).toEqual([{ row: 1, col: 1 }, { row: 2, col: 2 }]);
  });
});

describe("resolveFreeze", () => {
  it("freezes a random numeric tile for 3 turns", () => {
    const grid = createEmptyGrid(4);
    grid[0][1] = 4;
    grid[2][3] = 7;
    const result = resolveFreeze(board(grid), 1, scripted(0.99));
    expect(result.board.freezes).toEqual([{ row: 2, col: 3, turns: 3 }]);
    expect(result.effect).toEqual({ kind: "freeze", frozen: [{ row: 2, col: 3 }] });
  });

  it("skips stones, empty cells and already frozen tiles", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 4;
    grid[0][2] = 6;
    const result = resolveFreeze(board(grid, { freezes: [{ row: 0, col: 1, turns: 2 }] }), 1, () => 0);
    expect(result.board.freezes).toEqual([
      { row: 0, col: 1, turns: 2 },
      { row: 0, col: 2, turns: 3 },
    ]);
  });

  it("can freeze a 0 tile", () => {
    const grid = createEmptyGrid(4);
    grid[1][1] = 0;
    const result = resolveFreeze(board(grid), 1, () => 0);
    expect(result.board.freezes).toEqual([{ row: 1, col: 1, turns: 3 }]);
  });

  it("does nothing when there is no tile to freeze", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    const input = board(grid);
    const result = resolveFreeze(input, 1, () => 0);
    expect(result.board.freezes).toEqual([]);
    expect(result.effect).toEqual({ kind: "freeze", frozen: [] });
  });
});

describe("resolveShield", () => {
  it("adds N shield and accumulates", () => {
    const first = resolveShield(board(createEmptyGrid(4)), 10);
    expect(first.board.enemyShield).toBe(10);
    expect(first.effect).toEqual({ kind: "shield", gained: 10 });
    const second = resolveShield(first.board, 5);
    expect(second.board.enemyShield).toBe(15);
  });
});

describe("resolveScramble", () => {
  function oneTile(value: number): GameGrid {
    const grid = createEmptyGrid(4);
    grid[1][1] = value;
    return grid;
  }

  it("changes a random 1-9 tile by +1 when the sign roll is >= 0.5", () => {
    const result = resolveScramble(board(oneTile(5)), 1, scripted(0, 0.9));
    expect(result.board.grid[1][1]).toBe(6);
    expect(result.effect).toEqual({ kind: "scramble", changed: [{ row: 1, col: 1, from: 5, to: 6 }] });
  });

  it("changes by -1 when the sign roll is < 0.5", () => {
    const result = resolveScramble(board(oneTile(5)), 1, scripted(0, 0.1));
    expect(result.board.grid[1][1]).toBe(4);
  });

  it("keeps the result inside 1-9: a 1 can only go up, a 9 only down", () => {
    expect(resolveScramble(board(oneTile(1)), 1, scripted(0, 0.1)).board.grid[1][1]).toBe(2);
    expect(resolveScramble(board(oneTile(9)), 1, scripted(0, 0.9)).board.grid[1][1]).toBe(8);
  });

  it("never touches stones, 0 or empty cells", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 0;
    const result = resolveScramble(board(grid), 1, () => 0);
    expect(result.board.grid).toBe(grid);
    expect(result.effect).toEqual({ kind: "scramble", changed: [] });
  });

  it("does not mutate the input grid", () => {
    const grid = oneTile(5);
    resolveScramble(board(grid), 1, () => 0.9);
    expect(grid[1][1]).toBe(5);
  });
});

describe("resolveZero (歸零)", () => {
  it("turns 2 distinct random 1-9 tiles into 0", () => {
    const grid: GameGrid = [
      [1, 2, 3, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const result = resolveZero(board(grid), 2, scripted(0, 0));
    expect(result.board.grid[0]).toEqual([0, 0, 3, null]);
    expect(result.effect).toEqual({
      kind: "zero",
      zeroed: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    });
  });

  it("skips stones, existing 0s and empty cells; zeroes fewer when not enough tiles", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 0;
    grid[0][2] = 8;
    const result = resolveZero(board(grid), 2, () => 0);
    expect(result.board.grid[0]).toEqual([STONE, 0, 0, null]);
    expect(result.effect).toEqual({ kind: "zero", zeroed: [{ row: 0, col: 2 }] });
  });

  it("zeroed tiles can never pair with 1-9 (0 + n != 10)", () => {
    for (let n = 1; n <= 9; n++) expect(0 + n).not.toBe(10);
  });
});

describe("resolveIntent dispatcher", () => {
  it("routes every kind to its function", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 5;
    const b = board(grid);
    expect(resolveIntent(b, { kind: "attack", amount: 2 }, () => 0).effect.kind).toBe("attack");
    expect(resolveIntent(b, { kind: "rockfall", amount: 1 }, () => 0).effect.kind).toBe("rockfall");
    expect(resolveIntent(b, { kind: "freeze", amount: 1 }, () => 0).effect.kind).toBe("freeze");
    expect(resolveIntent(b, { kind: "shield", amount: 4 }, () => 0).effect.kind).toBe("shield");
    expect(resolveIntent(b, { kind: "scramble", amount: 1 }, () => 0).effect.kind).toBe("scramble");
    expect(resolveIntent(b, { kind: "zero", amount: 1 }, () => 0).effect.kind).toBe("zero");
  });
});
```

- [ ] **Step 2.2: Run it and see it fail**

```bash
npx vitest run tests/unit/adventure/intents.test.ts
```
Expected: FAIL (`Failed to resolve import "../../../src/adventure/intents"`).

- [ ] **Step 2.3: Implement**

Create `workspace/src/adventure/intents.ts`:
```ts
/**
 * The enemy intents (spec 5.1) and the zero-lord's 歸零 as pure functions.
 * Each takes an `IntentBoard` (the slice of battle state an intent may touch)
 * and returns a new board plus an `IntentEffect` describing what happened, for
 * the view layer's events. Randomness is an injected `Rng`; inputs are never mutated.
 */
import { STONE, type GameGrid, type Rng, type FrozenMask } from "../grid";
import type { CellPosition } from "../gridDiff";
import type { Intent } from "./enemies";

/** How many turns a freeze intent freezes a tile (spec 5.1). */
export const FREEZE_TURNS = 3;

/** One frozen tile. `turns` is the number of remaining turns it stays frozen. */
export interface FreezeEntry {
  row: number;
  col: number;
  turns: number;
}

export interface IntentBoard {
  grid: GameGrid;
  freezes: FreezeEntry[];
  heroHp: number;
  enemyShield: number;
}

export type IntentEffect =
  | { kind: "attack"; damage: number }
  | { kind: "rockfall"; placed: CellPosition[] }
  | { kind: "freeze"; frozen: CellPosition[] }
  | { kind: "shield"; gained: number }
  | { kind: "scramble"; changed: Array<{ row: number; col: number; from: number; to: number }> }
  | { kind: "zero"; zeroed: CellPosition[] };

export interface IntentResolution {
  board: IntentBoard;
  effect: IntentEffect;
}

// ── freeze bookkeeping ──────────────────────────────────────────────────────

/** Board-shaped boolean mask for `slide` / `canMove` / `isGameOver` / `shuffleEffect`. */
export function freezeMask(size: number, freezes: readonly FreezeEntry[]): FrozenMask {
  const mask: FrozenMask = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  freezes.forEach(({ row, col }) => {
    if (mask[row]?.[col] !== undefined) mask[row][col] = true;
  });
  return mask;
}

/** Lower every counter by one; entries that reach 0 thaw. */
export function tickFreezes(freezes: readonly FreezeEntry[]): {
  freezes: FreezeEntry[];
  thawed: CellPosition[];
} {
  const next: FreezeEntry[] = [];
  const thawed: CellPosition[] = [];
  freezes.forEach((entry) => {
    if (entry.turns - 1 > 0) next.push({ ...entry, turns: entry.turns - 1 });
    else thawed.push({ row: entry.row, col: entry.col });
  });
  return { freezes: next, thawed };
}

/** Drop freezes whose cell no longer holds a tile (eliminated, cleared) or holds a stone. */
export function pruneFreezes(
  grid: GameGrid,
  freezes: readonly FreezeEntry[],
): { freezes: FreezeEntry[]; removed: CellPosition[] } {
  const kept: FreezeEntry[] = [];
  const removed: CellPosition[] = [];
  freezes.forEach((entry) => {
    const cell = grid[entry.row]?.[entry.col];
    if (cell === null || cell === undefined || cell === STONE) {
      removed.push({ row: entry.row, col: entry.col });
    } else {
      kept.push(entry);
    }
  });
  return { freezes: kept, removed };
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Pick `count` distinct items (partial Fisher-Yates): one rng call per pick,
 * for i in 0..count-1: j = i + floor(rng() * (n - i)). Does not mutate `items`.
 */
export function pickDistinct<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const take = Math.min(count, pool.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}

function cellsWhere(grid: GameGrid, test: (cell: number | null) => boolean): CellPosition[] {
  const cells: CellPosition[] = [];
  grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (test(cell)) cells.push({ row: r, col: c });
    }),
  );
  return cells;
}

function withCells(grid: GameGrid, cells: CellPosition[], valueAt: (p: CellPosition) => number): GameGrid {
  const next = grid.map((row) => [...row]);
  cells.forEach((p) => {
    next[p.row][p.col] = valueAt(p);
  });
  return next;
}

// ── the intents ─────────────────────────────────────────────────────────────

/** ⚔ Attack N: the hero loses N HP (never below 0). */
export function resolveAttack(board: IntentBoard, amount: number): IntentResolution {
  const heroHp = Math.max(0, board.heroHp - amount);
  return {
    board: { ...board, heroHp },
    effect: { kind: "attack", damage: board.heroHp - heroHp },
  };
}

/** 🪨 Rockfall K: stones on K random empty cells (all of them if fewer are empty). */
export function resolveRockfall(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const empties = cellsWhere(board.grid, (cell) => cell === null);
  const placed = pickDistinct(empties, count, rng);
  if (placed.length === 0) {
    return { board, effect: { kind: "rockfall", placed: [] } };
  }
  return {
    board: { ...board, grid: withCells(board.grid, placed, () => STONE) },
    effect: { kind: "rockfall", placed },
  };
}

/** ❄ Freeze: `count` random tiles (anything but stones, empty cells and already frozen tiles) for 3 turns. */
export function resolveFreeze(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const alreadyFrozen = new Set(board.freezes.map(({ row, col }) => `${row},${col}`));
  const candidates = cellsWhere(
    board.grid,
    (cell) => cell !== null && cell !== STONE,
  ).filter(({ row, col }) => !alreadyFrozen.has(`${row},${col}`));
  const frozen = pickDistinct(candidates, count, rng);
  return {
    board: {
      ...board,
      freezes: [...board.freezes, ...frozen.map(({ row, col }) => ({ row, col, turns: FREEZE_TURNS }))],
    },
    effect: { kind: "freeze", frozen },
  };
}

/** 🛡 Shield N: shield points stack. */
export function resolveShield(board: IntentBoard, amount: number): IntentResolution {
  return {
    board: { ...board, enemyShield: board.enemyShield + amount },
    effect: { kind: "shield", gained: amount },
  };
}

/**
 * 🌀 Scramble: `count` random 1-9 tiles change by +-1, staying in 1-9.
 * rng per tile: one call to pick the tile, one for the sign (>= 0.5 means +1);
 * a sign that would leave 1-9 is flipped (1 can only go up, 9 only down).
 */
export function resolveScramble(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const candidates = cellsWhere(board.grid, (cell) => cell !== null && cell >= 1 && cell <= 9);
  const changed: Array<{ row: number; col: number; from: number; to: number }> = [];
  const pool = [...candidates];
  const take = Math.min(count, pool.length);
  for (let n = 0; n < take; n++) {
    const index = Math.floor(rng() * pool.length);
    const [pos] = pool.splice(index, 1);
    const from = board.grid[pos.row][pos.col] as number;
    let delta = rng() >= 0.5 ? 1 : -1;
    if (from + delta < 1 || from + delta > 9) delta = -delta;
    changed.push({ row: pos.row, col: pos.col, from, to: from + delta });
  }
  if (changed.length === 0) {
    return { board, effect: { kind: "scramble", changed } };
  }
  const grid = board.grid.map((row) => [...row]);
  changed.forEach(({ row, col, to }) => {
    grid[row][col] = to;
  });
  return { board: { ...board, grid }, effect: { kind: "scramble", changed } };
}

/** ⭕ 歸零 (zero lord only): `count` random 1-9 tiles become 0, which can never pair with 1-9. */
export function resolveZero(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const candidates = cellsWhere(board.grid, (cell) => cell !== null && cell >= 1 && cell <= 9);
  const zeroed = pickDistinct(candidates, count, rng);
  if (zeroed.length === 0) {
    return { board, effect: { kind: "zero", zeroed } };
  }
  return {
    board: { ...board, grid: withCells(board.grid, zeroed, () => 0) },
    effect: { kind: "zero", zeroed },
  };
}

/** Run one intent against the board. */
export function resolveIntent(board: IntentBoard, intent: Intent, rng: Rng): IntentResolution {
  switch (intent.kind) {
    case "attack":
      return resolveAttack(board, intent.amount);
    case "rockfall":
      return resolveRockfall(board, intent.amount, rng);
    case "freeze":
      return resolveFreeze(board, intent.amount, rng);
    case "shield":
      return resolveShield(board, intent.amount);
    case "scramble":
      return resolveScramble(board, intent.amount, rng);
    case "zero":
      return resolveZero(board, intent.amount, rng);
  }
}
```

- [ ] **Step 2.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure/intents.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `28 passed`; full unit `Tests  298 passed (298)`; `tsc` clean.

- [ ] **Step 2.5: Commit**

```bash
git add workspace/src/adventure/intents.ts workspace/tests/unit/adventure/intents.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure intents, zero-lord effect and freeze bookkeeping

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 3: Battle state, hooks and the turn pipeline in `src/adventure/battle.ts`

Implements spec 3.1 steps 1-5 and 7 (slide with frozen mask and stones, pair damage with chains, mana, stone break, freeze bookkeeping, enemy intent resolution, complement-bias spawn, win/lose) plus the typed hook interface and the spell cost table. Overload (step 6) comes in Task 4 and `castSpell` in Task 5; `applyTurn` has a marked placeholder comment for the overload check.

**Files:**
- Create: `workspace/src/adventure/battle.ts`
- Create: `workspace/tests/unit/adventure/battleHelpers.ts` (shared test helpers; not a test file, vitest does not collect it)
- Create: `workspace/tests/unit/adventure/battleTurn.test.ts`

**Interfaces:**

Consumes: `slide`, `spawnRandomTile`, `breakAdjacentStones`, `COMPLEMENT_BIAS`, `STONE`, `Direction`, `EliminatedPair`, `GameGrid`, `Rng`, `SpawnStrategy` (`../grid`, plan #1); `changedCells`, `CellPosition` (`../gridDiff`); `PowerupId` (`../powerups`); `getEnemy`, `EnemyDef`, `Intent` (`./enemies`); `freezeMask`, `pruneFreezes`, `tickFreezes`, `resolveIntent`, `FreezeEntry`, `IntentEffect` (`./intents`).

Produces (exported from `src/adventure/battle.ts`; plan #3 calls these names):
```ts
export const GRID_SIZE: number;            // 4
export const HERO_START_HP: number;        // 10
export const PAIR_DAMAGE: number;          // 10
export const PAIR_MANA: number;            // 1
export const BASE_CHAIN_MULTIPLIER: number;// 1.5
export const OVERLOAD_HP_LOSS: number;     // 2

export type SpellId = PowerupId;           // "hammer" | "shuffle" | "addOne" | "bomb"
export const SPELL_IDS: readonly SpellId[];
export interface SpellDef { name: string; cost: number; upgradedCost: number }
export const SPELLS: Record<SpellId, SpellDef>;
export type SpellUpgrades = Record<SpellId, boolean>;
export const NO_UPGRADES: SpellUpgrades;
export function spellCost(state, spell, hooks?): number;
export function minSpellCost(state, hooks?): number;

export type BattleStatus = "ongoing" | "victory" | "defeat";
export interface BattleState {
  grid: GameGrid; freezes: FreezeEntry[];
  heroHp: number; heroMaxHp: number; mana: number;
  enemyId: string; enemyHp: number; enemyMaxHp: number; enemyShield: number;
  intentIndex: number; countdown: number;
  upgrades: SpellUpgrades; turn: number; overloads: number; status: BattleStatus;
}
export interface BattleSetup { enemyId: string; heroHp: number; heroMaxHp: number; upgrades?: SpellUpgrades; size?: number }
export type BattleEvent = /* slid | pairCleared | damageDealt | manaChanged | heroHpChanged | stoneBroken | thawed | intentFired | tileSpawned | spellCast | overload | battleEnded, see code */;
export interface TurnResult { state: BattleState; events: BattleEvent[] }

export interface HookEffect { mana?: number; heroHp?: number; enemyDamage?: number }
export interface OverloadResponse extends HookEffect { cancelHpLoss?: boolean }
export interface PairInfo { count: number; chain: boolean; damagePerPair: number }
export interface BattleHooks { chainMultiplier; spawnStrategy; spellCost; onBattleStart; onPairCleared; onStoneBroken; onOverload; onBattleEnd }
export const DEFAULT_HOOKS: BattleHooks;
export type BattleHooksInput = Partial<BattleHooks>;

export function currentIntent(state: BattleState): Intent;
export function createBattle(setup: BattleSetup, rng: Rng, hooks?: BattleHooksInput): TurnResult;
export function applyTurn(state: BattleState, direction: Direction, rng: Rng, hooks?: BattleHooksInput): TurnResult;
```
Turn order inside `applyTurn` and rng order: slide; damage + mana (`onPairCleared`); settle; stone break (`onStoneBroken`); settle; enemy phase (freezes tick, countdown -1, intent fires -> rng for the intent); settle; spawn (rng); [overload check, Task 4]; settle. An invalid swipe (nothing changes) returns the same state object and no events.

- [ ] **Step 3.1: Write the shared test helpers and the failing test**

Create `workspace/tests/unit/adventure/battleHelpers.ts`:
```ts
import { createEmptyGrid, type GameGrid } from "../../../src/grid";
import { NO_UPGRADES, type BattleState } from "../../../src/adventure/battle";
import { getEnemy } from "../../../src/adventure/enemies";

/** rng that returns the scripted values in order, then 0 forever. */
export function scripted(...values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

/** Deterministic LCG in [0, 1), for seeded random-play tests. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A battle state at turn 0 against `enemyId`, built directly (no rng, no spawns). */
export function makeState(
  grid: GameGrid = createEmptyGrid(4),
  changes: Partial<BattleState> = {},
  enemyId = "slime",
): BattleState {
  const enemy = getEnemy(enemyId)!;
  return {
    grid,
    freezes: [],
    heroHp: 10,
    heroMaxHp: 10,
    mana: 0,
    enemyId,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    enemyShield: 0,
    intentIndex: 0,
    countdown: enemy.cycle[0].countdown,
    upgrades: NO_UPGRADES,
    turn: 0,
    overloads: 0,
    status: "ongoing",
    ...changes,
  };
}

export function gridWith(rows: Array<Array<number | null>>): GameGrid {
  const grid = createEmptyGrid(4);
  rows.forEach((row, r) => row.forEach((v, c) => (grid[r][c] = v)));
  return grid;
}
```

Create `workspace/tests/unit/adventure/battleTurn.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import { applyTurn, createBattle, currentIntent, type BattleEvent } from "../../../src/adventure/battle";
import { getEnemy } from "../../../src/adventure/enemies";
import { gridWith, makeState, scripted, seededRng } from "./battleHelpers";

function types(events: BattleEvent[]): string[] {
  return events.map((e) => e.type);
}

describe("createBattle", () => {
  it("starts with two spawned tiles, 0 mana, full enemy HP and the first intent telegraphed", () => {
    const { state, events } = createBattle(
      { enemyId: "slime", heroHp: 7, heroMaxHp: 10 },
      seededRng(1),
    );
    expect(state.grid.flat().filter((c) => c !== null)).toHaveLength(2);
    expect(state.heroHp).toBe(7);
    expect(state.heroMaxHp).toBe(10);
    expect(state.mana).toBe(0);
    expect(state.enemyHp).toBe(40);
    expect(state.enemyShield).toBe(0);
    expect(state.intentIndex).toBe(0);
    expect(state.countdown).toBe(4);
    expect(state.status).toBe("ongoing");
    expect(state.freezes).toEqual([]);
    expect(types(events)).toEqual(["tileSpawned", "tileSpawned"]);
    expect(currentIntent(state)).toEqual({ kind: "attack", amount: 1 });
  });

  it("is deterministic for a fixed seed", () => {
    const a = createBattle({ enemyId: "treeKing", heroHp: 10, heroMaxHp: 10 }, seededRng(42));
    const b = createBattle({ enemyId: "treeKing", heroHp: 10, heroMaxHp: 10 }, seededRng(42));
    expect(a).toEqual(b);
  });

  it("throws on an unknown enemy id", () => {
    expect(() => createBattle({ enemyId: "nope", heroHp: 10, heroMaxHp: 10 }, () => 0)).toThrow(
      "Unknown enemy id",
    );
  });

  it("runs the onBattleStart hook (e.g. +2 mana)", () => {
    const { state, events } = createBattle(
      { enemyId: "slime", heroHp: 10, heroMaxHp: 10 },
      () => 0,
      { onBattleStart: () => ({ mana: 2 }) },
    );
    expect(state.mana).toBe(2);
    expect(events).toContainEqual({ type: "manaChanged", delta: 2, mana: 2 });
  });
});

describe("applyTurn: slide, pairs, damage, mana", () => {
  it("an invalid swipe is not a turn: same state object, no events", () => {
    const state = makeState(gridWith([[1, 2, 3, 4]]));
    const result = applyTurn(state, "left", () => 0);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it("one pair: 10 damage, +1 mana, turn counter, event order, then a spawn", () => {
    const state = makeState(gridWith([[9, 1, null, null]]));
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.enemyHp).toBe(30);
    expect(next.mana).toBe(1);
    expect(next.turn).toBe(1);
    expect(next.countdown).toBe(3);
    expect(types(events)).toEqual([
      "slid", "pairCleared", "manaChanged", "damageDealt", "tileSpawned",
    ]);
    expect(events[1]).toEqual({
      type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "slide",
    });
    expect(events[3]).toEqual({
      type: "damageDealt", amount: 10, absorbed: 0, hpDamage: 10, source: "pair",
    });
    const slid = events[0] as Extract<BattleEvent, { type: "slid" }>;
    expect(slid.prevGrid).toBe(state.grid);
    expect(slid.direction).toBe("left");
    expect(slid.eliminatedPairs).toHaveLength(1);
  });

  it("a slide that clears nothing: no damage, no mana, countdown drops, one tile spawns", () => {
    const state = makeState(gridWith([[null, 5, null, null]]));
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.enemyHp).toBe(40);
    expect(next.mana).toBe(0);
    expect(next.countdown).toBe(3);
    expect(types(events)).toEqual(["slid", "tileSpawned"]);
    expect(next.grid.flat().filter((c) => c !== null)).toHaveLength(2);
  });

  it("chain (>= 2 pairs in one slide): each pair deals floor(10 x 1.5) = 15, +1 mana per pair", () => {
    const state = makeState(gridWith([[9, 1, null, null], [8, 2, null, null]]));
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.enemyHp).toBe(10);
    expect(next.mana).toBe(2);
    expect(events).toContainEqual({
      type: "pairCleared", count: 2, chain: true, damagePerPair: 15, source: "slide",
    });
  });

  it("two pairs on one row also chain", () => {
    const state = makeState(gridWith([[9, 1, 7, 3]]));
    expect(applyTurn(state, "left", () => 0).state.enemyHp).toBe(10);
  });

  it("the chainMultiplier hook changes the multiplier (relic x2 -> 20 per pair)", () => {
    const state = makeState(gridWith([[9, 1, null, null], [8, 2, null, null]]));
    const { state: next } = applyTurn(state, "left", () => 0, { chainMultiplier: () => 2 });
    expect(next.enemyHp).toBe(0);
    expect(next.status).toBe("victory");
  });

  it("the multiplier floors per pair: x1.25 -> 12", () => {
    const state = makeState(gridWith([[9, 1, null, null], [8, 2, null, null]]));
    const { state: next } = applyTurn(state, "left", () => 0, { chainMultiplier: () => 1.25 });
    expect(next.enemyHp).toBe(40 - 24);
  });

  it("shield absorbs damage first and is used up before HP", () => {
    const one = applyTurn(
      makeState(gridWith([[9, 1, null, null]]), { enemyShield: 25 }),
      "left",
      () => 0,
    );
    expect(one.state.enemyShield).toBe(15);
    expect(one.state.enemyHp).toBe(40);

    const chain = applyTurn(
      makeState(gridWith([[9, 1, null, null], [8, 2, null, null]]), { enemyShield: 12 }),
      "left",
      () => 0,
    );
    expect(chain.state.enemyShield).toBe(0);
    expect(chain.state.enemyHp).toBe(40 - 18);
    expect(chain.events).toContainEqual({
      type: "damageDealt", amount: 30, absorbed: 12, hpDamage: 18, source: "pair",
    });
  });

  it("calls onPairCleared once per slide with the pair count", () => {
    const calls: unknown[] = [];
    applyTurn(makeState(gridWith([[9, 1, null, null], [8, 2, null, null]])), "left", () => 0, {
      onPairCleared: (_s, info) => {
        calls.push(info);
        return { mana: 1 };
      },
    });
    expect(calls).toEqual([{ count: 2, chain: true, damagePerPair: 15 }]);
  });

  it("an onPairCleared hook effect is applied (extra mana)", () => {
    const { state } = applyTurn(makeState(gridWith([[9, 1, null, null]])), "left", () => 0, {
      onPairCleared: () => ({ mana: 3 }),
    });
    expect(state.mana).toBe(4);
  });

  it("does not mutate the input state", () => {
    const state = makeState(gridWith([[9, 1, null, null], [null, null, STONE, null]]));
    const before = JSON.stringify(state);
    applyTurn(state, "left", seededRng(3));
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("applyTurn: enemy intents", () => {
  it("the intent fires when the countdown reaches 0 and the next one is telegraphed", () => {
    const state = makeState(gridWith([[null, 5, null, null]]), { countdown: 1 });
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.heroHp).toBe(9);
    expect(next.countdown).toBe(4);
    expect(next.intentIndex).toBe(0);
    expect(events).toContainEqual({
      type: "intentFired",
      intent: { kind: "attack", amount: 1 },
      effect: { kind: "attack", damage: 1 },
    });
    expect(events).toContainEqual({ type: "heroHpChanged", delta: -1, hp: 9, cause: "attack" });
  });

  it("a two-intent cycle alternates with each slot's own countdown (三角樹王)", () => {
    const state = makeState(gridWith([[null, 5, null, null]]), { countdown: 1 }, "treeKing");
    const { state: next } = applyTurn(state, "left", () => 0);
    expect(next.heroHp).toBe(8);
    expect(next.intentIndex).toBe(1);
    expect(next.countdown).toBe(getEnemy("treeKing")!.cycle[1].countdown);

    const again = applyTurn(
      { ...next, countdown: 1, grid: gridWith([[null, 5, null, null]]) },
      "left",
      () => 0,
    );
    expect(again.state.intentIndex).toBe(0);
    expect(again.events.some((e) => e.type === "intentFired" && e.effect.kind === "rockfall")).toBe(true);
  });

  it("an enemy shield intent adds shield; rockfall places stones", () => {
    const shield = applyTurn(
      makeState(gridWith([[null, 5, null, null]]), { countdown: 1 }, "crystalGuard"),
      "left",
      () => 0,
    );
    expect(shield.state.enemyShield).toBe(10);

    const rock = applyTurn(
      makeState(gridWith([[null, 5, null, null]]), { countdown: 1 }, "stoneGolem"),
      "left",
      () => 0,
    );
    expect(rock.state.grid.flat().filter((c) => c === STONE)).toHaveLength(2);
  });

  it("the hero reaching 0 HP is a defeat: no spawn after it", () => {
    const state = makeState(gridWith([[null, 5, null, null]]), { countdown: 1, heroHp: 1 });
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.status).toBe("defeat");
    expect(next.heroHp).toBe(0);
    expect(types(events)).not.toContain("tileSpawned");
    expect(events[events.length - 1]).toEqual({ type: "battleEnded", result: "defeat" });
  });
});

describe("applyTurn: win / lose", () => {
  it("killing the enemy ends the battle at once: no intent, no spawn", () => {
    const state = makeState(gridWith([[9, 1, null, null]]), { enemyHp: 10, countdown: 1, heroHp: 1 });
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.status).toBe("victory");
    expect(next.enemyHp).toBe(0);
    expect(next.heroHp).toBe(1);
    expect(next.countdown).toBe(1);
    expect(types(events)).not.toContain("intentFired");
    expect(types(events)).not.toContain("tileSpawned");
    expect(events[events.length - 1]).toEqual({ type: "battleEnded", result: "victory" });
  });

  it("onBattleEnd fires once on victory and its heal is applied (capped at max HP)", () => {
    const seen: string[] = [];
    const state = makeState(gridWith([[9, 1, null, null]]), { enemyHp: 10, heroHp: 9 });
    const { state: next } = applyTurn(state, "left", () => 0, {
      onBattleEnd: (_s, result) => {
        seen.push(result);
        return { heroHp: 2 };
      },
    });
    expect(seen).toEqual(["victory"]);
    expect(next.heroHp).toBe(10);
  });

  it("onBattleEnd effects are ignored on defeat", () => {
    const state = makeState(gridWith([[null, 5, null, null]]), { countdown: 1, heroHp: 1 });
    const { state: next } = applyTurn(state, "left", () => 0, { onBattleEnd: () => ({ heroHp: 5 }) });
    expect(next.status).toBe("defeat");
    expect(next.heroHp).toBe(0);
  });

  it("a finished battle ignores further turns", () => {
    const state = makeState(gridWith([[9, 1, null, null]]), { status: "victory" });
    const result = applyTurn(state, "left", () => 0);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });
});

describe("applyTurn: stones (decision D1: adjacency on the board the player swiped)", () => {
  it("a stone next to a tile that is eliminated breaks", () => {
    let hookCells: unknown;
    const state = makeState(gridWith([[9, 1, null, null], [STONE, null, null, null]]));
    const { state: next, events } = applyTurn(state, "left", () => 0.5, {
      onStoneBroken: (_s, cells, cause) => {
        hookCells = { cells, cause };
      },
    });
    expect(next.grid[1][0]).toBeNull();
    expect(events).toContainEqual({ type: "stoneBroken", cell: { row: 1, col: 0 }, cause: "adjacent" });
    expect(hookCells).toEqual({ cells: [{ row: 1, col: 0 }], cause: "adjacent" });
  });

  it("a stone not touching an eliminated tile survives and still slides", () => {
    const state = makeState(gridWith([[9, 1, null, null], [null, null, null, null], [null, null, STONE, null]]));
    const { state: next } = applyTurn(state, "left", () => 0.5);
    expect(next.grid[2][0]).toBe(STONE);
  });

  it("diagonal neighbours do not count", () => {
    const state = makeState(gridWith([[9, 1, null, null], [null, null, STONE, null]]));
    const { state: next } = applyTurn(state, "left", () => 0.5);
    expect(next.grid[1][0]).toBe(STONE);
  });

  it("a stone that moves in the slide is still broken, reported at its new position", () => {
    // before: stone (1,2) sits under the 1 at (0,2); the slide carries it to (1,0)
    const state = makeState(gridWith([[null, 9, 1, null], [null, null, STONE, null]]));
    const { state: next, events } = applyTurn(state, "left", () => 0.5);
    expect(next.grid[1][0]).toBeNull();
    expect(events).toContainEqual({ type: "stoneBroken", cell: { row: 1, col: 0 }, cause: "adjacent" });
  });

  it("a stone that only touches another stone is not chain-broken; stones never score or pair", () => {
    const state = makeState(gridWith([[9, 1, null, null], [STONE, null, STONE, null]]));
    const { state: next } = applyTurn(state, "left", () => 0.5);
    expect(next.grid[1][0]).toBeNull();
    expect(next.grid[1][1]).toBe(STONE);
    expect(next.mana).toBe(1);
  });

  it("works vertically: stone under a column pair breaks", () => {
    const state = makeState(gridWith([[9, STONE], [1, null], [null, null]]));
    const { state: next } = applyTurn(state, "up", () => 0.5);
    expect(next.grid[0][1]).toBeNull();
  });
});

describe("applyTurn: frozen tiles", () => {
  it("a frozen tile does not move; the counter ticks down and it thaws after 3 turns", () => {
    let state = makeState(gridWith([[null, 3, null, 5]]), { freezes: [{ row: 0, col: 1, turns: 3 }], countdown: 99 });
    const first = applyTurn(state, "left", () => 0.5);
    expect(first.state.grid[0][1]).toBe(3);
    expect(first.state.grid[0][2]).toBe(5);
    expect(first.state.freezes).toEqual([{ row: 0, col: 1, turns: 2 }]);

    // second and third turns (use down/up so something always moves)
    const second = applyTurn({ ...first.state, grid: gridWith([[null, 3, null, null], [null, null, 5, null]]) }, "right", () => 0.5);
    expect(second.state.freezes).toEqual([{ row: 0, col: 1, turns: 1 }]);
    state = second.state;
    const third = applyTurn({ ...state, grid: gridWith([[null, 3, null, null], [null, null, 5, null]]) }, "right", () => 0.5);
    expect(third.state.freezes).toEqual([]);
    expect(third.events).toContainEqual({ type: "thawed", cells: [{ row: 0, col: 1 }], cause: "expired" });
  });

  it("when only frozen tiles exist, no swipe is valid (mana 2 so no overload is due)", () => {
    const state = makeState(gridWith([[5]]), { mana: 2, freezes: [{ row: 0, col: 0, turns: 3 }] });
    (["up", "down", "left", "right"] as const).forEach((dir) => {
      expect(applyTurn(state, dir, () => 0).state).toBe(state);
    });
  });

  it("a frozen tile that is eliminated (as a wall) loses its freeze", () => {
    const state = makeState(gridWith([[null, 4, null, 6]]), { freezes: [{ row: 0, col: 1, turns: 3 }], countdown: 99 });
    const { state: next, events } = applyTurn(state, "left", () => 0.5);
    expect(next.freezes).toEqual([]);
    expect(events).toContainEqual({ type: "thawed", cells: [{ row: 0, col: 1 }], cause: "cleared" });
    expect(next.mana).toBe(1);
  });

  it("pins stone-break at a frozen-wall pair: endpoints on the swiped board count, meet cells do not", () => {
    // row 0: frozen 4 at col 1 pairs with the 6 at col 3 (meet cells (0,1),(0,2)).
    // row 1: stones under cols 1, 2, 3. Under col 2 there was no tile before the slide.
    const state = makeState(
      gridWith([[null, 4, null, 6], [null, STONE, STONE, STONE]]),
      { freezes: [{ row: 0, col: 1, turns: 3 }], countdown: 99 },
    );
    const { state: next, events } = applyTurn(state, "left", () => 0.5);
    // stones before: (1,1) (1,2) (1,3) -> after the slide (1,0) (1,1) (1,2)
    // broken: those under the endpoints (1,1) and (1,3) -> now (1,0) and (1,2); the middle one survives
    expect(next.grid[1][0]).toBeNull();
    expect(next.grid[1][1]).toBe(STONE);
    expect(next.grid[1][2]).toBeNull();
    expect(events.filter((e) => e.type === "stoneBroken")).toHaveLength(2);
  });
});

describe("applyTurn: freeze intent end to end", () => {
  it("a freeze fired this turn blocks the next 3 slides (not ticked on the turn it is created)", () => {
    const state = makeState(gridWith([[null, 5, null, null]]), { countdown: 1 }, "snowSprite");
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.freezes).toEqual([{ row: 0, col: 0, turns: 3 }]);
    expect(events).toContainEqual({
      type: "intentFired",
      intent: { kind: "freeze", amount: 1 },
      effect: { kind: "freeze", frozen: [{ row: 0, col: 0 }] },
    });
  });
});

describe("applyTurn: spawn strategy", () => {
  const start = () => makeState(gridWith([[null, 5, null, null]]));

  it("default: plain spawn while there are >= 4 empty cells", () => {
    const { events } = applyTurn(start(), "left", scripted(0, 0));
    expect(events).toContainEqual({ type: "tileSpawned", cell: { row: 0, col: 1 }, value: 1 });
  });

  it("the spawnStrategy hook is used (complement of the neighbour)", () => {
    const { events } = applyTurn(start(), "left", scripted(0, 0), {
      spawnStrategy: () => ({ emptyThreshold: 100, probability: 1 }),
    });
    expect(events).toContainEqual({ type: "tileSpawned", cell: { row: 0, col: 1 }, value: 5 });
  });

  it("a full board with no legal slide produces no events", () => {
    const full = makeState(gridWith([[1, 2, 3, 4], [5, 6, 7, 8], [1, 2, 3, 4], [5, 6, 7, null]]));
    const { events } = applyTurn(full, "left", () => 0);
    // the slide moves the last row's tiles? row 3 is [5,6,7,null] -> already left; other rows full => no move
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 3.2: Run it and see it fail**

```bash
npx vitest run tests/unit/adventure/battleTurn.test.ts
```
Expected: FAIL (`Failed to resolve import "../../../src/adventure/battle"`).

- [ ] **Step 3.3: Implement**

Create `workspace/src/adventure/battle.ts`:
```ts
/**
 * Adventure-mode battle rules (spec 3-5). Pure: no DOM, no Canvas, no module
 * state. Every function takes a `BattleState`, returns a new one plus the
 * `BattleEvent`s the view layer plays back, and gets randomness as an injected
 * `Rng`. `BattleState` is plain JSON-serialisable data (the enemy is referenced
 * by id) so the run layer can save and load it.
 *
 * Relics plug in through `BattleHooks` (all optional, default no-op); nothing in
 * this file knows about individual relics.
 */
import {
  COMPLEMENT_BIAS,
  STONE,
  breakAdjacentStones,
  slide,
  spawnRandomTile,
  type Direction,
  type EliminatedPair,
  type GameGrid,
  type Rng,
  type SpawnStrategy,
} from "../grid";
import { changedCells, type CellPosition } from "../gridDiff";
import type { PowerupId } from "../powerups";
import { getEnemy, type EnemyDef, type Intent } from "./enemies";
import {
  freezeMask,
  pruneFreezes,
  resolveIntent,
  tickFreezes,
  type FreezeEntry,
  type IntentEffect,
} from "./intents";

// ── constants (spec 3.2 / 4.3) ──────────────────────────────────────────────

export const GRID_SIZE = 4;
export const HERO_START_HP = 10;
export const PAIR_DAMAGE = 10;
export const PAIR_MANA = 1;
/** Chain multiplier (>= 2 pairs in one slide) before relics. */
export const BASE_CHAIN_MULTIPLIER = 1.5;
export const OVERLOAD_HP_LOSS = 2;

// ── spells (spec 4.2; upgrades: spec 6, "初版 4 個法術各 1 級強化") ───────────

/** Spell ids are the powerup ids, so the pure effects in powerups.ts are shared. */
export type SpellId = PowerupId;
export const SPELL_IDS: readonly SpellId[] = ["hammer", "addOne", "bomb", "shuffle"];

export interface SpellDef {
  name: string;
  cost: number;
  /** Cost once the spell's single upgrade has been taken. */
  upgradedCost: number;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  hammer: { name: "碎石", cost: 2, upgradedCost: 1 },
  addOne: { name: "增幅", cost: 2, upgradedCost: 1 },
  bomb: { name: "爆裂", cost: 4, upgradedCost: 3 },
  shuffle: { name: "洗牌", cost: 3, upgradedCost: 2 },
};

export type SpellUpgrades = Record<SpellId, boolean>;
export const NO_UPGRADES: SpellUpgrades = { hammer: false, addOne: false, bomb: false, shuffle: false };

// ── state ───────────────────────────────────────────────────────────────────

export type BattleStatus = "ongoing" | "victory" | "defeat";

export interface BattleState {
  grid: GameGrid;
  freezes: FreezeEntry[];
  heroHp: number;
  heroMaxHp: number;
  mana: number;
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyShield: number;
  /** Index into the enemy's action cycle of the intent currently telegraphed. */
  intentIndex: number;
  /** Turns until the telegraphed intent fires (fires when it reaches 0). */
  countdown: number;
  upgrades: SpellUpgrades;
  /** Number of resolved turns (valid slides and overloads on an invalid swipe). */
  turn: number;
  /** Overloads so far this battle (adventure trophy: 3 in one battle and win). */
  overloads: number;
  status: BattleStatus;
}

export interface BattleSetup {
  enemyId: string;
  heroHp: number;
  heroMaxHp: number;
  upgrades?: SpellUpgrades;
  size?: number;
}

// ── events ──────────────────────────────────────────────────────────────────

export type DamageSource = "pair" | "relic";
export type HeroHpCause = "attack" | "overload" | "relic";
export type StoneBreakCause = "adjacent" | "spell";
export type ThawCause = "expired" | "cleared";

export type BattleEvent =
  /** A valid slide. The view feeds `prevGrid`/`direction`/`eliminatedPairs` to BoardRenderer. */
  | { type: "slid"; direction: Direction; prevGrid: GameGrid; grid: GameGrid; eliminatedPairs: EliminatedPair[] }
  | { type: "pairCleared"; count: number; chain: boolean; damagePerPair: number; source: "slide" | "addOne" }
  | { type: "damageDealt"; amount: number; absorbed: number; hpDamage: number; source: DamageSource }
  | { type: "manaChanged"; delta: number; mana: number }
  | { type: "heroHpChanged"; delta: number; hp: number; cause: HeroHpCause }
  /** `cell` is the stone's position on the board after the turn's slide. */
  | { type: "stoneBroken"; cell: CellPosition; cause: StoneBreakCause }
  | { type: "thawed"; cells: CellPosition[]; cause: ThawCause }
  | { type: "intentFired"; intent: Intent; effect: IntentEffect }
  | { type: "tileSpawned"; cell: CellPosition; value: number }
  | { type: "spellCast"; spell: SpellId; cost: number; target: CellPosition | null }
  | { type: "overload"; hpLost: number; cleared: CellPosition[] }
  | { type: "battleEnded"; result: "victory" | "defeat" };

export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
}

// ── hooks (spec 7) ──────────────────────────────────────────────────────────

/** What a hook may change. Applied by battle.ts; damage is absorbed by shield like any other. */
export interface HookEffect {
  mana?: number;
  /** Signed: positive heals (capped at max HP), negative hurts. */
  heroHp?: number;
  enemyDamage?: number;
}

export interface OverloadResponse extends HookEffect {
  /** True = the hero does not lose the usual 2 HP (暴走之心). */
  cancelHpLoss?: boolean;
}

export interface PairInfo {
  count: number;
  chain: boolean;
  damagePerPair: number;
}

export interface BattleHooks {
  /** Multiplier for chains (>= 2 pairs in one slide). Default 1.5. */
  chainMultiplier(state: BattleState): number;
  /** Spawn strategy for the new tile each turn. Default COMPLEMENT_BIAS. */
  spawnStrategy(state: BattleState): SpawnStrategy;
  /** Final mana cost of a spell (base cost already reflects the upgrade). Default: unchanged. */
  spellCost(state: BattleState, spell: SpellId, baseCost: number): number;
  onBattleStart(state: BattleState): HookEffect | void;
  /** After the damage/mana of a pair group is applied. A 9 hit by 增幅 counts as 1 pair, chain false. */
  onPairCleared(state: BattleState, info: PairInfo): HookEffect | void;
  /** `cells` were just broken (pair adjacency, or a spell that removed stones). */
  onStoneBroken(state: BattleState, cells: CellPosition[], cause: StoneBreakCause): HookEffect | void;
  onOverload(state: BattleState): OverloadResponse | void;
  /** Fires once when the battle ends; effects are applied only on victory (e.g. heal). */
  onBattleEnd(state: BattleState, result: "victory" | "defeat"): HookEffect | void;
}

export const DEFAULT_HOOKS: BattleHooks = {
  chainMultiplier: () => BASE_CHAIN_MULTIPLIER,
  spawnStrategy: () => COMPLEMENT_BIAS,
  spellCost: (_state, _spell, baseCost) => baseCost,
  onBattleStart: () => {},
  onPairCleared: () => {},
  onStoneBroken: () => {},
  onOverload: () => {},
  onBattleEnd: () => {},
};

export type BattleHooksInput = Partial<BattleHooks>;

function resolveHooks(input: BattleHooksInput): BattleHooks {
  return { ...DEFAULT_HOOKS, ...input };
}

// ── draft helpers (internal; mutate only the local draft, never the caller's state) ──

interface Draft {
  state: BattleState;
  events: BattleEvent[];
  hooks: BattleHooks;
}

function makeDraft(state: BattleState, hooks: BattleHooksInput): Draft {
  return { state, events: [], hooks: resolveHooks(hooks) };
}

function done(d: Draft): TurnResult {
  return { state: d.state, events: d.events };
}

function patch(d: Draft, changes: Partial<BattleState>): void {
  d.state = { ...d.state, ...changes };
}

function enemyOf(state: BattleState): EnemyDef {
  const enemy = getEnemy(state.enemyId);
  if (!enemy) throw new Error(`Unknown enemy id: ${state.enemyId}`);
  return enemy;
}

/** The intent the enemy is currently telegraphing (for the UI). */
export function currentIntent(state: BattleState): Intent {
  return enemyOf(state).cycle[state.intentIndex].intent;
}

function dealDamage(d: Draft, amount: number, source: DamageSource): void {
  if (amount <= 0) return;
  const absorbed = Math.min(d.state.enemyShield, amount);
  const hpDamage = amount - absorbed;
  patch(d, {
    enemyShield: d.state.enemyShield - absorbed,
    enemyHp: Math.max(0, d.state.enemyHp - hpDamage),
  });
  d.events.push({ type: "damageDealt", amount, absorbed, hpDamage, source });
}

function changeMana(d: Draft, delta: number): void {
  if (delta === 0) return;
  const mana = Math.max(0, d.state.mana + delta);
  patch(d, { mana });
  d.events.push({ type: "manaChanged", delta, mana });
}

function changeHeroHp(d: Draft, delta: number, cause: HeroHpCause): void {
  const hp = Math.min(d.state.heroMaxHp, Math.max(0, d.state.heroHp + delta));
  const actual = hp - d.state.heroHp;
  if (actual === 0) return;
  patch(d, { heroHp: hp });
  d.events.push({ type: "heroHpChanged", delta: actual, hp, cause });
}

function applyHookEffect(d: Draft, effect: HookEffect | void): void {
  if (!effect) return;
  if (effect.mana) changeMana(d, effect.mana);
  if (effect.heroHp) changeHeroHp(d, effect.heroHp, "relic");
  if (effect.enemyDamage) dealDamage(d, effect.enemyDamage, "relic");
}

/**
 * Win/lose check (spec 3.1 step 7). Enemy first: if both would hit 0 the hero
 * wins. Returns true when the battle is over (and fires onBattleEnd once).
 */
function settle(d: Draft): boolean {
  if (d.state.status !== "ongoing") return true;
  const result = d.state.enemyHp <= 0 ? "victory" : d.state.heroHp <= 0 ? "defeat" : null;
  if (result === null) return false;
  patch(d, { status: result });
  d.events.push({ type: "battleEnded", result });
  const effect = d.hooks.onBattleEnd(d.state, result);
  if (result === "victory") applyHookEffect(d, effect);
  return true;
}

function clearCells(grid: GameGrid, cells: readonly CellPosition[]): GameGrid {
  const next = grid.map((row) => [...row]);
  cells.forEach(({ row, col }) => {
    next[row][col] = null;
  });
  return next;
}

/** Drop freezes whose tile is gone (eliminated by a pair, cleared by a spell or overload). */
function dropDeadFreezes(d: Draft): void {
  const { freezes, removed } = pruneFreezes(d.state.grid, d.state.freezes);
  if (removed.length === 0) return;
  patch(d, { freezes });
  d.events.push({ type: "thawed", cells: removed, cause: "cleared" });
}

function resolvePairs(d: Draft, count: number, source: "slide" | "addOne"): void {
  const chain = source === "slide" && count >= 2;
  const damagePerPair = chain
    ? Math.floor(PAIR_DAMAGE * d.hooks.chainMultiplier(d.state))
    : PAIR_DAMAGE;
  d.events.push({ type: "pairCleared", count, chain, damagePerPair, source });
  changeMana(d, count * PAIR_MANA);
  dealDamage(d, count * damagePerPair, "pair");
  applyHookEffect(d, d.hooks.onPairCleared(d.state, { count, chain, damagePerPair }));
}

function reportBrokenStones(d: Draft, cells: CellPosition[], cause: StoneBreakCause): void {
  if (cells.length === 0) return;
  cells.forEach((cell) => d.events.push({ type: "stoneBroken", cell, cause }));
  applyHookEffect(d, d.hooks.onStoneBroken(d.state, cells, cause));
}

// ── spells: cost ────────────────────────────────────────────────────────────

/** Mana cost of a spell right now (upgrade, then the `spellCost` hook; never below 0). */
export function spellCost(state: BattleState, spell: SpellId, hooks: BattleHooksInput = {}): number {
  const def = SPELLS[spell];
  const base = state.upgrades[spell] ? def.upgradedCost : def.cost;
  return Math.max(0, resolveHooks(hooks).spellCost(state, spell, base));
}

/** Cheapest spell right now; the overload check compares mana against it. */
export function minSpellCost(state: BattleState, hooks: BattleHooksInput = {}): number {
  return Math.min(...SPELL_IDS.map((spell) => spellCost(state, spell, hooks)));
}

// ── stone break (spec 3.4) ──────────────────────────────────────────────────

function stonesPerLine(grid: GameGrid, direction: Direction): CellPosition[][] {
  const vertical = direction === "up" || direction === "down";
  const lines: CellPosition[][] = Array.from({ length: grid.length }, () => []);
  grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell === STONE) lines[vertical ? c : r].push({ row: r, col: c });
    }),
  );
  return lines;
}

/**
 * Which stones break after a slide that eliminated `pairs`, as positions on
 * the post-slide grid. Rule (decision D1): a stone breaks if, on the board the
 * player swiped (`prevGrid`), it was orthogonally adjacent to a tile that took
 * part in an eliminated pair (either endpoint, a frozen wall included).
 * Stones never reorder or vanish in a slide, so the k-th stone of each line
 * before the slide is the k-th stone of that line after it.
 */
function stonesBrokenBySlide(
  prevGrid: GameGrid,
  nextGrid: GameGrid,
  direction: Direction,
  pairs: readonly EliminatedPair[],
): CellPosition[] {
  const endpoints = pairs.flatMap((pair) => [pair.a, pair.b]);
  const hit = breakAdjacentStones(prevGrid, endpoints).broken;
  if (hit.length === 0) return [];
  const hitKeys = new Set(hit.map(({ row, col }) => `${row},${col}`));
  const before = stonesPerLine(prevGrid, direction);
  const after = stonesPerLine(nextGrid, direction);
  const result: CellPosition[] = [];
  before.forEach((line, lineIndex) =>
    line.forEach((pos, k) => {
      const target = after[lineIndex][k];
      if (hitKeys.has(`${pos.row},${pos.col}`) && target) result.push(target);
    }),
  );
  return result.sort((x, y) => x.row - y.row || x.col - y.col);
}

// ── enemy phase (spec 3.1 step 4) ───────────────────────────────────────────

/**
 * Freezes tick down, then the intent countdown drops by 1; at 0 the intent
 * fires and the next one in the cycle is telegraphed. Order matters: a freeze
 * created by this turn's intent is added after the tick, so it blocks the next
 * 3 slides.
 */
function runEnemyPhase(d: Draft, rng: Rng): void {
  const ticked = tickFreezes(d.state.freezes);
  if (ticked.thawed.length > 0) {
    d.events.push({ type: "thawed", cells: ticked.thawed, cause: "expired" });
  }
  patch(d, { freezes: ticked.freezes });

  const countdown = d.state.countdown - 1;
  if (countdown > 0) {
    patch(d, { countdown });
    return;
  }

  const enemy = enemyOf(d.state);
  const slot = enemy.cycle[d.state.intentIndex];
  const resolution = resolveIntent(
    {
      grid: d.state.grid,
      freezes: d.state.freezes,
      heroHp: d.state.heroHp,
      enemyShield: d.state.enemyShield,
    },
    slot.intent,
    rng,
  );
  const nextIndex = (d.state.intentIndex + 1) % enemy.cycle.length;
  patch(d, {
    grid: resolution.board.grid,
    freezes: resolution.board.freezes,
    enemyShield: resolution.board.enemyShield,
    intentIndex: nextIndex,
    countdown: enemy.cycle[nextIndex].countdown,
  });
  d.events.push({ type: "intentFired", intent: slot.intent, effect: resolution.effect });
  if (resolution.effect.kind === "attack") {
    changeHeroHp(d, -resolution.effect.damage, "attack");
  }
}

// ── spawn (spec 3.1 step 5, 4.1) ────────────────────────────────────────────

function spawnTile(d: Draft, rng: Rng): void {
  const before = d.state.grid;
  const after = spawnRandomTile(before, rng, d.hooks.spawnStrategy(d.state));
  if (after === before) return;
  patch(d, { grid: after });
  changedCells(before, after).forEach((cell) =>
    d.events.push({ type: "tileSpawned", cell, value: after[cell.row][cell.col] as number }),
  );
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Start a battle: empty grid, two spawned tiles (same spawn path as a normal
 * turn), mana 0, first intent telegraphed, then the `onBattleStart` hook.
 * Throws on an unknown `enemyId` (the run layer validates ids when loading a save).
 */
export function createBattle(setup: BattleSetup, rng: Rng, hooks: BattleHooksInput = {}): TurnResult {
  const enemy = getEnemy(setup.enemyId);
  if (!enemy) throw new Error(`Unknown enemy id: ${setup.enemyId}`);
  const size = setup.size ?? GRID_SIZE;
  const state: BattleState = {
    grid: Array.from({ length: size }, () => Array.from({ length: size }, () => null)),
    freezes: [],
    heroHp: setup.heroHp,
    heroMaxHp: setup.heroMaxHp,
    mana: 0,
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    enemyShield: 0,
    intentIndex: 0,
    countdown: enemy.cycle[0].countdown,
    upgrades: setup.upgrades ?? NO_UPGRADES,
    turn: 0,
    overloads: 0,
    status: "ongoing",
  };
  const d = makeDraft(state, hooks);
  spawnTile(d, rng);
  spawnTile(d, rng);
  applyHookEffect(d, d.hooks.onBattleStart(d.state));
  settle(d);
  return done(d);
}

/**
 * One turn (spec 3.1). A slide that changes nothing is not a turn: the state
 * comes back untouched with no events. Order: slide (frozen tiles are walls),
 * damage + mana, stone break, enemy phase, spawn, win/lose. If the enemy dies
 * from the slide's damage it does not act and nothing spawns.
 *
 * rng order: intent (if one fires), then spawn.
 */
export function applyTurn(
  state: BattleState,
  direction: Direction,
  rng: Rng,
  hooks: BattleHooksInput = {},
): TurnResult {
  const d = makeDraft(state, hooks);
  if (state.status !== "ongoing") return done(d);

  const outcome = slide(state.grid, direction, freezeMask(state.grid.length, state.freezes));
  if (!outcome.moved) {
    return done(d);
  }

  patch(d, { grid: outcome.grid, turn: state.turn + 1 });
  d.events.push({
    type: "slid",
    direction,
    prevGrid: state.grid,
    grid: outcome.grid,
    eliminatedPairs: outcome.eliminatedPairs,
  });
  dropDeadFreezes(d); // a frozen tile that was eliminated (as a wall) is no longer frozen

  const pairs = outcome.eliminatedPairs;
  if (pairs.length > 0) {
    resolvePairs(d, pairs.length, "slide");
    if (settle(d)) return done(d);

    const broken = stonesBrokenBySlide(state.grid, outcome.grid, direction, pairs);
    patch(d, { grid: clearCells(d.state.grid, broken) });
    reportBrokenStones(d, broken, "adjacent");
    if (settle(d)) return done(d);
  }

  runEnemyPhase(d, rng);
  if (settle(d)) return done(d);

  spawnTile(d, rng);
  // [overload check goes here]
  settle(d);
  return done(d);
}
```

- [ ] **Step 3.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure/battleTurn.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `37 passed`; full unit `Tests  335 passed (335)`; `tsc` clean.

- [ ] **Step 3.5: Commit**

```bash
git add workspace/src/adventure/battle.ts workspace/tests/unit/adventure/battleHelpers.ts workspace/tests/unit/adventure/battleTurn.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure battle turn pipeline with relic hook interface

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 4: Overload (layer 3) in `battle.ts`

Spec 4.3. Uses `canMove(grid, frozenMask)`, so frozen tiles count as walls in the stuck check (review point 2).

**Files:**
- Modify: `workspace/src/adventure/battle.ts`
- Create: `workspace/tests/unit/adventure/battleOverload.test.ts`

**Interfaces:**

Consumes: `canMove` (`../grid`), `pickDistinct` (`./intents`), and the Task 3 internals (`runEnemyPhase`, `spawnTile`, `settle`, `dropDeadFreezes`, `changeHeroHp`, `applyHookEffect`, `clearCells`, `minSpellCost`).

Produces (exported from `src/adventure/battle.ts`):
```ts
export function shouldOverload(state: BattleState, hooks?: BattleHooksInput): boolean;
```
`runOverload` stays internal. `applyTurn` now (a) runs the overload after the spawn when `shouldOverload`, without a second intent tick, and (b) on an invalid swipe, if `shouldOverload(state)` holds, counts the swipe as a turn, runs the overload with an enemy tick (safety net, D7).

- [ ] **Step 4.1: Write the failing test**

Create `workspace/tests/unit/adventure/battleOverload.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createEmptyGrid, STONE, type GameGrid } from "../../../src/grid";
import { applyTurn, shouldOverload } from "../../../src/adventure/battle";
import { gridWith, makeState } from "./battleHelpers";

// One empty cell at (3,3). Sliding row 3 right moves the tiles; the spawn then
// fills (3,0) with a 1 (plain spawn, rng 0), leaving a board of 1s and 2s with no legal move.
const nearlyStuck: GameGrid = [
  [1, 2, 1, 2],
  [2, 1, 2, 1],
  [1, 2, 1, 2],
  [2, 1, 2, null],
];
const plainSpawn = { spawnStrategy: () => ({ emptyThreshold: 0, probability: 0 }) };

describe("shouldOverload (layer 3 condition, spec 4.3)", () => {
  const stuck: GameGrid = [
    [1, 2, 1, 2],
    [2, 1, 2, 1],
    [1, 2, 1, 2],
    [2, 1, 2, 1],
  ];

  it("true when no slide is legal and mana is below the cheapest spell (2)", () => {
    expect(shouldOverload(makeState(stuck, { mana: 0 }))).toBe(true);
    expect(shouldOverload(makeState(stuck, { mana: 1 }))).toBe(true);
  });

  it("false once mana covers the cheapest spell", () => {
    expect(shouldOverload(makeState(stuck, { mana: 2 }))).toBe(false);
  });

  it("the cheapest cost follows upgrades and the spellCost hook", () => {
    const upgraded = makeState(stuck, {
      mana: 1,
      upgrades: { hammer: true, addOne: false, bomb: false, shuffle: false },
    });
    expect(shouldOverload(upgraded)).toBe(false);
    expect(shouldOverload(makeState(stuck, { mana: 1 }), { spellCost: () => 1 })).toBe(false);
  });

  it("false while a legal slide exists", () => {
    expect(shouldOverload(makeState(gridWith([[1, null]]), { mana: 0 }))).toBe(false);
  });

  it("respects the frozen mask: a lone frozen tile has no legal slide", () => {
    const grid = gridWith([[5]]);
    expect(shouldOverload(makeState(grid))).toBe(false);
    expect(shouldOverload(makeState(grid, { freezes: [{ row: 0, col: 0, turns: 2 }] }))).toBe(true);
  });

  it("false once the battle is over", () => {
    expect(shouldOverload(makeState(stuck, { status: "defeat" }))).toBe(false);
  });
});

describe("overload at the end of a turn", () => {
  it("costs 2 HP, clears half the occupied cells, counts the overload, and does not tick the intent twice", () => {
    const state = makeState(nearlyStuck);
    const { state: next, events } = applyTurn(state, "right", () => 0, plainSpawn);
    expect(next.heroHp).toBe(8);
    expect(next.overloads).toBe(1);
    expect(next.countdown).toBe(3); // 4 -> 3 once, not twice
    // rng 0 picks the first 8 occupied cells in row-major order: rows 0 and 1
    expect(next.grid[0]).toEqual([null, null, null, null]);
    expect(next.grid[1]).toEqual([null, null, null, null]);
    expect(next.grid[2]).toEqual([1, 2, 1, 2]);
    const overload = events.find((e) => e.type === "overload");
    expect(overload).toMatchObject({ type: "overload", hpLost: 2 });
    expect((overload as { cleared: unknown[] }).cleared).toHaveLength(8);
    expect(events).toContainEqual({ type: "heroHpChanged", delta: -2, hp: 8, cause: "overload" });
  });

  it("rounds the cleared half down (3 frozen tiles -> 1 cleared)", () => {
    const grid = gridWith([[5, 5, 5, null]]);
    const freezes = [0, 1, 2].map((col) => ({ row: 0, col, turns: 3 }));
    const { events } = applyTurn(makeState(grid, { freezes }), "left", () => 0);
    const overload = events.find((e) => e.type === "overload") as { cleared: unknown[] };
    expect(overload.cleared).toHaveLength(1);
  });

  it("does nothing while mana can still pay for a spell", () => {
    const { state: next, events } = applyTurn(makeState(nearlyStuck, { mana: 2 }), "right", () => 0, plainSpawn);
    expect(next.heroHp).toBe(10);
    expect(events.some((e) => e.type === "overload")).toBe(false);
  });

  it("the onOverload hook can cancel the HP loss and hit the enemy (暴走之心)", () => {
    const { state: next, events } = applyTurn(makeState(nearlyStuck), "right", () => 0, {
      ...plainSpawn,
      onOverload: () => ({ cancelHpLoss: true, enemyDamage: 20 }),
    });
    expect(next.heroHp).toBe(10);
    expect(next.enemyHp).toBe(20);
    expect(events).toContainEqual({
      type: "damageDealt", amount: 20, absorbed: 0, hpDamage: 20, source: "relic",
    });
    expect(events.find((e) => e.type === "overload")).toMatchObject({ hpLost: 0 });
  });

  it("an overload that takes the last HP is a defeat (spec 4.3)", () => {
    const { state: next, events } = applyTurn(makeState(nearlyStuck, { heroHp: 2 }), "right", () => 0, plainSpawn);
    expect(next.heroHp).toBe(0);
    expect(next.status).toBe("defeat");
    expect(events[events.length - 1]).toEqual({ type: "battleEnded", result: "defeat" });
  });

  it("relic damage from an overload can win the battle", () => {
    const { state: next } = applyTurn(makeState(nearlyStuck, { enemyHp: 20 }), "right", () => 0, {
      ...plainSpawn,
      onOverload: () => ({ cancelHpLoss: true, enemyDamage: 20 }),
    });
    expect(next.status).toBe("victory");
  });

  it("clearing ignores freezes and drops the freeze entries of cleared tiles", () => {
    const state = makeState(nearlyStuck, { freezes: [{ row: 0, col: 0, turns: 3 }, { row: 3, col: 1, turns: 3 }] });
    // (3,1) holds a tile that moves? it is frozen so it is a wall; sliding right still moves (3,2) -> (3,3)
    const { state: next } = applyTurn(state, "right", () => 0, plainSpawn);
    expect(next.overloads).toBe(1);
    // (0,0) was cleared, so its freeze is gone; (3,1) survived and ticked 3 -> 2
    expect(next.freezes).toEqual([{ row: 3, col: 1, turns: 2 }]);
  });
});

describe("overload as a safety net on an invalid swipe", () => {
  it("a stuck board with too little mana resolves the overload when the player swipes", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next, events } = applyTurn(state, "up", () => 0);
    expect(next.heroHp).toBe(8);
    expect(next.turn).toBe(1);
    expect(next.overloads).toBe(1);
    expect(next.countdown).toBe(3); // the enemy phase runs for this overload
    expect(next.freezes).toEqual([{ row: 0, col: 0, turns: 2 }]);
    expect(events.some((e) => e.type === "overload")).toBe(true);
  });

  it("an empty board gets a fresh tile after the overload so play can continue", () => {
    const state = makeState(createEmptyGrid(4));
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.heroHp).toBe(8);
    expect(next.grid.flat().filter((c) => c !== null)).toHaveLength(1);
    expect(events.some((e) => e.type === "tileSpawned")).toBe(true);
  });

  it("an invalid swipe on a board that still has a legal move is just ignored", () => {
    const state = makeState(gridWith([[5]]));
    const result = applyTurn(state, "left", () => 0);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });
});
```

- [ ] **Step 4.2: Run it and see it fail**

```bash
npx vitest run tests/unit/adventure/battleOverload.test.ts
```
Expected: FAIL: `14 failed | 2 passed` (`shouldOverload is not a function`, and the turn-level overload cases fail their assertions).

- [ ] **Step 4.3: Implement (five edits to `workspace/src/adventure/battle.ts`)**

**E1** (imports from `../grid`). Find:
```ts
  breakAdjacentStones,
```
Replace with:
```ts
  breakAdjacentStones,
  canMove,
```

**E2** (imports from `./intents`). Find:
```ts
  freezeMask,
```
Replace with:
```ts
  freezeMask,
  pickDistinct,
```

**E3** (overload logic, inserted just above the public API section). Find:
```ts
// ── public API ──────────────────────────────────────────────────────────────
```
Replace with:
```ts
// ── overload, layer 3 of anti-stall (spec 4.3) ──────────────────────────────

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

/**
 * 魔力暴走: the hero loses 2 HP (unless a hook cancels it), floor(occupied / 2)
 * random occupied cells are cleared (freezes ignored), and the `onOverload`
 * hook effect is applied. `tickEnemy` is true when the overload is not already
 * part of a turn that ran the enemy phase (spell cast, safety-net swipe), so the
 * intent countdown still drops by exactly 1. A board left empty gets one spawn.
 *
 * rng order: cleared-cell picks, [enemy phase], [spawn on an empty board].
 */
function runOverload(d: Draft, rng: Rng, tickEnemy: boolean): void {
  const response = d.hooks.onOverload(d.state);
  const occupied: CellPosition[] = [];
  d.state.grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell !== null) occupied.push({ row: r, col: c });
    }),
  );
  const cleared = pickDistinct(occupied, Math.floor(occupied.length / 2), rng);
  const hpLost = response && response.cancelHpLoss ? 0 : OVERLOAD_HP_LOSS;

  patch(d, { grid: clearCells(d.state.grid, cleared), overloads: d.state.overloads + 1 });
  d.events.push({ type: "overload", hpLost, cleared });
  dropDeadFreezes(d);
  changeHeroHp(d, -hpLost, "overload");
  applyHookEffect(d, response);
  if (settle(d)) return;

  if (tickEnemy) {
    runEnemyPhase(d, rng);
    if (settle(d)) return;
  }
  if (d.state.grid.every((row) => row.every((cell) => cell === null))) spawnTile(d, rng);
}

// ── public API ──────────────────────────────────────────────────────────────
```

**E4** (`applyTurn`, invalid swipe branch). Find:
```ts
  if (!outcome.moved) {
    return done(d);
  }
```
Replace with:
```ts
  if (!outcome.moved) {
    // Safety net: if the board is stuck for good (layer-3 condition), the swipe attempt resolves the overload.
    if (shouldOverload(state, d.hooks)) {
      patch(d, { turn: state.turn + 1 });
      runOverload(d, rng, true);
    }
    return done(d);
  }
```

**E5** (`applyTurn`, end of the turn). Find:
```ts
  // [overload check goes here]
  settle(d);
```
Replace with:
```ts
  if (shouldOverload(d.state, d.hooks)) runOverload(d, rng, false); // the enemy phase already ran this turn
  settle(d);
```

- [ ] **Step 4.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure && npm run test:unit && npx tsc --noEmit
```
Expected: `battleOverload.test.ts` `16 passed`; `battleTurn.test.ts` still `37 passed`; full unit `Tests  351 passed (351)`; `tsc` clean.

- [ ] **Step 4.5: Commit**

```bash
git add workspace/src/adventure/battle.ts workspace/tests/unit/adventure/battleOverload.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure overload (layer 3 anti-stall) with swipe safety net

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 5: Spells in `battle.ts`

Spec 4.2. Casting is not a turn. Effects are the plan #1 pure functions.

**Files:**
- Modify: `workspace/src/adventure/battle.ts`
- Create: `workspace/tests/unit/adventure/battleSpells.test.ts`

**Interfaces:**

Consumes: `hammerEffect`, `shuffleEffect`, `addOneEffect`, `bombEffect`, `PowerupResult` (`../powerups`).

Produces (exported from `src/adventure/battle.ts`):
```ts
export type SpellFailure = "battleOver" | "notEnoughMana" | "invalidTarget";
export interface SpellResult extends TurnResult { applied: boolean; reason?: SpellFailure }
export function castSpell(
  state: BattleState, spell: SpellId, target: CellPosition | null, rng: Rng, hooks?: BattleHooksInput,
): SpellResult;
```
`applied: false` returns the same state object, no events, no mana spent. `target` is ignored by shuffle. Hammer/addOne/bomb need an on-board target; hammer and addOne also need an occupied cell (addOne additionally refuses stones); bomb accepts an empty centre.

- [ ] **Step 5.1: Write the failing test**

Create `workspace/tests/unit/adventure/battleSpells.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE, type GameGrid } from "../../../src/grid";
import {
  SPELLS,
  SPELL_IDS,
  castSpell,
  minSpellCost,
  spellCost,
  type BattleEvent,
} from "../../../src/adventure/battle";
import { gridWith, makeState, seededRng } from "./battleHelpers";

const upgradedAll = { hammer: true, addOne: true, bomb: true, shuffle: true };

describe("spell costs (spec 4.2) and upgrades", () => {
  it("base costs are 2 / 2 / 4 / 3 for hammer, addOne, bomb, shuffle", () => {
    const state = makeState();
    expect(spellCost(state, "hammer")).toBe(2);
    expect(spellCost(state, "addOne")).toBe(2);
    expect(spellCost(state, "bomb")).toBe(4);
    expect(spellCost(state, "shuffle")).toBe(3);
  });

  it("each spell has one upgrade that makes it 1 cheaper", () => {
    const state = makeState(undefined, { upgrades: upgradedAll });
    SPELL_IDS.forEach((id) => {
      expect(spellCost(state, id)).toBe(SPELLS[id].cost - 1);
    });
    const onlyBomb = makeState(undefined, { upgrades: { ...upgradedAll, hammer: false, addOne: false, shuffle: false } });
    expect(spellCost(onlyBomb, "bomb")).toBe(3);
    expect(spellCost(onlyBomb, "hammer")).toBe(2);
  });

  it("the spellCost hook adjusts the cost and the result never goes below 0", () => {
    const state = makeState();
    expect(spellCost(state, "bomb", { spellCost: (_s, _id, base) => base - 1 })).toBe(3);
    expect(spellCost(state, "bomb", { spellCost: () => -5 })).toBe(0);
  });

  it("minSpellCost is the cheapest of the four", () => {
    expect(minSpellCost(makeState())).toBe(2);
    expect(minSpellCost(makeState(undefined, { upgrades: upgradedAll }))).toBe(1);
  });
});

describe("castSpell: shared rules", () => {
  const board = gridWith([[1, 2, 3, 4], [5, 6, 7, 8], [9, 1, 2, 3]]);

  it("casting is not a turn: no enemy action, no spawn, turn counter unchanged", () => {
    const state = makeState(board, { mana: 5, countdown: 1 });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result.applied).toBe(true);
    expect(result.state.turn).toBe(0);
    expect(result.state.countdown).toBe(1);
    expect(result.state.heroHp).toBe(10);
    expect(result.state.grid.flat().filter((c) => c !== null)).toHaveLength(11);
  });

  it("rejects with notEnoughMana and returns the very same state, spending nothing", () => {
    const state = makeState(board, { mana: 1 });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result).toMatchObject({ applied: false, reason: "notEnoughMana", events: [] });
    expect(result.state).toBe(state);
  });

  it("rejects after the battle is over", () => {
    const state = makeState(board, { mana: 9, status: "victory" });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result).toMatchObject({ applied: false, reason: "battleOver" });
    expect(result.state).toBe(state);
  });

  it("rejects off-board and missing targets (except shuffle, which needs none)", () => {
    const state = makeState(board, { mana: 9 });
    ["hammer", "addOne", "bomb"].forEach((spell) => {
      expect(castSpell(state, spell as "hammer", { row: 4, col: 0 }, () => 0).reason).toBe("invalidTarget");
      expect(castSpell(state, spell as "hammer", { row: 0, col: -1 }, () => 0).reason).toBe("invalidTarget");
      expect(castSpell(state, spell as "hammer", null, () => 0).reason).toBe("invalidTarget");
    });
    expect(castSpell(state, "shuffle", null, () => 0).applied).toBe(true);
  });

  it("emits spellCast then a negative manaChanged", () => {
    const state = makeState(board, { mana: 5 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(events).toEqual([
      { type: "spellCast", spell: "hammer", cost: 2, target: { row: 0, col: 0 } },
      { type: "manaChanged", delta: -2, mana: 3 },
    ]);
  });

  it("uses the upgraded cost", () => {
    const state = makeState(board, { mana: 1, upgrades: upgradedAll });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result.applied).toBe(true);
    expect(result.state.mana).toBe(0);
  });

  it("does not mutate the input state", () => {
    const state = makeState(board, { mana: 9 });
    const before = JSON.stringify(state);
    castSpell(state, "bomb", { row: 1, col: 1 }, () => 0);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("castSpell: 碎石 hammer", () => {
  it("removes a number, a stone or a 0", () => {
    const state = makeState(gridWith([[3, STONE, 0, null]]), { mana: 9 });
    [0, 1, 2].forEach((col) => {
      const result = castSpell(state, "hammer", { row: 0, col }, () => 0);
      expect(result.applied).toBe(true);
      expect(result.state.grid[0][col]).toBeNull();
    });
  });

  it("an empty cell is an invalid target and costs nothing", () => {
    const state = makeState(gridWith([[3, null]]), { mana: 9 });
    const result = castSpell(state, "hammer", { row: 0, col: 1 }, () => 0);
    expect(result).toMatchObject({ applied: false, reason: "invalidTarget" });
    expect(result.state).toBe(state);
  });

  it("breaking a stone with it fires stoneBroken (cause spell) and the onStoneBroken hook", () => {
    let seen: unknown;
    const state = makeState(gridWith([[STONE, 4]]), { mana: 2 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0, {
      onStoneBroken: (_s, cells, cause) => {
        seen = { cells, cause };
        return { enemyDamage: 5 };
      },
    });
    expect(events).toContainEqual({ type: "stoneBroken", cell: { row: 0, col: 0 }, cause: "spell" });
    expect(seen).toEqual({ cells: [{ row: 0, col: 0 }], cause: "spell" });
    expect(events).toContainEqual({ type: "damageDealt", amount: 5, absorbed: 0, hpDamage: 5, source: "relic" });
  });

  it("hammering a number is not a stone break", () => {
    const state = makeState(gridWith([[3, 4]]), { mana: 2 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(events.some((e: BattleEvent) => e.type === "stoneBroken")).toBe(false);
  });

  it("smashing a frozen tile removes its freeze", () => {
    const state = makeState(gridWith([[3, 4]]), { mana: 2, freezes: [{ row: 0, col: 0, turns: 2 }] });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result.state.freezes).toEqual([]);
    expect(result.events).toContainEqual({ type: "thawed", cells: [{ row: 0, col: 0 }], cause: "cleared" });
  });
});

describe("castSpell: 增幅 addOne", () => {
  it("adds 1 to a number; 0 becomes 1", () => {
    const state = makeState(gridWith([[4, 0]]), { mana: 4 });
    expect(castSpell(state, "addOne", { row: 0, col: 0 }, () => 0).state.grid[0][0]).toBe(5);
    expect(castSpell(state, "addOne", { row: 0, col: 1 }, () => 0).state.grid[0][1]).toBe(1);
  });

  it("refuses stones and empty cells without spending mana", () => {
    const state = makeState(gridWith([[STONE, null]]), { mana: 4 });
    expect(castSpell(state, "addOne", { row: 0, col: 0 }, () => 0)).toMatchObject({ applied: false, reason: "invalidTarget" });
    expect(castSpell(state, "addOne", { row: 0, col: 1 }, () => 0)).toMatchObject({ applied: false, reason: "invalidTarget" });
  });

  it("on a 9 the tile is removed and it counts as one cleared pair: 10 damage, +1 mana, no chain bonus", () => {
    const calls: unknown[] = [];
    const state = makeState(gridWith([[9, 3]]), { mana: 2 });
    const { state: next, events } = castSpell(state, "addOne", { row: 0, col: 0 }, () => 0, {
      onPairCleared: (_s, info) => {
        calls.push(info);
      },
    });
    expect(next.grid[0][0]).toBeNull();
    expect(next.enemyHp).toBe(30);
    expect(next.mana).toBe(1); // 2 - 2 + 1
    expect(events).toContainEqual({ type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "addOne" });
    expect(calls).toEqual([{ count: 1, chain: false, damagePerPair: 10 }]);
  });

  it("a 9 cleared by addOne can win the battle", () => {
    const state = makeState(gridWith([[9, 3]]), { mana: 2, enemyHp: 10 });
    const { state: next, events } = castSpell(state, "addOne", { row: 0, col: 0 }, () => 0);
    expect(next.status).toBe("victory");
    expect(events[events.length - 1]).toEqual({ type: "battleEnded", result: "victory" });
  });
});

describe("castSpell: 爆裂 bomb", () => {
  it("clears the target and its four neighbours, stones included", () => {
    const grid = gridWith([[1, 2, 3, 4], [5, STONE, 7, 8], [9, 1, 2, 3], [4, 5, 6, 7]]);
    const { state: next } = castSpell(makeState(grid, { mana: 4 }), "bomb", { row: 1, col: 1 }, () => 0);
    const cleared = [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]];
    cleared.forEach(([r, c]) => expect(next.grid[r][c]).toBeNull());
    expect(next.grid[0][0]).toBe(1);
    expect(next.grid[2][2]).toBe(2);
    expect(next.mana).toBe(0);
  });

  it("can be cast on an empty centre", () => {
    const state = makeState(gridWith([[null, 5]]), { mana: 4 });
    const result = castSpell(state, "bomb", { row: 0, col: 0 }, () => 0);
    expect(result.applied).toBe(true);
    expect(result.state.grid[0][1]).toBeNull();
  });

  it("reports every stone it removed", () => {
    const state = makeState(gridWith([[STONE, STONE, null]]), { mana: 4 });
    const { events } = castSpell(state, "bomb", { row: 0, col: 0 }, () => 0);
    expect(events.filter((e) => e.type === "stoneBroken")).toHaveLength(2);
  });
});

describe("castSpell: 洗牌 shuffle", () => {
  function multiset(grid: GameGrid): number[] {
    return grid.flat().filter((c): c is number => c !== null).sort((a, b) => a - b);
  }

  it("keeps occupied positions and the values (stones and 0 included)", () => {
    const grid = gridWith([[1, STONE, 0, null], [4, 5, null, 9]]);
    const state = makeState(grid, { mana: 3 });
    const { state: next } = castSpell(state, "shuffle", null, seededRng(5));
    expect(multiset(next.grid)).toEqual(multiset(grid));
    next.grid.forEach((row, r) => row.forEach((cell, c) => expect(cell === null).toBe(grid[r][c] === null)));
    expect(next.mana).toBe(0);
  });

  it("frozen tiles keep their value and position", () => {
    const grid = gridWith([[1, 2, 3, 4]]);
    const state = makeState(grid, { mana: 3, freezes: [{ row: 0, col: 1, turns: 2 }] });
    for (let seed = 1; seed <= 20; seed++) {
      const { state: next } = castSpell(state, "shuffle", null, seededRng(seed));
      expect(next.grid[0][1]).toBe(2);
      expect(multiset(next.grid)).toEqual([1, 2, 3, 4]);
    }
  });
});

describe("castSpell: overload right after a cast (no soft-lock)", () => {
  it("a cast that leaves the board stuck with too little mana triggers the overload at once", () => {
    // Only 1s and 2s: nothing can ever pair, so shuffling keeps the board stuck.
    const stuck: GameGrid = [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 1],
    ];
    const state = makeState(stuck, { mana: 3 });
    const { state: next, events } = castSpell(state, "shuffle", null, () => 0);
    expect(events.some((e) => e.type === "overload")).toBe(true);
    expect(next.heroHp).toBe(8);
    expect(next.mana).toBe(0);
    expect(next.countdown).toBe(3); // the overload counts the enemy down once
    expect(next.grid.flat().filter((c) => c !== null)).toHaveLength(8);
  });

  it("no overload when the cast leaves a legal move", () => {
    const state = makeState(gridWith([[1, 2, null, null]]), { mana: 9 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(events.some((e) => e.type === "overload")).toBe(false);
  });
});
```

- [ ] **Step 5.2: Run it and see it fail**

```bash
npx vitest run tests/unit/adventure/battleSpells.test.ts
```
Expected: FAIL: `23 failed | 4 passed` (`castSpell is not a function`; the four cost-table tests already pass because `SPELLS`/`spellCost` exist from Task 3).

- [ ] **Step 5.3: Implement**

**E1** (replace the powerups import in `workspace/src/adventure/battle.ts`). Find:
```ts
import type { PowerupId } from "../powerups";
```
Replace with:
```ts
import {
  addOneEffect,
  bombEffect,
  hammerEffect,
  shuffleEffect,
  type PowerupId,
  type PowerupResult,
} from "../powerups";
```

**E2** Append to the very end of `workspace/src/adventure/battle.ts`:
```ts
export type SpellFailure = "battleOver" | "notEnoughMana" | "invalidTarget";

export interface SpellResult extends TurnResult {
  /** False = nothing happened (state is the very same object, no events, no mana spent). */
  applied: boolean;
  reason?: SpellFailure;
}

/**
 * Cast a spell (spec 4.2). Not a turn: the enemy does not act and nothing
 * spawns. `target` is the clicked cell; shuffle ignores it. Effects come from
 * the shared pure functions in powerups.ts (hammer/bomb clear stones too,
 * addOne refuses stones, shuffle skips frozen tiles). A 9 hit by addOne counts
 * as one cleared pair (10 damage, +1 mana, no chain bonus). Stones removed by a
 * spell fire `stoneBroken` (cause "spell") and the `onStoneBroken` hook.
 *
 * After the cast the layer-3 check runs: if the board is stuck and the
 * remaining mana cannot pay for any spell, the overload resolves immediately
 * (and counts the enemy down once), so the player can never soft-lock.
 *
 * rng: only shuffle uses it (as in shuffleEffect), plus whatever an overload needs.
 */
export function castSpell(
  state: BattleState,
  spell: SpellId,
  target: CellPosition | null,
  rng: Rng,
  hooks: BattleHooksInput = {},
): SpellResult {
  const d = makeDraft(state, hooks);
  const reject = (reason: SpellFailure): SpellResult => ({ ...done(d), applied: false, reason });
  if (state.status !== "ongoing") return reject("battleOver");

  const cost = spellCost(state, spell, d.hooks);
  if (state.mana < cost) return reject("notEnoughMana");

  const size = state.grid.length;
  let effect: PowerupResult;
  let pairCleared = false;
  if (spell === "shuffle") {
    effect = shuffleEffect(state.grid, rng, freezeMask(size, state.freezes));
  } else {
    const onBoard =
      target !== null && target.row >= 0 && target.row < size && target.col >= 0 && target.col < size;
    if (!onBoard) return reject("invalidTarget");
    if (spell === "hammer") {
      effect = hammerEffect(state.grid, target.row, target.col);
    } else if (spell === "addOne") {
      const result = addOneEffect(state.grid, target.row, target.col);
      pairCleared = result.pairCleared;
      effect = result;
    } else {
      effect = bombEffect(state.grid, target.row, target.col);
    }
    if (!effect.applied) return reject("invalidTarget");
  }

  const brokenStones = effect.cleared.filter(({ row, col }) => state.grid[row][col] === STONE);
  patch(d, { grid: effect.grid });
  d.events.push({ type: "spellCast", spell, cost, target: spell === "shuffle" ? null : target });
  changeMana(d, -cost);
  dropDeadFreezes(d);
  reportBrokenStones(d, brokenStones, "spell");
  if (pairCleared) resolvePairs(d, 1, "addOne");

  if (!settle(d) && shouldOverload(d.state, d.hooks)) runOverload(d, rng, true);
  settle(d);
  return { ...done(d), applied: true };
}
```

- [ ] **Step 5.4: Run and see it pass**

```bash
npx vitest run tests/unit/adventure && npm run test:unit && npx tsc --noEmit
```
Expected: `battleSpells.test.ts` `27 passed`; other adventure files unchanged; full unit `Tests  378 passed (378)`; `tsc` clean.

- [ ] **Step 5.5: Commit**

```bash
git add workspace/src/adventure/battle.ts workspace/tests/unit/adventure/battleSpells.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure spells with upgrades and post-cast overload check

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 6: Seeded full-battle regression net

Test-only task: it exercises all earlier code, so it passes immediately (there is no failing-first step; if it fails, that is a real bug in Tasks 3-5 and the fix goes into `battle.ts`, never into the test's invariants).

**Files:**
- Create: `workspace/tests/unit/adventure/battleSimulation.test.ts`

**Interfaces:** Consumes everything above; produces nothing.

Invariants checked after every action, for all 9 enemies x 3 fixed seeds x up to 1500 actions: cell values in `{null, STONE, 0..9}`; every freeze sits on a non-stone tile with 1-3 turns and is unique; HP/mana/shield/countdown bounds; status consistent with HP; and the anti-stall guarantee that an ongoing battle always has a legal slide (frozen tiles as walls) or enough mana for the cheapest spell. The bot swipes in a seeded random order, hammers the first tile when stuck, and relies on the swipe safety net otherwise.

- [ ] **Step 6.1: Write the test**

Create `workspace/tests/unit/adventure/battleSimulation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE, canMove, type Direction } from "../../../src/grid";
import {
  applyTurn,
  castSpell,
  createBattle,
  minSpellCost,
  type BattleState,
} from "../../../src/adventure/battle";
import { ENEMIES, getEnemy } from "../../../src/adventure/enemies";
import { freezeMask } from "../../../src/adventure/intents";
import { seededRng } from "./battleHelpers";

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

function checkInvariants(state: BattleState): void {
  const enemy = getEnemy(state.enemyId)!;
  state.grid.forEach((row) =>
    row.forEach((cell) => {
      expect(cell === null || cell === STONE || (Number.isInteger(cell) && cell >= 0 && cell <= 9)).toBe(true);
    }),
  );
  const seen = new Set<string>();
  state.freezes.forEach(({ row, col, turns }) => {
    const cell = state.grid[row][col];
    expect(cell !== null && cell !== STONE).toBe(true);
    expect(turns).toBeGreaterThanOrEqual(1);
    expect(turns).toBeLessThanOrEqual(3);
    expect(seen.has(`${row},${col}`)).toBe(false);
    seen.add(`${row},${col}`);
  });
  expect(state.heroHp).toBeGreaterThanOrEqual(0);
  expect(state.heroHp).toBeLessThanOrEqual(state.heroMaxHp);
  expect(state.mana).toBeGreaterThanOrEqual(0);
  expect(state.enemyHp).toBeGreaterThanOrEqual(0);
  expect(state.enemyHp).toBeLessThanOrEqual(state.enemyMaxHp);
  expect(state.enemyShield).toBeGreaterThanOrEqual(0);
  expect(state.countdown).toBeGreaterThanOrEqual(1);
  expect(state.countdown).toBeLessThanOrEqual(enemy.cycle[state.intentIndex].countdown);
  if (state.status === "victory") expect(state.enemyHp).toBe(0);
  if (state.status === "defeat") expect(state.heroHp).toBe(0);
  if (state.status === "ongoing") {
    expect(state.enemyHp).toBeGreaterThan(0);
    expect(state.heroHp).toBeGreaterThan(0);
    // anti-stall: the player always has a legal slide or a spell they can pay for
    const movable = canMove(state.grid, freezeMask(state.grid.length, state.freezes));
    expect(movable || state.mana >= minSpellCost(state)).toBe(true);
  }
}

/** Random bot: swipes in a random order, hammers the first tile when stuck with mana. Returns the final state. */
function play(enemyId: string, seed: number, maxSteps: number): BattleState {
  const rng = seededRng(seed);
  let state = createBattle({ enemyId, heroHp: 30, heroMaxHp: 30 }, rng).state;
  checkInvariants(state);
  for (let step = 0; step < maxSteps && state.status === "ongoing"; step++) {
    const start = Math.floor(rng() * 4);
    let acted = false;
    for (let k = 0; k < 4 && !acted; k++) {
      const next = applyTurn(state, DIRECTIONS[(start + k) % 4], rng);
      if (next.state !== state) {
        state = next.state;
        acted = true;
      }
    }
    if (!acted) {
      const cell = state.grid.flatMap((row, r) => row.map((v, c) => (v === null ? null : { row: r, col: c }))).find((p) => p);
      const cast = cell ? castSpell(state, "hammer", cell, rng) : null;
      if (cast && cast.applied) {
        state = cast.state;
      } else {
        // stuck and cannot cast: a swipe must resolve the overload
        const forced = applyTurn(state, "left", rng);
        expect(forced.state).not.toBe(state);
        state = forced.state;
      }
    }
    checkInvariants(state);
  }
  return state;
}

describe("seeded random play keeps every invariant (fixed seeds)", () => {
  ENEMIES.forEach((enemy) => {
    it(`${enemy.id}: 3 seeds, 1500 steps max, never breaks an invariant or soft-locks`, () => {
      for (const seed of [11, 222, 3333]) {
        const final = play(enemy.id, seed, 1500);
        checkInvariants(final);
      }
    });
  });

  it("the whole simulation is deterministic", () => {
    expect(play("zeroLord", 7, 400)).toEqual(play("zeroLord", 7, 400));
  });

  it("normal enemies are beatable by random play with a roomy HP pool (smoke check, not a balance test)", () => {
    const results = [11, 222, 3333, 44444].map((seed) => play("slime", seed, 3000).status);
    expect(results).toContain("victory");
  });
});
```

- [ ] **Step 6.2: Run it**

```bash
npx vitest run tests/unit/adventure/battleSimulation.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `11 passed`; full unit `Tests  389 passed (389)`; `tsc` clean.

- [ ] **Step 6.3: Commit**

```bash
git add workspace/tests/unit/adventure/battleSimulation.test.ts
git commit -m "$(cat <<'EOT'
test(merge10): seeded random-play invariants for adventure battles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 7: Full verification

**Files:** none modified.

- [ ] **Step 7.1: Types, unit, build**

Run from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`:
```bash
npx tsc --noEmit
npm run test:unit
npm run build
```
Expected: `tsc` clean; unit `Test Files  27 passed (27)` and `Tests  389 passed (389)`; build prints `built in ...` with no errors. (E2E is not required: no UI, `game.ts` or `index.html` change. Nothing imports `src/adventure/` yet, so the bundle is unchanged.)

- [ ] **Step 7.2: Confirm only new files were added**

```bash
git -C /Users/kyo.lai82/Projects/Personal/game-factory diff --name-status d6762fa -- workspace
```
Expected: only `A` lines: `src/adventure/{battle,enemies,intents}.ts`, `tests/unit/adventure/{battleHelpers.ts,battleOverload,battleSimulation,battleSpells,battleTurn,enemies,intents}...` and no `M` lines.

```bash
grep -rn "adventure" /Users/kyo.lai82/Projects/Personal/game-factory/workspace/src --include=*.ts -l | grep -v "src/adventure/"
```
Expected: prints nothing.

---

## Self-Review (done against spec §3-§5, §9.3, §10, §11 P1 item 3-4)

| Spec item | Covered by |
|---|---|
| §3.1 step order: slide, damage/mana, stone break, intent countdown, spawn, stuck check, win/lose; invalid swipe is not a turn | Task 3 (`applyTurn`, tests "an invalid swipe is not a turn", event-order test), Task 4 (stuck check) |
| §3.2 10 damage and +1 mana per pair; chain (>= 2 pairs) x1.5 floored | Task 3 (`resolvePairs`, chain tests incl. floor and hook multiplier) |
| §3.2 hero HP 10, normal enemy 40-80 HP, boss 150-250 HP | Task 3 (`HERO_START_HP`), Task 1 (HP range test) |
| §3.3 only losing condition is hero HP 0 (a full board is not a loss) | Task 3 (`settle`), Task 4 (full stuck board resolves by overload, never ends the battle), Task 6 |
| §3.4 stone: never pairs, moves, breaks when a neighbour is eliminated | Plan #1 (`STONE`, `canPair`); Task 3 (D1 break rule + tests incl. moved stone, diagonal, vertical) |
| §3.4 frozen: wall, still eliminable, counter, thaw | Plan #1 (`slide` mask); Task 2 (`freezeMask`, `tickFreezes`, `pruneFreezes`); Task 3 (blocking, 3-turn expiry, eliminated wall loses freeze, pinned wall-pair stone break) |
| §3.4 0 needs no special handling, only spells clear it | Task 2 (`resolveZero`), Task 5 (hammer on 0, addOne 0->1) |
| §4.1 layer 1: complement spawn when < 4 empty, 50% | Task 3 (`spawnTile` with `COMPLEMENT_BIAS`, default hook; strategy hook test) |
| §4.2 layer 2: 4 spells, costs 2/2/4/3, casting is not a turn, shuffle skips frozen, no addOne on stones, 9 -> one pair | Task 5 |
| §4.3 layer 3: stuck AND mana < cheapest spell -> -2 HP, clear half (floor, ignore freeze), intent counts down, may defeat | Task 4 (+ post-cast check in Task 5, D7) |
| §5.1 five intents (attack N, rockfall K, freeze 3 turns, shield N stacking, scramble +-1 within 1-9) | Task 2 |
| §5.2 9 enemies, 歸零 for the zero lord, data in `enemies.ts` (HP, cycle, countdown, shape, colour) | Task 1 (roster, boss alternation, 歸零 only on zeroLord) |
| §6 spell upgrades, 1 level each | Task 3 (`SPELLS`, `SpellUpgrades`), Task 5 (upgraded cost test) |
| §7 relic hook points `onBattleStart`, `onPairCleared`, `onOverload`, `onStoneBroken`, `onBattleEnd` (+ value hooks for 連鎖之戒 / 補數護符 / spell cost) | Task 3 (interface, defaults, tests per hook), Task 4 (`onOverload`), Task 5 (`onStoneBroken` cause spell) |
| §9.1 pure functions, injected Rng, nothing in `game.ts` | All tasks; Task 7 grep |
| §9.3 `battle.ts` (`applyTurn`, `castSpell`, overload, win/lose), `intents.ts`, `enemies.ts`; `events` list for the view | Tasks 1-5 (`BattleEvent` union: `slid`, `pairCleared`, `damageDealt`, `intentFired`, `overload`, ...) |
| §10 unit tests with fixed seeds for settlement, chains, intents, special cells, 3 layers | Tasks 1-6 (129 new tests; Task 6 seeded invariants) |
| Plan #1 risk 1 (stone-break frame) | D1 + Task 3 tests |
| Plan #1 risk 4 (frozen-mask bookkeeping for consumed walls) | D2 + Task 3 tests (`pruneFreezes`) |
| Plan #1 risk 5 (addOne on 0) | D3 + Task 5 test |
| Review: pin stone-break at a frozen-wall pair; compose `slide`/`breakAdjacentStones`/`spawnRandomTile` directly; pass the mask to `canMove` everywhere | Task 3 test "pins stone-break at a frozen-wall pair"; `applyTurn` uses no `applyMove`; `shouldOverload`/`castSpell`/`applyTurn` all use `freezeMask` |
| Not in this plan (plan #3): relics, run flow, save/load, trophies, UI, mode menu | n/a |

Type-name consistency check: names in the Interfaces blocks are exactly those in the code: `ENEMIES`, `getEnemy`, `EnemyDef`, `IntentSlot`, `FreezeEntry`, `IntentBoard`, `IntentEffect`, `freezeMask`, `tickFreezes`, `pruneFreezes`, `pickDistinct`, `resolveIntent`, `BattleState`, `BattleSetup`, `BattleEvent`, `TurnResult`, `BattleHooks`, `HookEffect`, `OverloadResponse`, `DEFAULT_HOOKS`, `createBattle`, `applyTurn`, `shouldOverload`, `castSpell`, `SpellResult`, `spellCost`, `minSpellCost`, `currentIntent`.

Pre-validation note: all code in this plan was applied, task by task in this order, to a scratch copy of `workspace/` (outside the repo, at HEAD `d6762fa`) before the plan was written: `npx tsc --noEmit` clean and `npx vitest run` green after every task (270 -> 298 -> 335 -> 351 -> 378 -> 389 tests, 27 files; the red runs failed as described in each task: Tasks 1-3 on the missing module, Task 4 `14 failed | 2 passed`, Task 5 `23 failed | 4 passed`), the final tree is byte-identical to the validated tree, and `vite build` succeeds. The exact code blocks in this plan were generated from the validated files.

## Risks and ambiguities for plan #3

1. **Renderer (from the plan #1 review).** `BoardRenderer.draw` indexes `PALETTES[palette][value]`, so `0` and `STONE` throw until a cell-drawing hook or palette entries exist; there is no frozen overlay (draw a tint plus the remaining turns from `state.freezes`); and the elimination animation ignores frozen walls (`slideRowLeftFrozen` reports a head-wall pair as `[headIndex, start]` while the wall cell is nulled, so the wall tile may animate from the wrong spot). Fix these before showing adventure boards. Stones also have no pop animation for `stoneBroken`.
2. **Events to animation.** The `slid` event carries `prevGrid`, `direction`, `eliminatedPairs`, i.e. exactly the `BoardRenderer.beginElimination` / `beginSlide` inputs. The `grid` field of later events is not included; render from the returned `state.grid`. `tileSpawned` cells feed `beginSpawn`. `stoneBroken.cell` is the post-slide position; `thawed` lists cells whose freeze ended; events are in play order.
3. **Hook composition for the 12 relics.** battle.ts takes one `BattleHooksInput`. Plan #3's `relics.ts` must merge the owned relics into it: value hooks combine (chain multiplier: max or product, spawn strategy: `{ emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 }`, spell cost: sum of deltas), event hooks sum their `HookEffect`s. The six known relics map as: 魔力水晶 `onBattleStart: { mana: 2 }`; 連鎖之戒 `chainMultiplier: () => 2`; 生命之杖 `onBattleEnd: { heroHp: 2 }` (victory only); 暴走之心 `onOverload: { cancelHpLoss: true, enemyDamage: 20 }`; 補數護符 `spawnStrategy` above; 石匠手套 `onStoneBroken: (_s, cells) => ({ enemyDamage: 5 * cells.length })` (fires for spell-broken stones too, D10).
4. **Run layer owns HP between battles.** Copy `state.heroHp` into the next `BattleSetup`; the post-battle choice heals (3 HP, boss half max HP) are run-level and applied after `onBattleEnd`. `BattleState.overloads` supports the trophy "single battle with 3 overloads and win". Shield, mana, freezes, grid reset because a new battle is a new `createBattle`.
5. **Save/load.** `BattleState` is JSON-safe; validate on load with `getEnemy(state.enemyId)` (battle functions throw `Unknown enemy id` for corrupt ids), `intentIndex < cycle.length`, grid dimensions and cell values in `{null, -1, 0..9}`, freezes on occupied non-stone cells. The stone-break line-order mapping assumes stones are never frozen and never removed during a slide; a hand-edited save that freezes a stone would only misattribute a break, not crash.
6. **Tuning.** All numbers (D9, D13) are first drafts; the P2 balance script should drive `applyTurn` with a bot like Task 6's. Random play already shows bosses taking many turns because the hero deals ~10 damage per pair; revisit pair damage or boss HP, not the rules.
7. **Mana on addOne-9.** A 9 cleared by 增幅 refunds 1 mana (cost 2, net -1); with the upgrade (cost 1) it is mana-neutral and deals 10 damage. Intended per spec (counts as a pair) but worth a look in balance.
8. **UI affordances for stuck states.** `shouldOverload(state)` is exported so the view can warn before the player swipes; casting and swiping already resolve it without a soft lock.
