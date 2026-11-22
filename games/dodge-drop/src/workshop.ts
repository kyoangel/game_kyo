export type UpgradeId = 'shield' | 'startShield' | 'magnet' | 'nearMiss' | 'combo' | 'luck';
export const UPGRADE_IDS: readonly UpgradeId[] = ['shield', 'startShield', 'magnet', 'nearMiss', 'combo', 'luck'];
export const MAX_LEVEL = 5;
export type Workshop = Record<UpgradeId, number>;

function lvl(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(MAX_LEVEL, Math.max(0, Math.floor(level)));
}

export function emptyWorkshop(): Workshop {
  return { shield: 0, startShield: 0, magnet: 0, nearMiss: 0, combo: 0, luck: 0 };
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
export function shieldCapacity(level: number): 1 | 2 {
  return lvl(level) >= MAX_LEVEL ? 2 : 1;
}
export function startShieldChance(level: number): number {
  return lvl(level) / 5;
}
export function magnetRadius(level: number): number {
  const l = lvl(level);
  return l === 0 ? 0 : 40 + 30 * (l - 1);
}
export function nearMissWindow(level: number): number {
  return Math.round(28 * (1 + 0.08 * lvl(level)));
}
export function comboTimeout(level: number): number {
  return 2.5 + 0.15 * lvl(level);
}
export function starInterval(level: number, r: number): number {
  return (6 + 3 * r) * (1 - 0.07 * lvl(level));
}

export function effectValue(id: UpgradeId, level: number): number {
  switch (id) {
    case 'shield': return shieldFirstAt(level);
    case 'startShield': return Math.round(startShieldChance(level) * 100);
    case 'magnet': return magnetRadius(level);
    case 'nearMiss': return nearMissWindow(level);
    case 'combo': return comboTimeout(level);
    case 'luck': return 7 * lvl(level);
  }
}
