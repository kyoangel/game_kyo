/** Near misses needed to fill the graze gauge; a full gauge grants one shield (owner decision 2026-11-28). */
export const GRAZE_FULL = 8;

/**
 * One near miss: +1 on the gauge. Filling it grants a shield and empties the gauge. When no more shields can be held
 * (`canHold` false) the gauge stays full and the shield is granted on the first near miss after a slot frees up.
 * The gauge never decays.
 */
export function addGraze(gauge: number, canHold: boolean): { gauge: number; shield: boolean } {
  const g = Math.min(GRAZE_FULL, gauge + 1);
  if (g < GRAZE_FULL) return { gauge: g, shield: false };
  return canHold ? { gauge: 0, shield: true } : { gauge: GRAZE_FULL, shield: false };
}
