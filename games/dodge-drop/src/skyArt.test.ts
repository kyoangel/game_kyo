import { describe, expect, it } from 'vitest';
import { cloudLobes } from './skyArt.ts';

describe('storm cloud art matches the hit box', () => {
  it('every lobe stays inside the w x h box for all block widths', () => {
    for (let w = 16; w <= 720; w += 8) {
      for (const l of cloudLobes(0, 0, w, 40)) {
        expect(l.x - l.r).toBeGreaterThanOrEqual(-1e-9);
        expect(l.x + l.r).toBeLessThanOrEqual(w + 1e-9);
        expect(l.y - l.r).toBeGreaterThanOrEqual(-1e-9);
        expect(l.y + l.r).toBeLessThanOrEqual(40 + 1e-9);
      }
    }
  });
  it('wider clouds get more lobes', () => {
    expect(cloudLobes(0, 0, 80, 40).length).toBeLessThan(cloudLobes(0, 0, 300, 40).length);
  });
});
