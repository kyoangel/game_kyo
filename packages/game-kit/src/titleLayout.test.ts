import { describe, expect, it } from 'vitest';
import { titleLayout } from './titleLayout.ts';

describe('titleLayout', () => {
  it('derives bands from the canvas height and menu size', () => {
    const l = titleLayout(720, 1280, 2);
    expect(l.below).toBeCloseTo(829.6, 1);
    expect(l.menuTop).toBeCloseTo(885.6, 1);
    expect(l.menuBottom).toBeCloseTo(1053.6, 1);
    expect(l.width).toBe(720);
  });
  it('menuBottom grows by 96 px per extra button', () => {
    expect(titleLayout(720, 1280, 3).menuBottom - titleLayout(720, 1280, 2).menuBottom).toBeCloseTo(96, 6);
  });
  it('with no menu items menuBottom sits just above menuTop', () => {
    const l = titleLayout(720, 1280, 0);
    expect(l.menuBottom).toBeLessThanOrEqual(l.menuTop);
  });
});
