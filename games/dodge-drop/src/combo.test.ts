import { describe, expect, it } from 'vitest';
import { COMBO_TIMEOUT, Combo, horizontalGap, isNearMiss } from './combo.ts';

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

describe('Combo', () => {
  const after = (n: number) => {
    const c = new Combo();
    for (let i = 0; i < n; i++) c.hit();
    return c;
  };
  it('multiplier curve', () => {
    expect(after(0).multiplier).toBe(1);
    expect(after(1).multiplier).toBe(1);
    expect(after(3).multiplier).toBe(2);
    expect(after(12).multiplier).toBe(5);
    expect(after(30).multiplier).toBe(5);
  });
  it('hit returns points', () => {
    const c = new Combo();
    expect(c.hit()).toBe(5);
    c.hit();
    expect(c.hit()).toBe(10);
  });
  it('tick timeout', () => {
    const c = after(2);
    expect(c.tick(2.4)).toBe(false);
    expect(c.count).toBe(2);
    expect(c.tick(COMBO_TIMEOUT - 2.4)).toBe(true);
    expect(c.count).toBe(0);
    expect(c.tick(10)).toBe(false);
  });
  it('hit resets timer; reset clears', () => {
    const c = after(1);
    c.tick(2);
    c.hit();
    expect(c.sinceLast).toBe(0);
    c.reset();
    expect(c.count).toBe(0);
  });
});
