import { frameFor } from './frame.ts';

/** Shared play-field layout: one source of truth for PlayScene and the fairness validator. */
const FIELD = frameFor('portrait');
export const PLAYER_Y = FIELD.playerY;
/** Thumb control strip (below the player) in game px. */
export const STRIP_TOP = FIELD.stripTop;
export const STRIP_BOTTOM = FIELD.stripBottom;
/** Relative drag sensitivity: 100 px of finger travel moves the player 150 px. */
export const DRAG_GAIN = 1.5;

export function dragToDx(fingerDx: number, zoom = 1): number {
  return (fingerDx * DRAG_GAIN) / (zoom > 0 ? zoom : 1);
}
