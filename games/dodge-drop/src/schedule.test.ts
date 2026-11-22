import { describe, expect, it } from 'vitest';
import { firstDeadEnd } from './fairness.ts';
import { mulberry32 } from './rng.ts';
import { SpawnScheduler } from './schedule.ts';

const W = 720;
// CI runs a lighter set (PROPERTY_SEEDS=100); the nightly workflow runs the full 300.
const N = Number(process.env.PROPERTY_SEEDS ?? 300);
const SEEDS = Array.from({ length: N }, (_, i) => i + 1);

type Opts = { speedMul?: number; intervalMul?: number; startT?: number };

/**
 * Seeds whose planned field has a dead end. Async and yields every few seeds so a long
 * synchronous loop never starves the vitest worker's RPC (seen as "Timeout calling onTaskUpdate" in CI).
 */
async function badSeeds(seeds: number[], opts: Opts, toT: number, validate = true): Promise<number[]> {
  const bad: number[] = [];
  const fromT = opts.startT ?? 0;
  for (const seed of seeds) {
    const all = new SpawnScheduler(mulberry32(seed), W, validate, opts).planUntil(toT);
    if (firstDeadEnd(all, W, fromT, toT, { speedMul: opts.speedMul ?? 1 }) !== null) bad.push(seed);
    if (seed % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return bad;
}

describe('SpawnScheduler', () => {
  it('leaves a survivable path through every field for every seed in 1..N up to 240 s', async () => {
    expect(await badSeeds(SEEDS, {}, 240)).toEqual([]);
  }, 120_000);

  it('the property is meaningful: unvalidated planning is unsurvivable on some seeds', async () => {
    expect((await badSeeds(SEEDS, {}, 180, false)).length).toBeGreaterThan(0);
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

  it('assist multipliers keep every field survivable for every seed in 1..N (validator uses the same speedMul)', async () => {
    expect(await badSeeds(SEEDS, ASSIST, 120)).toEqual([]);
  }, 120_000);

  it('a tier start at 60 s keeps every field survivable for every seed in 1..N', async () => {
    expect(await badSeeds(SEEDS, { startT: 60 }, 150)).toEqual([]);
  }, 120_000);

  it('assist + tier start together stay survivable (seeds 1..100)', async () => {
    expect(await badSeeds(SEEDS.slice(0, 100), { ...ASSIST, startT: 30 }, 110)).toEqual([]);
  }, 120_000);
});
