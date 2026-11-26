/** Seconds of 3-2-1 warning shown before a rush, surge or Overdrive (owner: speed-ups felt sudden). */
export const WARN_LEAD = 3;

/** The countdown digit to show at clock `t` for a speed-up starting at `start`, or null outside the warning. */
export function countdownAt(t: number, start: number): number | null {
  const left = start - t;
  if (left <= 0 || left > WARN_LEAD) return null;
  return Math.ceil(left);
}
