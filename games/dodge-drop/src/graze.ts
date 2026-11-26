/** Near misses needed to fill the graze gauge; a full gauge triggers Chomp mode. */
export const GRAZE_FULL = 8;
/** Seconds after any Chomp ends during which near misses do not charge the gauge (owner: late Chomp too frequent). */
export const GRAZE_COOLDOWN = 8;

/**
 * One near miss: +1 on the gauge. Filling it triggers Chomp and empties the gauge. While Chomp is already running
 * the gauge does not fill (no chained rampages). The gauge never decays, so careful play still charges it.
 */
export function addGraze(gauge: number, chomping: boolean, coolingDown = false): { gauge: number; trigger: boolean } {
  if (chomping || coolingDown) return { gauge, trigger: false };
  const g = gauge + 1;
  return g >= GRAZE_FULL ? { gauge: 0, trigger: true } : { gauge: g, trigger: false };
}
