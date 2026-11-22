import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng.ts';
import {
  BLOCK_H, PLAYER_HITBOX_W, isRush, planWave, rainRow, rainRowBlocks, rainRowExpected, rainWidthRange, rowHasGap,
  stairsWidth, waveKindAt, zigzagWidthRange,
} from './waves.ts';
import type { WaveKind } from './waves.ts';

const W = 720;
const KINDS: WaveKind[] = ['rain', 'wall', 'stairs', 'zigzag', 'rainHeavy'];

describe('waveKindAt', () => {
  it('follows the timeline', () => {
    expect(waveKindAt(5)).toBe('rain');
    expect(waveKindAt(15)).toBe('wall');
    expect(waveKindAt(35)).toBe('stairs');
    expect(waveKindAt(55)).toBe('zigzag');
    expect(waveKindAt(75)).toBe('rainHeavy');
    expect(waveKindAt(95)).toBe('wall');
  });
});

describe('isRush', () => {
  it('is active 4 s every 45 s from 45', () => {
    expect(isRush(46)).toBe(true);
    expect(isRush(50)).toBe(false);
    expect(isRush(91)).toBe(true);
    expect(isRush(10)).toBe(false);
    expect(isRush(135)).toBe(false);
    expect(isRush(136)).toBe(false);
    expect(isRush(181)).toBe(true); // surge from Diamond
    expect(isRush(185)).toBe(false);
    expect(isRush(211)).toBe(true);
  });
});

describe('planWave fairness', () => {
  for (const kind of KINDS) {
    for (const t of [12, 60, 150]) {
      it(`${kind} at t=${t} is fair over seeds 1..200`, () => {
        for (let seed = 1; seed <= 200; seed++) {
          const rng = mulberry32(seed);
          const prevGapX = 100 + rng() * 520;
          const plan = planWave(kind, t, rng, W, prevGapX);
          expect(plan.duration).toBeGreaterThan(0);
          expect(plan.spawns.length).toBeGreaterThan(0);
          for (const s of plan.spawns) {
            expect(s.h).toBe(BLOCK_H);
            expect(s.at).toBeGreaterThanOrEqual(0);
            expect(s.x - s.w / 2).toBeGreaterThanOrEqual(-1e-9);
            expect(s.x + s.w / 2).toBeLessThanOrEqual(W + 1e-9);
          }
          // no overlap among equal-at spawns
          const byAt = new Map<number, typeof plan.spawns>();
          for (const s of plan.spawns) byAt.set(s.at, [...(byAt.get(s.at) ?? []), s]);
          for (const row of byAt.values()) {
            const sorted = [...row].sort((a, b) => a.x - b.x);
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i - 1].x + sorted[i - 1].w / 2).toBeLessThanOrEqual(sorted[i].x - sorted[i].w / 2 + 1e-9);
            }
          }
          if (kind === 'wall') {
            const sorted = [...plan.spawns].sort((a, b) => a.x - b.x);
            let edge = 0;
            const gaps: number[] = [];
            for (const s of sorted) {
              const l = s.x - s.w / 2;
              if (l - edge > 1e-6) gaps.push(l - edge);
              edge = s.x + s.w / 2;
            }
            if (W - edge > 1e-6) gaps.push(W - edge);
            expect(gaps.length).toBe(1);
            expect(gaps[0]).toBeGreaterThanOrEqual(2.2 * PLAYER_HITBOX_W);
            expect(plan.gapX).toBeDefined();
            expect(Math.abs((plan.gapX as number) - prevGapX)).toBeLessThanOrEqual(360);
          } else {
            expect(plan.gapX).toBeUndefined();
          }
          if (kind === 'zigzag') {
            for (const s of plan.spawns) {
              const l = s.x - s.w / 2;
              const r = s.x + s.w / 2;
              expect(r <= W / 3 + 1e-9 || l >= (2 * W) / 3 - 1e-9).toBe(true);
            }
          }
        }
      });
    }
  }

  it('is deterministic for a seed', () => {
    expect(planWave('stairs', 30, mulberry32(7), W)).toEqual(planWave('stairs', 30, mulberry32(7), W));
  });
  it('rain uses slow blocks before 10 s', () => {
    const p = planWave('rain', 3, mulberry32(1), W);
    expect(p.spawns.every((s) => s.speedMul === 0.6)).toBe(true);
  });
  it('wall works without prevGapX', () => {
    expect(planWave('wall', 15, mulberry32(3), W).gapX).toBeDefined();
  });
});

describe('intervalMul', () => {
  it('stretches rain, stairs and zigzag spacing; default is unchanged', () => {
    const mk = () => mulberry32(5);
    const base = planWave('rain', 20, mk(), 720);
    const slow = planWave('rain', 20, mk(), 720, undefined, 1.25);
    expect(slow.spawns.length).toBeLessThan(base.spawns.length);
    expect(planWave('rain', 20, mk(), 720, undefined, 1)).toEqual(base);
    const s0 = planWave('stairs', 30, mk(), 720);
    const s1 = planWave('stairs', 30, mk(), 720, undefined, 1.25);
    expect(s1.spawns[1]!.at).toBeCloseTo(s0.spawns[1]!.at * 1.25, 9);
    expect(s1.duration).toBeGreaterThan(s0.duration);
    const z0 = planWave('zigzag', 50, mk(), 720);
    const z1 = planWave('zigzag', 50, mk(), 720, undefined, 1.25);
    expect(z1.spawns[1]!.at).toBeCloseTo(z0.spawns[1]!.at * 1.25, 9);
  });
});

