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

  it('portrait output is unchanged from v2.8.4 (literals from the pre-change function) plus the new anchors', () => {
    const l = titleLayout(720, 1280, 2);
    expect(l).toMatchObject({ width: 720, height: 1280, landscape: false, menuStep: 96, menuButtonW: 280, menuButtonH: 72 });
    expect([l.below, l.menuTop, l.menuBottom, l.titleY, l.tapY, l.bestY, l.menuY0].map((n) => Math.round(n * 10) / 10))
      .toEqual([829.6, 885.6, 1053.6, 384, 704, 793.6, 921.6]);
  });
  it('landscape 1440x810: title block, menu column and extras columns fit with >= 24 px margins and big buttons', () => {
    const l = titleLayout(1440, 810, 2);
    expect(l.landscape).toBe(true);
    expect(l.menuButtonH).toBeGreaterThanOrEqual(88); // 49 css px at 800x450
    for (const y of [l.titleY, l.tapY, l.bestY]) {
      expect(y).toBeGreaterThanOrEqual(24);
      expect(y).toBeLessThanOrEqual(810 - 24);
    }
    expect(l.titleY).toBeLessThan(l.tapY);
    expect(l.tapY).toBeLessThan(l.bestY);
    expect(l.bestY).toBeLessThan(l.menuTop);
    expect(l.menuTop).toBeGreaterThanOrEqual(24);
    expect(l.menuBottom).toBeLessThanOrEqual(810 - 24);
    expect(l.menuBottom - l.menuTop).toBeCloseTo(l.menuStep + l.menuButtonH, 6);
    // extras live in two side columns that never touch the centre column or the canvas edge
    expect(l.left.x0).toBeGreaterThanOrEqual(24);
    expect(l.left.x1).toBeLessThan(720 - l.menuButtonW / 2 - 24);
    expect(l.right.x0).toBeGreaterThan(720 + l.menuButtonW / 2 + 24);
    expect(l.right.x1).toBeLessThanOrEqual(1440 - 24);
    expect(l.extrasTop).toBeGreaterThanOrEqual(24);
    expect(l.extrasBottom).toBeLessThanOrEqual(810 - 24);
  });
  it('landscape menu column still fits with 3 menu items', () => {
    expect(titleLayout(1440, 810, 3).menuBottom).toBeLessThanOrEqual(810 - 24);
  });
});
