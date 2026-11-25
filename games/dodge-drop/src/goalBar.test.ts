import { describe, expect, it } from 'vitest';
import { nextGoal } from './goalBar.ts';

describe('nextGoal (seconds survived, score, best score)', () => {
  it('starts at Bronze 15 s with an empty bar', () => {
    expect(nextGoal(0, 0, 0)).toEqual({ kind: 'medal', id: 'bronze', targetSec: 15, fromSec: 0, frac: 0, remainingSec: 15 });
  });
  it('fills linearly toward the target', () => {
    const g = nextGoal(7.5, 0, 0);
    expect(g).toMatchObject({ kind: 'medal', id: 'bronze', frac: 0.5, remainingSec: 8 });
  });
  it('advances at the threshold and restarts the bar from the previous tier', () => {
    expect(nextGoal(15, 0, 0)).toMatchObject({ id: 'silver', fromSec: 15, targetSec: 30, frac: 0, remainingSec: 15 });
    expect(nextGoal(45, 0, 0)).toMatchObject({ id: 'gold', fromSec: 30, targetSec: 60, frac: 0.5 });
  });
  it('a Silver tier start (t = 30) goes straight to Gold', () => {
    expect(nextGoal(30, 0, 0)).toMatchObject({ id: 'gold', fromSec: 30, frac: 0 });
  });
  it('after the top medal it shows percent of the personal best, capped at 100', () => {
    expect(nextGoal(240, 250, 500)).toEqual({ kind: 'best', percent: 50, frac: 0.5, best: 500 });
    expect(nextGoal(300, 900, 500)).toEqual({ kind: 'best', percent: 100, frac: 1, best: 500 });
  });
  it('after the top medal with no best there is no goal', () => {
    expect(nextGoal(240, 250, 0)).toEqual({ kind: 'none' });
  });
  it('is safe on NaN and negatives', () => {
    expect(nextGoal(Number.NaN, Number.NaN, 0)).toMatchObject({ id: 'bronze', frac: 0 });
    expect(nextGoal(-4, 0, 0)).toMatchObject({ id: 'bronze', frac: 0 });
  });
});
