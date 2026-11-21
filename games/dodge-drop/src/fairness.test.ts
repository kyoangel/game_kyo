import { describe, expect, it } from 'vitest';
import { firstDeadEnd } from './fairness.ts';

const W = 720;
const B = { h: 40 };
const wall = (at: number, gapX: number, speedMul = 1) => {
  const g = 112;
  const lw = gapX - g / 2;
  const rw = W - (gapX + g / 2);
  return [
    { at, x: lw / 2, w: lw, ...B, speedMul },
    { at, x: W - rw / 2, w: rw, ...B, speedMul },
  ];
};

describe('firstDeadEnd', () => {
  it('single wall with a 112 px gap is survivable', () => {
    expect(firstDeadEnd(wall(1, 360), W, 0, 20)).toBeNull();
  });
  it('a block planted in the gap just before the wall is a dead end', () => {
    const spawns = [...wall(5, 360), { at: 4.85, x: 360, w: 100, ...B, speedMul: 1 }];
    expect(firstDeadEnd(spawns, W, 0, 20)).not.toBeNull();
  });
  it('a fast block overtaking a slow wall into its gap is a dead end', () => {
    // spawn times are >= 0.5 s apart, so a spawn-time gap check would pass, yet the fast block
    // catches the slow wall row at the player's height.
    const slowWall = wall(3, 360, 0.6);
    const hits: number[] = [];
    for (let at = 3.5; at < 8; at += 0.05) {
      const fast = { at, x: 360, w: 100, ...B, speedMul: 1.0 };
      if (firstDeadEnd([...slowWall, fast], W, 0, 30) !== null) hits.push(at);
    }
    expect(hits.length).toBeGreaterThan(0);
    expect(firstDeadEnd([...slowWall, { at: 12, x: 360, w: 100, ...B, speedMul: 1.0 }], W, 0, 40)).toBeNull();
  });
  it('blocks far apart in time are survivable', () => {
    const spawns = [...wall(1, 200), { at: 3, x: 200, w: 100, ...B, speedMul: 1 }, ...wall(6, 500)];
    expect(firstDeadEnd(spawns, W, 0, 30)).toBeNull();
  });
});
