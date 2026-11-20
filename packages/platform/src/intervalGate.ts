export interface IntervalGate {
  tryPass(): boolean;
}

export function createIntervalGate(minIntervalMs: number, now: () => number = () => Date.now()): IntervalGate {
  let last = Number.NEGATIVE_INFINITY;
  return {
    tryPass() {
      const t = now();
      if (t - last < minIntervalMs) return false;
      last = t;
      return true;
    },
  };
}
