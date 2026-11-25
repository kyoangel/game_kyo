import { OVERDRIVE_T, overdrive } from './difficulty.ts';

/** Music speeds up (tempo and pitch) as the blocks do: 1.0 at the start, +0.2 by Overdrive, +0.05 more in it. */
const RAMP = 0.2;
const OVERDRIVE_EXTRA = 0.05;
export const MUSIC_RATE_MAX = 1 + RAMP + OVERDRIVE_EXTRA;
/** Steps of 0.01: inaudible as steps, and the rate only changes a few dozen times per run. */
const STEP = 0.01;

export function musicRate(clock: number): number {
  const r = 1 + RAMP * Math.min(1, Math.max(0, clock) / OVERDRIVE_T) + OVERDRIVE_EXTRA * overdrive(clock);
  return Math.round(r / STEP) * STEP;
}
