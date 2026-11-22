/** Queue slot for the next on-screen toast so overlapping toasts show one after another (times in ms). */
export function nextToastSlot(now: number, freeAt: number, gapMs: number): { showAt: number; freeAt: number } {
  const showAt = Math.max(now, freeAt);
  return { showAt, freeAt: showAt + gapMs };
}
