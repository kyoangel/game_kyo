import { emptyBoosts, SHRINK_SCALE, type RunBoosts } from './boosts.ts';
import { rushesBefore, tierSeconds, ASSIST_INTERVAL_MUL, ASSIST_SPEED_MUL, type AssistState, type StartTier } from './progression.ts';
import {
  magnetRadius, shieldCapacity, shieldFirstAt, startShieldChance, type Workshop,
} from './workshop.ts';

export const MAGNET_SPEED = 900;
export const GRACE_SECONDS = 2.0;

export interface RunConfig {
  tier: StartTier; startT: number; grace: number;
  assisted: boolean; speedMul: number; intervalMul: number;
  shieldLevel: number; shieldCapacity: number; startShieldHits: number;
  firstShieldAt: number;
  magnetRadius: number; luckLevel: number;
  rushIdx: number;
  playerScale: number;
  chompArmed: boolean;
}

export function buildRunConfig(i: { workshop: Workshop; assist: AssistState; tier: StartTier; rng: () => number; boosts?: RunBoosts }): RunConfig {
  const { workshop: w, assist, tier, rng } = i;
  const boosts = i.boosts ?? emptyBoosts();
  const startT = tierSeconds(tier);
  const assisted = assist.active;
  const capacity = shieldCapacity(w.shieldStack);
  let freeStartShield = 0;
  if (assisted) freeStartShield = 1;
  else if (w.startShield > 0 && rng() < startShieldChance(w.startShield)) freeStartShield = 1;
  const boughtShields = Math.min(capacity, Math.max(0, Math.floor(boosts.shields)));
  // Free start shield stacks on top of purchased shields so buying up to capacity never wastes coins;
  // in-run pickups are still capped by shieldCapacity.
  const startShieldHits = freeStartShield + boughtShields;
  return {
    tier, startT, grace: startT > 0 ? GRACE_SECONDS : 0,
    assisted, speedMul: assisted ? ASSIST_SPEED_MUL : 1, intervalMul: assisted ? ASSIST_INTERVAL_MUL : 1,
    shieldLevel: w.shield, shieldCapacity: capacity, startShieldHits,
    firstShieldAt: startT + shieldFirstAt(w.shield),
    magnetRadius: magnetRadius(w.magnet),
    luckLevel: w.luck, rushIdx: rushesBefore(startT),
    playerScale: boosts.shrink ? SHRINK_SCALE : 1,
    chompArmed: boosts.chomp,
  };
}
