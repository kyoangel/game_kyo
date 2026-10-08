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
