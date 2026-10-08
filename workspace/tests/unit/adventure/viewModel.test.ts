import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import type { BattleEvent } from "../../../src/adventure/battle";
import { ENEMIES } from "../../../src/adventure/enemies";
import {
  boardPixelSize,
  continueSummary,
  damageTotal,
  describeEvent,
  heroDamageTotal,
  KEY_TO_DIRECTION,
  intentView,
  logLines,
  offerTitle,
  offerView,
  progressPips,
  resultView,
  stageLabel,
  stuckHint,
  swipeDirection,
} from "../../../src/adventure/viewModel";
import { gridWith, makeState } from "./battleHelpers";
import { runInBattle } from "./runHelpers";

describe("swipeDirection", () => {
  it("picks the dominant axis", () => {
    expect(swipeDirection(60, 10)).toBe("right");
    expect(swipeDirection(-60, 10)).toBe("left");
    expect(swipeDirection(5, 80)).toBe("down");
    expect(swipeDirection(5, -80)).toBe("up");
  });
  it("short drags are taps, not swipes", () => {
    expect(swipeDirection(10, -10)).toBeNull();
    expect(swipeDirection(29, 0)).toBeNull();
    expect(swipeDirection(30, 0)).toBe("right");
  });
});

describe("KEY_TO_DIRECTION", () => {
  it("maps arrows and WASD like endless mode", () => {
    expect(KEY_TO_DIRECTION.ArrowUp).toBe("up");
    expect(KEY_TO_DIRECTION.d).toBe("right");
    expect(Object.keys(KEY_TO_DIRECTION)).toHaveLength(8);
  });
});

describe("boardPixelSize", () => {
  it("fits iPhone portrait: 390x844 -> 366, 430x932 -> 406", () => {
    expect(boardPixelSize(390, 844)).toBe(366);
    expect(boardPixelSize(430, 932)).toBe(406);
  });
  it("is capped on big screens and floored on tiny ones", () => {
    expect(boardPixelSize(1920, 1400)).toBe(440);
    expect(boardPixelSize(300, 400)).toBe(200);
  });
  it("leaves room for the 350px of other controls", () => {
    expect(boardPixelSize(500, 700)).toBe(350);
  });
});

describe("stageLabel and progressPips", () => {
  it("names the zone and the place inside it", () => {
    expect(stageLabel(0)).toBe("森林 1/3");
    expect(stageLabel(2)).toBe("森林 3/3");
    expect(stageLabel(4)).toBe("冰窟 2/3");
    expect(stageLabel(8)).toBe("魔王塔 3/3");
  });

  it("marks done, current and todo, with a boss flag every third pip", () => {
    const run = runInBattle(gridWith([]), {}, {}, 4);
    const pips = progressPips(run);
    expect(pips).toHaveLength(9);
    expect(pips.map((p) => p.state)).toEqual([
      "done", "done", "done", "done", "current", "todo", "todo", "todo", "todo",
    ]);
    expect(pips.map((p) => p.boss)).toEqual(ENEMIES.map((e) => e.boss));
  });

  it("after a win (reward phase) the next fight is the current one; victory fills all 9", () => {
    const reward = { ...runInBattle(gridWith([]), {}, {}, 1), phase: "reward" as const };
    expect(progressPips(reward).map((p) => p.state).slice(0, 4)).toEqual(["done", "done", "current", "todo"]);
    const won = { ...runInBattle(gridWith([]), {}, {}, 8), phase: "victory" as const };
    expect(progressPips(won).every((p) => p.state === "done")).toBe(true);
  });
});

describe("intentView", () => {
  it("shows an icon and Traditional Chinese text for all 6 intents", () => {
    expect(intentView({ kind: "attack", amount: 2 })).toEqual({ icon: "⚔", text: "攻擊 2" });
    expect(intentView({ kind: "rockfall", amount: 3 })).toEqual({ icon: "🪨", text: "落石 3" });
    expect(intentView({ kind: "freeze", amount: 1 })).toEqual({ icon: "❄", text: "冰凍" });
    expect(intentView({ kind: "freeze", amount: 2 }).text).toBe("冰凍 ×2");
    expect(intentView({ kind: "shield", amount: 10 })).toEqual({ icon: "🛡", text: "護盾 10" });
    expect(intentView({ kind: "scramble", amount: 1 })).toEqual({ icon: "🌀", text: "擾亂" });
    expect(intentView({ kind: "zero", amount: 2 })).toEqual({ icon: "⭕", text: "歸零" });
  });
});

