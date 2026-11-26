import { OVERDRIVE_T } from './difficulty.ts';

/**
 * The run loop speeds up a little (tempo and pitch) as the blocks do: 1.0 at the start, 1.08 by Overdrive. Kept small:
 * a bigger pitch shift made the music sound off (owner, 2026-11-26). Rush / Overdrive / Chomp loops play at 1.0.
 */
const RAMP = 0.08;
export const MUSIC_RATE_MAX = 1 + RAMP;
/** Steps of 0.01: inaudible as steps, and the rate only changes a few dozen times per run. */
const STEP = 0.01;

export function musicRate(clock: number): number {
  const r = 1 + RAMP * Math.min(1, Math.max(0, clock) / OVERDRIVE_T);
  return Math.round(r / STEP) * STEP;
}
