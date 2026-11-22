import { describe, expect, it } from 'vitest';
import { firstDeadEnd } from './fairness.ts';
import { mulberry32 } from './rng.ts';
import { SpawnScheduler } from './schedule.ts';

const W = 720;
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

function failingSeeds(validate: boolean): number[] {
  const bad: number[] = [];
  for (const seed of SEEDS) {
    const all = new SpawnScheduler(mulberry32(seed), W, validate).planUntil(180);
    if (firstDeadEnd(all, W, 0, 180) !== null) bad.push(seed);
  }
  return bad;
}

describe('SpawnScheduler', () => {
  it('leaves a survivable path through every field for seeds 1..300', () => {
    expect(failingSeeds(true)).toEqual([]);
  }, 120_000);

  it('the property is meaningful: unvalidated planning is unsurvivable on some seeds', () => {
    expect(failingSeeds(false).length).toBeGreaterThan(0);
  }, 120_000);

  it('plans 180 s quickly and returns time-sorted spawns', () => {
    const s = new SpawnScheduler(mulberry32(7), W);
    const t0 = performance.now();
    const all = s.planUntil(180);
    expect(performance.now() - t0).toBeLessThan(500);
    for (let i = 1; i < all.length; i++) expect(all[i]!.at).toBeGreaterThanOrEqual(all[i - 1]!.at);
    expect(all.length).toBeGreaterThan(100);
  });

  it('is incremental: planning in steps yields the same spawns as one call', () => {
    const a = new SpawnScheduler(mulberry32(3), W);
    const b = new SpawnScheduler(mulberry32(3), W);
    const stepped = [];
    for (let t = 2.5; t <= 60; t += 0.5) stepped.push(...a.planUntil(t));
    stepped.push(...a.planUntil(60));
    expect(stepped).toEqual(b.planUntil(60));
  });
});

const ASSIST = { speedMul: 0.85, intervalMul: 1.25 };

describe('SpawnScheduler difficulty options', () => {
  it('no options behaves exactly like before', () => {
    const a = new SpawnScheduler(mulberry32(3), W).planUntil(60);
    const b = new SpawnScheduler(mulberry32(3), W, true, {}).planUntil(60);
    expect(b).toEqual(a);
  });

  it('intervalMul 1.25 plans fewer spawns than 1.0 over the same window', () => {
    const n1 = new SpawnScheduler(mulberry32(5), W).planUntil(60).length;
    const n2 = new SpawnScheduler(mulberry32(5), W, true, { intervalMul: 1.25 }).planUntil(60).length;
    expect(n2).toBeLessThan(n1);
  });

  it('startT = 60 plans nothing before startT + 2.0 s of grace', () => {
    const all = new SpawnScheduler(mulberry32(9), W, true, { startT: 60 }).planUntil(120);
    expect(all.length).toBeGreaterThan(20);
    expect(Math.min(...all.map((s) => s.at))).toBeGreaterThanOrEqual(62);
  });

  it('assist multipliers keep every field survivable for seeds 1..300 (validator uses the same speedMul)', () => {
    const bad: number[] = [];
    for (const seed of SEEDS) {
      const all = new SpawnScheduler(mulberry32(seed), W, true, ASSIST).planUntil(120);
      if (firstDeadEnd(all, W, 0, 120, { speedMul: ASSIST.speedMul }) !== null) bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('a tier start at 60 s keeps every field survivable for seeds 1..300', () => {
    const bad: number[] = [];
    for (const seed of SEEDS) {
      const all = new SpawnScheduler(mulberry32(seed), W, true, { startT: 60 }).planUntil(150);
      if (firstDeadEnd(all, W, 60, 150) !== null) bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('assist + tier start together stay survivable (seeds 1..100)', () => {
    const bad: number[] = [];
    for (const seed of SEEDS.slice(0, 100)) {
      const all = new SpawnScheduler(mulberry32(seed), W, true, { ...ASSIST, startT: 30 }).planUntil(110);
      if (firstDeadEnd(all, W, 30, 110, { speedMul: ASSIST.speedMul }) !== null) bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 120_000);
});
