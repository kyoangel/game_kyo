import { describe, it, expect } from "vitest";
import type { BattleEvent } from "../../../src/adventure/battle";
import { STONE } from "../../../src/grid";
import { enemyActionCue, stuckSpells } from "../../../src/adventure/viewModel";
import { gridWith, makeState } from "./battleHelpers";

const fired = (effect: Extract<BattleEvent, { type: "intentFired" }>["effect"], kind = effect.kind): BattleEvent => ({
  type: "intentFired",
  intent: { kind, amount: 1 },
  effect,
});

describe("enemyActionCue", () => {
  it("is null when nothing enemy-driven happened", () => {
    expect(enemyActionCue([])).toBeNull();
    expect(enemyActionCue([{ type: "stoneBroken", cell: { row: 0, col: 0 }, cause: "spell" }])).toBeNull();
  });

  it("rockfall lists the placed stones", () => {
    const placed = [{ row: 0, col: 1 }, { row: 2, col: 3 }];
    expect(enemyActionCue([fired({ kind: "rockfall", placed })])).toEqual({
      icon: "🪨",
      text: "🪨 落石！2 塊石頭掉落",
      cells: placed,
    });
  });

  it("freeze lists the frozen cells", () => {
    const frozen = [{ row: 1, col: 1 }];
    expect(enemyActionCue([fired({ kind: "freeze", frozen })])).toEqual({
      icon: "❄",
      text: "❄ 冰凍！1 格被凍住",
      cells: frozen,
    });
  });

  it("scramble lists the changed cells", () => {
    const cue = enemyActionCue([
      fired({ kind: "scramble", changed: [{ row: 0, col: 0, from: 3, to: 4 }, { row: 1, col: 2, from: 5, to: 4 }] }),
    ]);
    expect(cue?.icon).toBe("🌀");
    expect(cue?.text).toBe("🌀 擾亂！2 格數字改變");
    expect(cue?.cells).toEqual([{ row: 0, col: 0 }, { row: 1, col: 2 }]);
  });

  it("zero lists the zeroed cells", () => {
    const zeroed = [{ row: 0, col: 0 }, { row: 3, col: 3 }];
    expect(enemyActionCue([fired({ kind: "zero", zeroed })])).toEqual({
      icon: "⭕",
      text: "⭕ 歸零！2 格變成 0",
      cells: zeroed,
    });
  });

  it("shield and attack have no cells", () => {
    expect(enemyActionCue([fired({ kind: "shield", gained: 8 })])).toEqual({
      icon: "🛡",
      text: "🛡 敵人獲得 8 點護盾",
      cells: [],
    });
    expect(enemyActionCue([fired({ kind: "attack", damage: 2 })])).toEqual({
      icon: "⚔",
      text: "⚔ 敵人攻擊！-2 血",
      cells: [],
    });
  });

  it("overload shows the cleared cells", () => {
    const cleared = [{ row: 0, col: 0 }];
    expect(enemyActionCue([{ type: "overload", hpLost: 2, cleared }])).toEqual({
      icon: "💥",
      text: "💥 魔力暴走！-2 血，清除 1 格",
      cells: cleared,
    });
  });

  it("uses the last cue-worthy event in the batch", () => {
    const cue = enemyActionCue([fired({ kind: "shield", gained: 3 }), fired({ kind: "attack", damage: 1 })]);
    expect(cue?.icon).toBe("⚔");
  });
});

describe("stuckSpells", () => {
  const stones = Array.from({ length: 4 }, () => [STONE, STONE, STONE, STONE]);
  it("lists the playable spells when stuck with mana", () => {
    expect(stuckSpells(makeState(stones, { mana: 2 }))).toContain("hammer");
  });
  it("is empty when a move exists, when mana is short (overload case), or the battle is over", () => {
    expect(stuckSpells(makeState(gridWith([[1, 2]]), { mana: 5 }))).toEqual([]);
    expect(stuckSpells(makeState(stones, { mana: 0 }))).toEqual([]);
    expect(stuckSpells(makeState(stones, { mana: 5, status: "defeat" }))).toEqual([]);
  });
  it("is empty for every non-ongoing status even when the board is stuck with mana", () => {
    expect(stuckSpells(makeState(stones, { mana: 5, status: "victory" }))).toEqual([]);
    expect(stuckSpells(makeState(stones, { mana: 5, status: "defeat" }))).toEqual([]);
  });
  it("is empty while the board can still move, even with plenty of mana", () => {
    expect(stuckSpells(makeState(gridWith([[1, 1], [2, 3]]), { mana: 9 }))).toEqual([]);
  });
});