describe("describeEvent / logLines", () => {
  const cell = { row: 0, col: 0 };
  it("describes the interesting events", () => {
    expect(describeEvent({ type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "slide" })).toBe("消除 1 對");
    expect(describeEvent({ type: "pairCleared", count: 2, chain: true, damagePerPair: 15, source: "slide" })).toBe("連鎖！消除 2 對，每對 15 傷害");
    expect(describeEvent({ type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "addOne" })).toBe("增幅消除 1 對");
    expect(describeEvent({ type: "stoneBroken", cell, cause: "adjacent" })).toBe("石塊碎裂");
    expect(describeEvent({ type: "thawed", cells: [cell], cause: "expired" })).toBe("冰凍解除");
    expect(describeEvent({ type: "thawed", cells: [cell], cause: "cleared" })).toBeNull();
    expect(describeEvent({ type: "spellCast", spell: "bomb", cost: 4, target: cell })).toBe("施放爆裂");
    expect(describeEvent({ type: "overload", hpLost: 2, cleared: [cell, cell] })).toBe("魔力暴走！-2 血，清除 2 格");
    expect(describeEvent({ type: "overload", hpLost: 0, cleared: [cell] })).toBe("魔力暴走！清除 1 格");
    expect(describeEvent({ type: "battleEnded", result: "victory" })).toBe("勝利！");
    expect(describeEvent({ type: "battleEnded", result: "defeat" })).toBe("你被擊敗了…");
  });

  it("describes every intent effect", () => {
    const fired = (intent: any, effect: any): BattleEvent => ({ type: "intentFired", intent, effect });
    expect(describeEvent(fired({ kind: "attack", amount: 2 }, { kind: "attack", damage: 2 }))).toBe("敵人攻擊！-2 血");
    expect(describeEvent(fired({ kind: "rockfall", amount: 2 }, { kind: "rockfall", placed: [cell, cell] }))).toBe("落石！2 塊石頭掉落");
    expect(describeEvent(fired({ kind: "freeze", amount: 1 }, { kind: "freeze", frozen: [cell] }))).toBe("冰凍！1 格被凍住");
    expect(describeEvent(fired({ kind: "shield", amount: 10 }, { kind: "shield", gained: 10 }))).toBe("敵人獲得 10 點護盾");
    expect(describeEvent(fired({ kind: "scramble", amount: 1 }, { kind: "scramble", changed: [{ row: 0, col: 0, from: 3, to: 4 }] }))).toBe("擾亂！1 格數字改變");
    expect(describeEvent(fired({ kind: "zero", amount: 2 }, { kind: "zero", zeroed: [cell, cell] }))).toBe("歸零！2 格變成 0");
  });

  it("animation-only events have no text, and logLines drops them", () => {
    const events: BattleEvent[] = [
      { type: "manaChanged", delta: 1, mana: 1 },
      { type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "slide" },
      { type: "tileSpawned", cell, value: 3 },
    ];
    expect(describeEvent(events[0])).toBeNull();
    expect(logLines(events)).toEqual(["消除 1 對"]);
  });

  it("damageTotal and heroDamageTotal add up the numbers for the floating text", () => {
    const events: BattleEvent[] = [
      { type: "damageDealt", amount: 30, absorbed: 10, hpDamage: 20, source: "pair" },
      { type: "damageDealt", amount: 5, absorbed: 0, hpDamage: 5, source: "relic" },
      { type: "heroHpChanged", delta: -2, hp: 8, cause: "attack" },
      { type: "heroHpChanged", delta: 1, hp: 9, cause: "relic" },
    ];
    expect(damageTotal(events)).toBe(35);
    expect(heroDamageTotal(events)).toBe(2);
  });
});

describe("offerView / offerTitle", () => {
  it("describes relic, upgrade and heal offers", () => {
    expect(offerView({ kind: "relic", relicId: "manaCrystal" })).toEqual({ icon: "💎", title: "魔力水晶", desc: "每場戰鬥開始時魔力 +2" });
    expect(offerView({ kind: "upgrade", spell: "bomb" })).toEqual({ icon: "💣", title: "爆裂強化", desc: "魔力消耗 4 → 3" });
    expect(offerView({ kind: "heal", amount: 3 }).title).toBe("回復 3 血");
  });

  it("titles the modal by phase and boss-ness", () => {
    expect(offerTitle({ ...runInBattle(gridWith([])), phase: "relicPick", battle: null })).toBe("選擇一個起始遺物");
    expect(offerTitle({ ...runInBattle(gridWith([])), phase: "reward" })).toBe("戰鬥勝利！選擇一個獎勵");
    expect(offerTitle({ ...runInBattle(gridWith([]), {}, {}, 2), phase: "reward" })).toBe("Boss 討伐！選擇一個遺物");
  });
});

describe("stuckHint", () => {
  it("says nothing while a move exists", () => {
    expect(stuckHint(makeState(gridWith([[1, 2]])))).toBeNull();
  });
  it("tells the player to cast when stuck with a playable spell, and warns about the overload when not", () => {
    const stones = Array.from({ length: 4 }, () => [STONE, STONE, STONE, STONE]);
    expect(stuckHint(makeState(stones, { mana: 2 }))).toBe("盤面卡住了，請施放法術");
    expect(stuckHint(makeState(stones, { mana: 0 }))).toBe("魔力不足，再滑動會觸發魔力暴走");
  });
});

describe("resultView / continueSummary", () => {
  it("defeat shows how far the hero got and who won", () => {
    const run = { ...runInBattle(gridWith([]), {}, { relics: ["chainRing"] }, 5), phase: "defeat" as const };
    expect(resultView(run)).toEqual({
      title: "💀 冒險失敗",
      lines: ["到達第 6 場（冰窟 3/3）", "敗給了六角冰后", "遺物：💍連鎖之戒"],
    });
  });
  it("victory congratulates", () => {
    const run = { ...runInBattle(gridWith([]), {}, {}, 8), phase: "victory" as const };
    const view = resultView(run);
    expect(view.title).toBe("🏆 通關！");
    expect(view.lines[1]).toBe("沒有取得遺物");
  });
  it("the menu button summary", () => {
    expect(continueSummary(runInBattle(gridWith([]), { heroHp: 7 }, {}, 3))).toBe("第 4/9 場 · 冰窟 1/3 · ❤ 7/10");
  });
});
