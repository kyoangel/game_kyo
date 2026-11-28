import { describe, expect, it } from 'vitest';
import { addGraze, GRAZE_FULL } from './graze.ts';

describe('graze gauge (shields)', () => {
  it('8 near misses grant one shield and empty the gauge', () => {
    expect(GRAZE_FULL).toBe(8);
    let g = 0;
    for (let i = 1; i < 8; i++) {
      const r = addGraze(g, true);
      expect(r).toEqual({ gauge: i, shield: false });
      g = r.gauge;
    }
    expect(addGraze(g, true)).toEqual({ gauge: 0, shield: true });
  });
  it('with shields maxed the gauge holds full, then pays on the first near miss with room', () => {
    expect(addGraze(7, false)).toEqual({ gauge: 8, shield: false });
    expect(addGraze(8, false)).toEqual({ gauge: 8, shield: false });
    expect(addGraze(8, true)).toEqual({ gauge: 0, shield: true });
  });
});
