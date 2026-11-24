import { describe, expect, it } from 'vitest';
import { missionLabel, missionPanelText } from './missionLabel.ts';

describe('missionLabel', () => {
  it('fills the target and appends progress', () => {
    expect(missionLabel('Collect {t} stars', { id: 'starsTotal', tier: 2, progress: 4 }, 4)).toBe('Collect 15 stars  4/15');
  });
  it('clamps progress to the target and never goes negative', () => {
    expect(missionLabel('Play {t} runs', { id: 'runs', tier: 1, progress: 0 }, 9)).toBe('Play 3 runs  3/3');
    expect(missionLabel('Play {t} runs', { id: 'runs', tier: 1, progress: 0 }, -2)).toBe('Play 3 runs  0/3');
  });
  it('{es} pluralises: empty for a target of 1', () => {
    expect(missionLabel('Survive {t} rush{es}', { id: 'rush', tier: 1, progress: 0 }, 0)).toBe('Survive 1 rush  0/1');
    expect(missionLabel('Survive {t} rush{es}', { id: 'rush', tier: 2, progress: 0 }, 0)).toMatch(/^Survive \d+ rushes {2}0\/\d+$/);
  });
});

describe('missionPanelText (landscape side panel)', () => {
  const m = { id: 'nearMiss' as const, tier: 1 as const, progress: 0 };
  it('puts the progress on its own consistent second line, never mid-item', () => {
    expect(missionPanelText('Near-miss {t} times', m, 3)).toBe('Near-miss 10 times\n3/10');
  });
  it('every block is exactly two lines (label, progress)', () => {
    const txt = missionPanelText('Play {t} runs', { id: 'runs', tier: 1, progress: 0 }, 1);
    expect(txt.split('\n')).toHaveLength(2);
  });
});
