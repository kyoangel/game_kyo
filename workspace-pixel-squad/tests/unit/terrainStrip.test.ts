import { describe, it, expect } from 'vitest';
import { terrainPattern } from '../../src/ui/terrainStrip';

describe('terrainPattern', () => {
  const rects = terrainPattern(360, 580);
  it('至少有底色兩塊+圖樣', () => expect(rects.length).toBeGreaterThan(10));
  it('全部落在帶內', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(360);
      expect(r.y).toBeGreaterThanOrEqual(580);
      expect(r.y + r.h).toBeLessThanOrEqual(580 + 56);
    }
  });
  it('確定性(同輸入同輸出)', () => expect(terrainPattern(360, 580)).toEqual(rects));
});
