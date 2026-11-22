import { headStartScore, rushesBefore, tierSeconds, ASSIST_INTERVAL_MUL, ASSIST_SPEED_MUL, type AssistState, type StartTier } from './progression.ts';
import {
  comboTimeout, magnetRadius, nearMissWindow, shieldCapacity, shieldFirstAt, startShieldChance, type Workshop,
} from './workshop.ts';

export const MAGNET_SPEED = 900;
export const GRACE_SECONDS = 2.0;

export interface RunConfig {
  tier: StartTier; startT: number; grace: number; headStart: number;
  assisted: boolean; speedMul: number; intervalMul: number;
  shieldLevel: number; shieldCapacity: number; startShieldHits: number;
  firstShieldAt: number;
  magnetRadius: number; nearMissWindow: number; comboTimeout: number; luckLevel: number;
  rushIdx: number;
}

export function buildRunConfig(i: { workshop: Workshop; assist: AssistState; tier: StartTier; rng: () => number }): RunConfig {
  const { workshop: w, assist, tier, rng } = i;
  const startT = tierSeconds(tier);
  const assisted = assist.active;
  const capacity = shieldCapacity(w.shieldStack);
  let startShieldHits = 0;
  if (assisted) startShieldHits = 1;
  else if (w.startShield > 0 && rng() < startShieldChance(w.startShield)) startShieldHits = 1;
  return {
    tier, startT, grace: startT > 0 ? GRACE_SECONDS : 0, headStart: headStartScore(tier),
    assisted, speedMul: assisted ? ASSIST_SPEED_MUL : 1, intervalMul: assisted ? ASSIST_INTERVAL_MUL : 1,
    shieldLevel: w.shield, shieldCapacity: capacity, startShieldHits,
    firstShieldAt: startT + shieldFirstAt(w.shield),
    magnetRadius: magnetRadius(w.magnet), nearMissWindow: nearMissWindow(w.nearMiss), comboTimeout: comboTimeout(w.combo),
    luckLevel: w.luck, rushIdx: rushesBefore(startT),
  };
}
