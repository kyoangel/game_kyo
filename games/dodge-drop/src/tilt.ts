/** Tilt steering: gamma (left/right tilt in portrait, degrees) -> horizontal speed in px/s. */
export const TILT_DEAD_ZONE_DEG = 3;
export const TILT_FULL_DEG = 25;
/** Same as the keyboard max speed. */
export const TILT_MAX_SPEED = 640;

export function tiltToVelocity(gammaDeg: number, neutralDeg: number): number {
  const d = gammaDeg - neutralDeg;
  if (!Number.isFinite(d)) return 0;
  const a = Math.abs(d);
  if (a <= TILT_DEAD_ZONE_DEG) return 0;
  const f = Math.min(1, (a - TILT_DEAD_ZONE_DEG) / (TILT_FULL_DEG - TILT_DEAD_ZONE_DEG));
  return Math.sign(d) * f * TILT_MAX_SPEED;
}
