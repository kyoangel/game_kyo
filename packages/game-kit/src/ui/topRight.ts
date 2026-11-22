/** Centre-to-centre spacing of the round top-right icon buttons (mute, fullscreen, game extras). */
export const TOP_RIGHT_STEP = 76;
/** X of the right-most icon (mute) measured from the right edge. */
export const TOP_RIGHT_MARGIN = 60;

/** X of the n-th top-right icon slot (0 = mute, 1 = next to it, ...): one tight, equally spaced group. */
export function topRightSlotX(width: number, index: number): number {
  return width - TOP_RIGHT_MARGIN - TOP_RIGHT_STEP * index;
}
