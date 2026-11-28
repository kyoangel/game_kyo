export type UpgradeId = 'shield' | 'shieldStack' | 'startShield' | 'magnet' | 'luck' | 'grazeCharge';
export const UPGRADE_IDS: readonly UpgradeId[] = ['shield', 'shieldStack', 'startShield', 'magnet', 'luck', 'grazeCharge'];
/**
 * Upgrades removed in v3.8.0 with the graze gauge (owner: graze-triggered Chomp felt out of place): "Daredevil"
 * (near-miss window) and "Longer Chomp" (graze Chomp length). Saved levels are refunded once, see migrateWorkshop.
 */
export const RETIRED_UPGRADE_IDS: readonly string[] = ['nearMiss', 'combo'];
export const MAX_LEVEL = 5;
export type Workshop = Record<UpgradeId, number>;

/** Levels an upgrade can reach: Graze Charger (owner 2026-11-28: 8 -> 7 -> 6 -> 5 near misses) has 3, the rest 5. */
export function maxLevel(id: UpgradeId): number {
  return id === 'grazeCharge' ? 3 : MAX_LEVEL;
}

function lvl(level: number, max = MAX_LEVEL): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(max, Math.max(0, Math.floor(level)));
}

export function emptyWorkshop(): Workshop {
  return { shield: 0, shieldStack: 0, startShield: 0, magnet: 0, luck: 0, grazeCharge: 0 };
}

export function sanitizeWorkshop(raw: unknown): Workshop {
  const out = emptyWorkshop();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const rec = raw as Record<string, unknown>;
  for (const id of UPGRADE_IDS) {
    const v = rec[id];
    out[id] = typeof v === 'number' && Number.isFinite(v) ? lvl(v, maxLevel(id)) : 0;
  }
  return out;
}

/**
 * Star coins spent on retired upgrades in a saved workshop (refunded in full). `changed` is true when the save still
 * holds a retired key, so the caller rewrites it once and the refund is never paid twice.
 */
export function migrateWorkshop(raw: unknown): { workshop: Workshop; refund: number; changed: boolean } {
  const workshop = sanitizeWorkshop(raw);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { workshop, refund: 0, changed: false };
  const rec = raw as Record<string, unknown>;
  let refund = 0;
  let changed = false;
  for (const id of RETIRED_UPGRADE_IDS) {
    if (!(id in rec)) continue;
    changed = true;
    const v = rec[id];
    const level = typeof v === 'number' ? lvl(v) : 0;
    for (let n = 1; n <= level; n++) refund += upgradeCost(n);
  }
  return { workshop, refund, changed };
}

export function upgradeCost(n: number): number {
  return Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL ? Math.round(15 * 1.6 ** (n - 1)) : Infinity;
}

export function nextCost(level: number, max = MAX_LEVEL): number | null {
  const l = lvl(level, max);
  return l >= max ? null : upgradeCost(l + 1);
}

export function buyUpgrade(
  state: { coins: number; levels: Workshop },
  id: string,
): { ok: true; coins: number; levels: Workshop } | { ok: false; reason: 'max' | 'poor' | 'unknown' } {
  if (!(UPGRADE_IDS as readonly string[]).includes(id)) return { ok: false, reason: 'unknown' };
  const uid = id as UpgradeId;
  const cost = nextCost(state.levels[uid], maxLevel(uid));
  if (cost === null) return { ok: false, reason: 'max' };
  if (state.coins < cost) return { ok: false, reason: 'poor' };
  return { ok: true, coins: state.coins - cost, levels: { ...state.levels, [uid]: lvl(state.levels[uid]) + 1 } };
}

export function shieldFirstAt(level: number): number {
  return 25 - 3 * lvl(level);
}
export function shieldInterval(level: number, r: number): number {
  return (30 + 10 * r) * 0.9 ** lvl(level);
}
/** Max shields held at once: 1 + Shield Stack level (the argument is the shieldStack level). */
export function shieldCapacity(stackLevel: number): number {
  return 1 + lvl(stackLevel);
}
/** A shield pickup adds one held shield up to capacity, never reducing an already over-cap count. */
export function shieldAfterPickup(held: number, capacity: number): number {
  return Math.max(held, Math.min(capacity, held + 1));
}
export function startShieldChance(level: number): number {
  return lvl(level) / 5;
}
const MAGNET_RADII: readonly number[] = [0, 80, 140, 220, 320, Infinity];
/** Pull radius in px by level; `Infinity` at max level = the whole screen. */
export function magnetRadius(level: number): number {
  return MAGNET_RADII[lvl(level)]!;
}
/** Whether the magnet pulls this pickup: stars always, shields only while another can still be held. */
export function magnetPulls(kind: 'star' | 'shield', dist: number, radius: number, shieldHits: number, capacity: number): boolean {
  if (radius <= 0 || dist > radius) return false;
  return kind === 'star' || shieldHits < capacity;
}
/** Near misses that fill the graze gauge for one shield: 8 minus the Graze Charger level (5 at max). */
export function grazeNeeded(level: number): number {
  return 8 - lvl(level, maxLevel('grazeCharge'));
}
export function starInterval(level: number, r: number): number {
  return (6 + 3 * r) * (1 - 0.07 * lvl(level));
}

export function effectValue(id: UpgradeId, level: number): number {
  switch (id) {
    case 'shield': return shieldFirstAt(level);
    case 'shieldStack': return shieldCapacity(level);
    case 'startShield': return Math.round(startShieldChance(level) * 100);
    case 'magnet': return magnetRadius(level);
    case 'luck': return 7 * lvl(level);
    case 'grazeCharge': return grazeNeeded(level);
  }
}
