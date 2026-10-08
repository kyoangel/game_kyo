/**
 * Pure helpers for the adventure screen: text, icons, sizes and swipe maths.
 * No DOM, no Canvas, so all of it is unit-tested; `view.ts` only wires these
 * into elements. All player-facing text is Traditional Chinese.
 */
import { canMove, type Direction } from "../grid";
import {
  SPELLS,
  hasPlayableSpell,
  shouldOverload,
  type BattleEvent,
  type BattleHooksInput,
  type BattleState,
  type SpellId,
} from "./battle";
import { ENEMIES, getEnemy, type Intent, type Zone } from "./enemies";
import { freezeMask } from "./intents";
import { getRelic } from "./relics";
import { TOTAL_BATTLES, type RewardOption, type RunState } from "./run";

export const SWIPE_MIN_PX = 30;

/** Same keys as endless mode: arrows and WASD. */
export const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

/** Dominant axis of a drag, or null when it is too short to count as a swipe. */
export function swipeDirection(dx: number, dy: number, minPx: number = SWIPE_MIN_PX): Direction | null {
  if (Math.abs(dx) < minPx && Math.abs(dy) < minPx) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Height of everything on the adventure screen except the board (top bar, enemy card, hero row, spells, relics, log). */
export const ADV_CHROME_HEIGHT = 350;
export const ADV_SIDE_MARGIN = 24;
export const ADV_BOARD_MAX = 440;
export const ADV_BOARD_MIN = 200;

/** Square board size so that the whole adventure screen fits the viewport (iPhone 390x844 -> 366). */
export function boardPixelSize(viewportWidth: number, viewportHeight: number): number {
  const size = Math.min(viewportWidth - ADV_SIDE_MARGIN, viewportHeight - ADV_CHROME_HEIGHT, ADV_BOARD_MAX);
  return Math.max(ADV_BOARD_MIN, Math.floor(size));
}

export const ZONE_NAMES: Record<Zone, string> = { forest: "森林", ice: "冰窟", tower: "魔王塔" };
export const SPELL_ICONS: Record<SpellId, string> = { hammer: "🔨", addOne: "➕", bomb: "💣", shuffle: "🔀" };
export const SPELL_HELP: Record<SpellId, string> = {
  hammer: "點一格打碎（數字、石塊、0 都可以）",
  addOne: "點一格數字 +1（9 直接消除，算一對）",
  bomb: "點一格，清除它和上下左右共 5 格",
  shuffle: "重新排列盤面上的格子（冰凍格不動）",
};

/** "森林 1/3": zone name and the fight's place within the zone. */
export function stageLabel(battleIndex: number): string {
  const enemy = ENEMIES[battleIndex];
  return `${ZONE_NAMES[enemy.zone]} ${(battleIndex % 3) + 1}/3`;
}

export interface Pip {
  state: "done" | "current" | "todo";
  boss: boolean;
}

/** The 9-step progress strip: fights already won, the current one, and those still ahead. */
export function progressPips(run: RunState): Pip[] {
  const cleared = run.phase === "victory" ? TOTAL_BATTLES : run.phase === "reward" ? run.battleIndex + 1 : run.battleIndex;
  return ENEMIES.map((enemy, i) => ({
    boss: enemy.boss,
    state: i < cleared ? "done" : i === cleared && run.phase !== "victory" ? "current" : "todo",
  }));
}

export function intentView(intent: Intent): { icon: string; text: string } {
  switch (intent.kind) {
    case "attack":
      return { icon: "⚔", text: `攻擊 ${intent.amount}` };
    case "rockfall":
      return { icon: "🪨", text: `落石 ${intent.amount}` };
    case "freeze":
      return { icon: "❄", text: intent.amount > 1 ? `冰凍 ×${intent.amount}` : "冰凍" };
    case "shield":
      return { icon: "🛡", text: `護盾 ${intent.amount}` };
    case "scramble":
      return { icon: "🌀", text: "擾亂" };
    case "zero":
      return { icon: "⭕", text: "歸零" };
  }
}

/** One log line for an event, or null for events that only drive animation. */
export function describeEvent(event: BattleEvent): string | null {
  switch (event.type) {
    case "pairCleared":
      if (event.source === "addOne") return "增幅消除 1 對";
      return event.chain ? `連鎖！消除 ${event.count} 對，每對 ${event.damagePerPair} 傷害` : `消除 ${event.count} 對`;
    case "stoneBroken":
      return "石塊碎裂";
    case "thawed":
      return event.cause === "expired" ? "冰凍解除" : null;
    case "intentFired": {
      const effect = event.effect;
      switch (effect.kind) {
        case "attack":
          return `敵人攻擊！-${effect.damage} 血`;
        case "rockfall":
          return `落石！${effect.placed.length} 塊石頭掉落`;
        case "freeze":
          return `冰凍！${effect.frozen.length} 格被凍住`;
        case "shield":
          return `敵人獲得 ${effect.gained} 點護盾`;
        case "scramble":
          return `擾亂！${effect.changed.length} 格數字改變`;
        case "zero":
          return `歸零！${effect.zeroed.length} 格變成 0`;
      }
      return null;
    }
    case "spellCast":
      return `施放${SPELLS[event.spell].name}`;
    case "overload":
      return event.hpLost > 0
        ? `魔力暴走！-${event.hpLost} 血，清除 ${event.cleared.length} 格`
        : `魔力暴走！清除 ${event.cleared.length} 格`;
    case "battleEnded":
      return event.result === "victory" ? "勝利！" : "你被擊敗了…";
    default:
      return null;
  }
}

export function logLines(events: BattleEvent[]): string[] {
  return events.flatMap((event) => {
    const line = describeEvent(event);
    return line ? [line] : [];
  });
}

/** Total damage the hero dealt in a batch of events (for the floating "-N"). */
export function damageTotal(events: BattleEvent[]): number {
  return events.reduce((sum, e) => (e.type === "damageDealt" ? sum + e.amount : sum), 0);
}

/** HP the hero lost in a batch of events (for the floating "-N" on the hero). */
export function heroDamageTotal(events: BattleEvent[]): number {
  return events.reduce((sum, e) => (e.type === "heroHpChanged" && e.delta < 0 ? sum - e.delta : sum), 0);
}

export interface OfferView {
  icon: string;
  title: string;
  desc: string;
}

export function offerView(option: RewardOption): OfferView {
  switch (option.kind) {
    case "relic": {
      const relic = getRelic(option.relicId);
      return { icon: relic?.icon ?? "❓", title: relic?.name ?? option.relicId, desc: relic?.description ?? "" };
    }
    case "upgrade": {
      const spell = SPELLS[option.spell];
      return {
        icon: SPELL_ICONS[option.spell],
        title: `${spell.name}強化`,
        desc: `魔力消耗 ${spell.cost} → ${spell.upgradedCost}`,
      };
    }
    case "heal":
      return { icon: "❤️", title: `回復 ${option.amount} 血`, desc: "回復血量（不超過上限）" };
  }
}

/** Modal heading for the pending choice. */
export function offerTitle(run: RunState): string {
  if (run.phase === "relicPick") return "選擇一個起始遺物";
  const boss = Boolean(getEnemy(run.battle?.enemyId ?? "")?.boss);
  return boss ? "Boss 討伐！選擇一個遺物" : "戰鬥勝利！選擇一個獎勵";
}

/** A hint under the board when the player is stuck (spec 4.3 / plan 2 risk 8). */
export function stuckHint(state: BattleState, hooks: BattleHooksInput = {}): string | null {
  if (state.status !== "ongoing") return null;
  if (canMove(state.grid, freezeMask(state.grid.length, state.freezes))) return null;
  if (shouldOverload(state, hooks)) return "魔力不足，再滑動會觸發魔力暴走";
  return hasPlayableSpell(state, hooks) ? "盤面卡住了，請施放法術" : null;
}

export function resultView(run: RunState): { title: string; lines: string[] } {
  const relics = run.relics.map((id) => getRelic(id)).flatMap((r) => (r ? [`${r.icon}${r.name}`] : []));
  const relicLine = relics.length > 0 ? `遺物：${relics.join(" ")}` : "沒有取得遺物";
  if (run.phase === "victory") {
    return { title: "🏆 通關！", lines: ["你擊敗了零之魔王！", relicLine] };
  }
  const enemy = getEnemy(run.battle?.enemyId ?? "");
  return {
    title: "💀 冒險失敗",
    lines: [
      `到達第 ${run.battleIndex + 1} 場（${stageLabel(run.battleIndex)}）`,
      enemy ? `敗給了${enemy.name}` : "",
      relicLine,
    ].filter((line) => line !== ""),
  };
}

/** One-line summary for the "繼續冒險" button on the menu. */
export function continueSummary(run: RunState): string {
  return `第 ${run.battleIndex + 1}/${TOTAL_BATTLES} 場 · ${stageLabel(run.battleIndex)} · ❤ ${run.heroHp}/${run.heroMaxHp}`;
}
