import { describe, expect, it } from 'vitest';
import { horizontalGap, isNearMiss } from './combo.ts';

describe('near miss', () => {
  it('isNearMiss bounds', () => {
    expect(isNearMiss(0)).toBe(false);
    expect(isNearMiss(-3)).toBe(false);
    expect(isNearMiss(0.1)).toBe(true);
    expect(isNearMiss(28)).toBe(true);
    expect(isNearMiss(28.1)).toBe(false);
  });
  it('horizontalGap is edge to edge', () => {
    expect(horizontalGap({ x: 100, w: 40 }, { x: 200, w: 40 })).toBe(60);
    expect(horizontalGap({ x: 200, w: 40 }, { x: 100, w: 40 })).toBe(60);
    expect(horizontalGap({ x: 100, w: 40 }, { x: 120, w: 40 })).toBeLessThanOrEqual(0);
  });
});

describe('configurable window', () => {
  it('isNearMiss accepts a custom window', () => {
    expect(isNearMiss(30, 32)).toBe(true);
    expect(isNearMiss(30)).toBe(false);
    expect(isNearMiss(0, 32)).toBe(false);
  });
});
