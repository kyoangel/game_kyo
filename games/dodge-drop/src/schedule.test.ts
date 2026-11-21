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
