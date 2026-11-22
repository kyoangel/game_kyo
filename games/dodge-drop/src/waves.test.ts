import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng.ts';
import { BLOCK_H, PLAYER_HITBOX_W, isRush, planWave, waveKindAt } from './waves.ts';
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
