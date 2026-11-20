export const PLAYER_SPEED = 520; // px/s for keyboard movement

export function spawnInterval(elapsedSec: number): number {
  return Math.max(0.25, 0.9 - elapsedSec * 0.02);
}

export function fallSpeed(elapsedSec: number): number {
  return Math.min(900, 260 + elapsedSec * 12);
}
