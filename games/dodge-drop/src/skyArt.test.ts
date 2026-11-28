import { describe, expect, it } from 'vitest';
import { cloudLobes } from './skyArt.ts';

describe('storm cloud art matches the hit box', () => {
  it('every lobe stays inside the w x h box for all block widths', () => {
    for (const h of [40, 52, 64, 80]) {
      for (let w = 16; w <= 720; w += 8) {
        for (const l of cloudLobes(0, 0, w, h)) {
          expect(l.x - l.r).toBeGreaterThanOrEqual(-1e-9);
          expect(l.x + l.r).toBeLessThanOrEqual(w + 1e-9);
          expect(l.y - l.r).toBeGreaterThanOrEqual(-1e-9);
          expect(l.y + l.r).toBeLessThanOrEqual(h + 1e-9);
        }
      }
    }
  });
  it('wider clouds get more lobes', () => {
    expect(cloudLobes(0, 0, 80, 40).length).toBeLessThan(cloudLobes(0, 0, 300, 40).length);
  });
});