describe('density curve (2.3)', () => {
  it('expected blocks per row: 1 -> 1.6 at 120 -> 2.2 at 180 -> 2.8 at 240, flat after', () => {
    const at = [0, 30, 75, 120, 150, 180, 300].map(rainRowExpected);
    expect(rainRowExpected(210)).toBeCloseTo(2.5, 9);
    expect(rainRowExpected(240)).toBeCloseTo(2.8, 9);
    [1, 1, 1.3, 1.6, 1.9, 2.2, 2.8].forEach((v, i) => expect(at[i]).toBeCloseTo(v, 9));
  });
  it('rainRowBlocks is floor/ceil of the expectation, max 3', () => {
    expect(rainRowBlocks(0, () => 0)).toBe(1);
    expect(rainRowBlocks(30, () => 0.99)).toBe(1);
    expect(rainRowBlocks(150, () => 0.0)).toBe(2); // e=1.9, rng<0.9 -> +1
    expect(rainRowBlocks(150, () => 0.95)).toBe(1);
    expect(rainRowBlocks(180, () => 0.0)).toBe(3);
    expect(rainRowBlocks(180, () => 0.99)).toBe(2);
    expect(rainRowBlocks(240, () => 0.79)).toBe(3);
    expect(rainRowBlocks(240, () => 0.81)).toBe(2);
    expect(rainRowBlocks(300, () => 0.0)).toBe(3);
  });
  it('width ranges: 60-160 until 30 s, 80-180 from 240 s', () => {
    expect(rainWidthRange(0)).toEqual({ min: 60, max: 160 });
    expect(rainWidthRange(30)).toEqual({ min: 60, max: 160 });
    expect(rainWidthRange(135)).toEqual({ min: 70, max: 170 });
    expect(rainWidthRange(240)).toEqual({ min: 80, max: 180 });
    expect(rainWidthRange(300)).toEqual({ min: 80, max: 180 });
  });
  it('stairs and zigzag widths', () => {
    expect(stairsWidth(0, 720)).toBe(120);
    expect(stairsWidth(30, 720)).toBe(120);
    expect(stairsWidth(135, 720)).toBe(140);
    expect(stairsWidth(240, 720)).toBe(160);
    expect(stairsWidth(300, 720)).toBe(160);
    expect(zigzagWidthRange(0)).toEqual({ min: 100, max: 180 });
    expect(zigzagWidthRange(240)).toEqual({ min: 120, max: 200 });
    expect(zigzagWidthRange(300)).toEqual({ min: 120, max: 200 });
  });
  it('every rain row is non-overlapping, in bounds and leaves a >= 2.2 x hitbox gap', () => {
    for (const t of [0, 30, 75, 120, 150, 180, 300]) {
      for (let seed = 1; seed <= 400; seed++) {
        const row = rainRow(t, mulberry32(seed), W);
        expect(row.length).toBeGreaterThanOrEqual(1);
        expect(row.length).toBeLessThanOrEqual(3);
        expect(rowHasGap(row, W)).toBe(true);
        const sorted = [...row].sort((a, b) => a.x - b.x);
        for (let i = 0; i < sorted.length; i++) {
          expect(sorted[i]!.x - sorted[i]!.w / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(sorted[i]!.x + sorted[i]!.w / 2).toBeLessThanOrEqual(W + 1e-9);
          if (i > 0) expect(sorted[i - 1]!.x + sorted[i - 1]!.w / 2).toBeLessThanOrEqual(sorted[i]!.x - sorted[i]!.w / 2 + 1e-9);
        }
      }
    }
  });
  it('planWave rain emits whole rows sharing one spawn time', () => {
    const p = planWave('rain', 180, mulberry32(4), W);
    const byAt = new Map<number, number>();
    for (const s of p.spawns) byAt.set(s.at, (byAt.get(s.at) ?? 0) + 1);
    expect(Math.max(...byAt.values())).toBeGreaterThanOrEqual(2);
  });
  it('mean coverage is about 15% at 30 s, 25% at 120 s, rising to ~48% by 240 s', () => {
    const cov = (t: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 2000; seed++) sum += rainRow(t, mulberry32(seed), W).reduce((a, b) => a + b.w, 0) / W;
      return sum / 2000;
    };
    expect(cov(30)).toBeGreaterThan(0.12);
    expect(cov(30)).toBeLessThan(0.18);
    expect(cov(120)).toBeGreaterThan(0.2);
    expect(cov(120)).toBeLessThan(0.3);
    expect(cov(180)).toBeGreaterThan(0.33);
    expect(cov(180)).toBeLessThan(0.45);
    expect(cov(240)).toBeGreaterThan(0.42);
    expect(cov(240)).toBeLessThan(0.55);
  });
});
