export type UpgradeId = 'shield' | 'shieldStack' | 'startShield' | 'magnet' | 'nearMiss' | 'combo' | 'luck';
export const UPGRADE_IDS: readonly UpgradeId[] = ['shield', 'shieldStack', 'startShield', 'magnet', 'nearMiss', 'combo', 'luck'];
export const MAX_LEVEL = 5;
export type Workshop = Record<UpgradeId, number>;

function lvl(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(MAX_LEVEL, Math.max(0, Math.floor(level)));
}

export function emptyWorkshop(): Workshop {
  return { shield: 0, shieldStack: 0, startShield: 0, magnet: 0, nearMiss: 0, combo: 0, luck: 0 };
}

export function sanitizeWorkshop(raw: unknown): Workshop {
  const out = emptyWorkshop();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const rec = raw as Record<string, unknown>;
  for (const id of UPGRADE_IDS) {
    const v = rec[id];
    out[id] = typeof v === 'number' && Number.isFinite(v) ? lvl(v) : 0;
  }
  return out;
}

export function upgradeCost(n: number): number {
  return Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL ? Math.round(15 * 1.6 ** (n - 1)) : Infinity;
}

export function nextCost(level: number): number | null {
  const l = lvl(level);
  return l >= MAX_LEVEL ? null : upgradeCost(l + 1);
}

export function buyUpgrade(
  state: { coins: number; levels: Workshop },
  id: string,
): { ok: true; coins: number; levels: Workshop } | { ok: false; reason: 'max' | 'poor' | 'unknown' } {
  if (!(UPGRADE_IDS as readonly string[]).includes(id)) return { ok: false, reason: 'unknown' };
  const uid = id as UpgradeId;
  const cost = nextCost(state.levels[uid]);
  if (cost === null) return { ok: false, reason: 'max' };
  if (state.coins < cost) return { ok: false, reason: 'poor' };
  return { ok: true, coins: state.coins - cost, levels: { ...state.levels, [uid]: lvl(state.levels[uid]) + 1 } };
}

export function shieldFirstAt(level: number): number {
  return 25 - 3 * lvl(level);
}
export function shieldInterval(level: number, r: number): number {
  return (30 + 10 * r) * 0.92 ** lvl(level);
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
export function nearMissWindow(level: number): number {
  return Math.round(28 * (1 + 0.08 * lvl(level)));
}
/** "Longer Chomp" (upgrade id `combo`, kept for saves): seconds of the graze-triggered Chomp. */
export function grazeChompSeconds(level: number): number {
  return 4 + 0.5 * lvl(level);
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
    case 'nearMiss': return nearMissWindow(level);
    case 'combo': return grazeChompSeconds(level);
    case 'luck': return 7 * lvl(level);
  }
}
