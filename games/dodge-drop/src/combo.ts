export const NEAR_MISS_PX = 28;
export const COMBO_TIMEOUT = 2.5;
export const MAX_MULT = 5;

/** Edge-to-edge horizontal gap; <= 0 means the boxes overlap. */
export function horizontalGap(a: { x: number; w: number }, b: { x: number; w: number }): number {
  return Math.abs(a.x - b.x) - (a.w + b.w) / 2;
}

export function isNearMiss(gap: number): boolean {
  return gap > 0 && gap <= NEAR_MISS_PX;
}

export class Combo {
  count = 0;
  sinceLast = 0;

  get multiplier(): number {
    return Math.min(MAX_MULT, 1 + Math.floor(this.count / 3));
  }

  hit(): number {
    this.count += 1;
    this.sinceLast = 0;
    return 5 * this.multiplier;
  }

  tick(dt: number): boolean {
    this.sinceLast += dt;
    if (this.count > 0 && this.sinceLast >= COMBO_TIMEOUT) {
      this.reset();
      return true;
    }
    return false;
  }

  reset(): void {
    this.count = 0;
    this.sinceLast = 0;
  }
}
