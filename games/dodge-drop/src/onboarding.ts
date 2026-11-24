// games/dodge-drop/src/onboarding.ts
/** First-run control tutorial model. Persisted by the scene under the SaveData key `onboarding` (key-value, no DB). */
export interface Onboarding { shown: number; completed: boolean }
export type LastInput = 'touch' | 'mouse' | 'key' | null;
export type ControlKind = 'touch' | 'keys';

/** Shown at most this many runs when the player ignores it; a real input during it ends it for good. */
export const TUTORIAL_MAX_RUNS = 2;
export const TUTORIAL_SECONDS = 6;
const SWEEP_PERIOD = 2.4;

export function sanitizeOnboarding(raw: unknown): Onboarding {
  const o = (raw ?? {}) as { shown?: unknown; completed?: unknown };
  const shown = typeof o.shown === 'number' && Number.isFinite(o.shown) && o.shown > 0 ? Math.floor(o.shown) : 0;
  return { shown, completed: o.completed === true };
}

export function shouldShowTutorial(s: Onboarding): boolean {
  return !s.completed && s.shown < TUTORIAL_MAX_RUNS;
}
export function onTutorialShown(s: Onboarding): Onboarding {
  return { ...s, shown: s.shown + 1 };
}
export function onTutorialInput(s: Onboarding): Onboarding {
  return { ...s, completed: true };
}

export function controlKind(last: LastInput, coarsePointer: boolean): ControlKind {
  if (last === 'key') return 'keys';
  if (last === 'touch') return 'touch';
  if (last === 'mouse') return 'keys';
  return coarsePointer ? 'touch' : 'keys';
}

export function tutorialEnded(elapsed: number, gotInput: boolean): boolean {
  return gotInput || elapsed >= TUTORIAL_SECONDS;
}

/** Ghost finger x (field px) at `elapsed` s: smooth left-right sweep around `centre`. */
export function ghostX(elapsed: number, centre: number, amplitude: number): number {
  if (!Number.isFinite(elapsed)) return centre;
  return centre + amplitude * Math.sin((elapsed / SWEEP_PERIOD) * Math.PI * 2);
}
