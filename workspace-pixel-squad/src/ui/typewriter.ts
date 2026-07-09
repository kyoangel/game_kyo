// Typewriter reveal pacing for the tenchi2-style battle message window.
// See docs/specs/pixel-squad/battle-screen-tenchi2-homage.md "底部視窗帶".

export function visibleChars(elapsedMs: number, cps: number, total: number): number {
  return Math.min(total, Math.floor((elapsedMs / 1000) * cps));
}
