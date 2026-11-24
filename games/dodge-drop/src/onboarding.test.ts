// games/dodge-drop/src/onboarding.test.ts
import { describe, expect, it } from 'vitest';
import {
  controlKind, ghostX, onTutorialInput, onTutorialShown, sanitizeOnboarding, shouldShowTutorial,
  tutorialEnded, TUTORIAL_MAX_RUNS, TUTORIAL_SECONDS,
} from './onboarding.ts';

describe('sanitizeOnboarding', () => {
  it('defaults for missing or corrupt data', () => {
    for (const raw of [undefined, null, 5, 'x', [], { shown: 'a' }, { shown: -3, completed: 'yes' }]) {
      expect(sanitizeOnboarding(raw)).toEqual({ shown: 0, completed: false });
    }
  });
  it('keeps valid data', () => {
    expect(sanitizeOnboarding({ shown: 1, completed: true })).toEqual({ shown: 1, completed: true });
  });
});

describe('shouldShowTutorial', () => {
  it('shows on a fresh install', () => {
    expect(shouldShowTutorial({ shown: 0, completed: false })).toBe(true);
  });
  it('never shows again once the player used the controls during it', () => {
    expect(shouldShowTutorial(onTutorialInput({ shown: 1, completed: false }))).toBe(false);
  });
  it('gives up after TUTORIAL_MAX_RUNS shows even if the player never moved', () => {
    let s = sanitizeOnboarding(undefined);
    for (let i = 0; i < TUTORIAL_MAX_RUNS; i++) s = onTutorialShown(s);
    expect(shouldShowTutorial(s)).toBe(false);
  });
});

describe('controlKind', () => {
  it('last input wins', () => {
    expect(controlKind('key', true)).toBe('keys');
    expect(controlKind('touch', false)).toBe('touch');
  });
  it('before any input a coarse pointer means touch, otherwise keys (mouse users get the arrow keys; drag also works)', () => {
    expect(controlKind(null, true)).toBe('touch');
    expect(controlKind(null, false)).toBe('keys');
    expect(controlKind('mouse', false)).toBe('keys');
  });
});

describe('tutorialEnded', () => {
  it('ends on the first real input or after TUTORIAL_SECONDS', () => {
    expect(tutorialEnded(0.5, false)).toBe(false);
    expect(tutorialEnded(0.5, true)).toBe(true);
    expect(tutorialEnded(TUTORIAL_SECONDS, false)).toBe(true);
  });
});

describe('ghostX', () => {
  it('sweeps left and right around the centre, bounded by the amplitude, and is NaN-safe', () => {
    const xs = Array.from({ length: 49 }, (_, i) => ghostX(i * 0.05, 360, 200));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(160 - 1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(560 + 1e-6);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300);
    expect(ghostX(Number.NaN, 360, 200)).toBe(360);
  });
});
