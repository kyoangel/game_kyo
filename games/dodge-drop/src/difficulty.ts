export const PLAYER_SPEED = 520; // px/s for keyboard movement

/** From this clock second on, rushes stop and Overdrive ramps block speed up for good. */
export const OVERDRIVE_T = 120;
const OVERDRIVE_RAMP = 10;

/** From Diamond (180 s) on: a 4 s surge every 30 s (180, 210, ...) at x1.2 on top of top speed, forever. */
export const SURGE_T = 180;
export const SURGE_EVERY = 30;
export const SURGE_LEN = 4;
export const SURGE_MUL = 1.2;
export function isSurge(t: number): boolean {
  return t >= SURGE_T && (t - SURGE_T) % SURGE_EVERY < SURGE_LEN;
}

export function spawnInterval(elapsedSec: number): number {
  if (elapsedSec <= 32.5) return Math.max(0.25, 0.9 - elapsedSec * 0.02);
  return Math.max(0.15, 0.25 - 0.0011 * (elapsedSec - 32.5));
}

export function fallSpeed(elapsedSec: number): number {
  const base = 260 + elapsedSec * 12;
  if (base <= 900) return base;
  return Math.min(1150, 900 + 4 * (elapsedSec - 800 / 15));
}

/** Overdrive intensity 0..1 (1 from 130 s). */
export function overdrive(t: number): number {
  return t < OVERDRIVE_T ? 0 : Math.min(1, (t - OVERDRIVE_T) / OVERDRIVE_RAMP);
}

/** Single source of truth for the block-motion multiplier (PlayScene and the fairness validator). */
export function speedBoost(t: number): number {
  if (t < OVERDRIVE_T) return t >= 45 && (t - 45) % 45 < 4 ? 1.4 : 1;
  return (1 + 0.3 * overdrive(t)) * (isSurge(t) ? SURGE_MUL : 1);
}
