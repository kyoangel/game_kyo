/**
 * Strict mobile-phone detection (coarse pointer + narrow short side).
 * Always returns `false` on desktop/laptops so desktop layout & camera stay 100% untouched.
 */
export function isTouchMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return coarse && shortSide <= 540;
}
