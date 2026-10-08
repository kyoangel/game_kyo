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
