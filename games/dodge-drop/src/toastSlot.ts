/** Queue slot for the next on-screen toast so overlapping toasts show one after another (times in ms). */
export function nextToastSlot(now: number, freeAt: number, gapMs: number): { showAt: number; freeAt: number } {
  const showAt = Math.max(now, freeAt);
  return { showAt, freeAt: showAt + gapMs };
}

/**
 * When the RUSH banner stops showing. A rush that starts inside the tier-start banner window (gold start at
 * 1:30 coincides with the 1:30 rush) shows its banner right after the tier banner instead of on top of it.
 */
export function rushBannerUntil(rushStart: number, tierBannerEnd: number): number {
  return Math.max(rushStart + 0.8, rushStart < tierBannerEnd ? tierBannerEnd + 0.8 : 0);
}
