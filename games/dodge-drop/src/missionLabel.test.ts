import { describe, expect, it } from 'vitest';
import { missionLabel } from './missionLabel.ts';

describe('missionLabel', () => {
  it('fills the target and appends progress', () => {
    expect(missionLabel('Collect {t} stars', { id: 'starsTotal', tier: 2, progress: 4 }, 4)).toBe('Collect 15 stars  4/15');
  });
  it('clamps progress to the target and never goes negative', () => {
    expect(missionLabel('Play {t} runs', { id: 'runs', tier: 1, progress: 0 }, 9)).toBe('Play 3 runs  3/3');
    expect(missionLabel('Play {t} runs', { id: 'runs', tier: 1, progress: 0 }, -2)).toBe('Play 3 runs  0/3');
  });
});
