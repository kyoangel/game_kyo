import { describe, expect, it } from 'vitest';
import { addGraze, GRAZE_FULL } from './graze.ts';

describe('graze gauge', () => {
  it('fills by one per near miss and triggers Chomp when full, then empties', () => {
    let g = 0;
    for (let i = 1; i < GRAZE_FULL; i++) {
      const r = addGraze(g, false);
      expect(r).toEqual({ gauge: i, trigger: false });
      g = r.gauge;
    }
    expect(addGraze(g, false)).toEqual({ gauge: 0, trigger: true });
  });
  it('does not fill while already chomping', () => {
    expect(addGraze(3, true)).toEqual({ gauge: 3, trigger: false });
  });
  it('8 near misses fill it', () => expect(GRAZE_FULL).toBe(8));
});
