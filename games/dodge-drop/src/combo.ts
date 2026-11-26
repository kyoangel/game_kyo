export const NEAR_MISS_PX = 34;

/** Edge-to-edge horizontal gap; <= 0 means the boxes overlap. */
export function horizontalGap(a: { x: number; w: number }, b: { x: number; w: number }): number {
  return Math.abs(a.x - b.x) - (a.w + b.w) / 2;
}

export function isNearMiss(gap: number, windowPx: number = NEAR_MISS_PX): boolean {
  return gap > 0 && gap <= windowPx;
}
