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
