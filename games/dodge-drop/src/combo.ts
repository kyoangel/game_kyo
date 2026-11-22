export const NEAR_MISS_PX = 28;
export const COMBO_TIMEOUT = 2.5;
export const MAX_MULT = 5;

/** Edge-to-edge horizontal gap; <= 0 means the boxes overlap. */
export function horizontalGap(a: { x: number; w: number }, b: { x: number; w: number }): number {
  return Math.abs(a.x - b.x) - (a.w + b.w) / 2;
}

export function isNearMiss(gap: number, windowPx: number = NEAR_MISS_PX): boolean {
  return gap > 0 && gap <= windowPx;
}

export class Combo {
  count = 0;
  sinceLast = 0;
  readonly timeout: number;

  constructor(timeout: number = COMBO_TIMEOUT) {
    this.timeout = timeout;
  }

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
    if (this.count > 0 && this.sinceLast >= this.timeout) {
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
