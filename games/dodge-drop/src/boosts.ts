export type BoostId = 'shield' | 'shrink' | 'chomp';

export const BOOST_IDS: readonly BoostId[] = ['shield', 'shrink', 'chomp'];

export const BOOST_COSTS: Record<BoostId, number> = {
  shield: 10,
  shrink: 15,
  chomp: 20,
};

/** Visual & hitbox scale multiplier when Mini Mode (shrink) is active. */
export const SHRINK_SCALE = 0.7;

/** Duration (seconds) of the Pac-Chomp rampage after triggering. */
export const CHOMP_DURATION = 6;

/** Brief invulnerability (seconds) right after Pac-Chomp ends. */
export const CHOMP_EXIT_INVULN = 1.0;

/** Bonus score per block eaten during Pac-Chomp. */
export const CHOMP_BLOCK_SCORE = 15;

export interface RunBoosts {
  shields: number;
  shrink: boolean;
  chomp: boolean;
}

export function emptyBoosts(): RunBoosts {
  return { shields: 0, shrink: false, chomp: false };
}

export function sanitizeBoosts(raw: unknown, shieldCap: number): RunBoosts {
  const cap = Math.max(1, Math.floor(Number.isFinite(shieldCap) ? shieldCap : 1));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyBoosts();
  const o = raw as Record<string, unknown>;
  const rawShields = typeof o.shields === 'number' && Number.isFinite(o.shields) && o.shields > 0 ? Math.floor(o.shields) : 0;
  return {
    shields: Math.min(cap, rawShields),
    shrink: o.shrink === true,
    chomp: o.chomp === true,
  };
}

export function canBuyBoost(boosts: RunBoosts, id: BoostId, coins: number, shieldCap: number): boolean {
  if (coins < BOOST_COSTS[id]) return false;
  if (id === 'shield') return boosts.shields < Math.max(1, Math.floor(shieldCap));
  if (id === 'shrink') return !boosts.shrink;
  return !boosts.chomp;
}

export function buyBoost(
  state: { coins: number; boosts: RunBoosts; shieldCap: number },
  id: BoostId,
): { ok: true; coins: number; boosts: RunBoosts } | { ok: false; reason: 'poor' | 'maxed' } {
  const cost = BOOST_COSTS[id];
  const cap = Math.max(1, Math.floor(state.shieldCap));
  if (id === 'shield' && state.boosts.shields >= cap) return { ok: false, reason: 'maxed' };
  if (id === 'shrink' && state.boosts.shrink) return { ok: false, reason: 'maxed' };
  if (id === 'chomp' && state.boosts.chomp) return { ok: false, reason: 'maxed' };
  if (state.coins < cost) return { ok: false, reason: 'poor' };

  const next: RunBoosts = { ...state.boosts };
  if (id === 'shield') next.shields += 1;
  else if (id === 'shrink') next.shrink = true;
  else next.chomp = true;

  return { ok: true, coins: state.coins - cost, boosts: next };
}

/** True when the quick-buy bar button does something on tap: buys, or undoes an equipped boost. */
export function canToggleBoost(boosts: RunBoosts, id: BoostId, coins: number, shieldCap: number): boolean {
  return canBuyBoost(boosts, id, coins, shieldCap) || isEquipped(boosts, id);
}

function isEquipped(boosts: RunBoosts, id: BoostId): boolean {
  return id === 'shield' ? boosts.shields > 0 : id === 'shrink' ? boosts.shrink : boosts.chomp;
}

/**
 * Quick-buy bar tap: buys when possible, otherwise undoes the boost for a full refund so a mis-tap is never
 * a lost purchase. Shields stack up to the cap; the tap after that (or one that cannot afford the next shield)
 * refunds every bought shield at once.
 */
export function toggleBoost(
  state: { coins: number; boosts: RunBoosts; shieldCap: number },
  id: BoostId,
): { ok: true; action: 'buy' | 'refund'; coins: number; boosts: RunBoosts } | { ok: false; reason: 'poor' } {
  const bought = buyBoost(state, id);
  if (bought.ok) return { ...bought, action: 'buy' };
  if (!isEquipped(state.boosts, id)) return { ok: false, reason: 'poor' };
  const next: RunBoosts = { ...state.boosts };
  let refund = BOOST_COSTS[id];
  if (id === 'shield') {
    refund *= next.shields;
    next.shields = 0;
  } else if (id === 'shrink') next.shrink = false;
  else next.chomp = false;
  return { ok: true, action: 'refund', coins: state.coins + refund, boosts: next };
}
