export function addTrauma(current: number, amount: number): number {
  return Math.min(1, Math.max(0, current + amount));
}

export function decayTrauma(current: number, dtSec: number, rate = 1.6): number {
  return Math.max(0, current - rate * dtSec);
}

export function shakeOffset(trauma: number, maxPx: number, rng: () => number): { x: number; y: number } {
  const mag = maxPx * trauma * trauma;
  return { x: mag * (rng() * 2 - 1), y: mag * (rng() * 2 - 1) };
}
