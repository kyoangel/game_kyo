/** Pure helpers for the Overdrive racing streaks; PlayScene only renders. */
export const EDGE_W = 130;
export const MAX_STREAKS = 28;
const MAX_RATE = 34; // streaks per second at full intensity

export function streakSpawnRate(intensity: number): number {
  return MAX_RATE * Math.max(0, Math.min(1, intensity));
}
/** r in [0,1] picks within the 0.2..0.6 range. */
export function streakAlpha(intensity: number, r: number): number {
  return (0.2 + 0.4 * r) * Math.max(0, Math.min(1, intensity));
}
export function vignetteAlpha(intensity: number): number {
  return 0.55 * Math.max(0, Math.min(1, intensity));
}
/** side 0 = left, 1 = right; r in [0,1]. r^2 bias puts most streaks near the outer edge. */
export function streakX(side: 0 | 1, r: number, width: number): number {
  const off = r * r * EDGE_W;
  return side === 0 ? off : width - off;
}
export function streakWidth(r: number): number {
  return 2 + 2 * r;
}
export function streakLen(r: number): number {
  return 90 + 170 * r;
}
export function streakSpeed(blockSpeed: number): number {
  return 2.5 * blockSpeed;
}
