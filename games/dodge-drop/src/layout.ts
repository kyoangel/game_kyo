/** Shared play-field layout: one source of truth for PlayScene and the fairness validator. */
export const PLAYER_Y = 1000;
/** Thumb control strip (below the player) in game px. */
export const STRIP_TOP = 1060;
export const STRIP_BOTTOM = 1280;
/** Relative drag sensitivity: 100 px of finger travel moves the player 150 px. */
export const DRAG_GAIN = 1.5;

export function dragToDx(fingerDx: number): number {
  return fingerDx * DRAG_GAIN;
}
