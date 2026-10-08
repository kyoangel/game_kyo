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
