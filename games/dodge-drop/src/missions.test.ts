import { describe, expect, it } from 'vitest';
import {
  applyRun, drawMission, emptyStats, initialMissions, isComplete, liveProgress, MISSION_POOL, missionTarget,
  newlyCompleted, pickTier, rankFromStars, rankMultiplier, runValue, sanitizeMissions, swapCost, swapMission,
  missionReward, rankProgress, rollDay, localDay, msUntilReset, allDone,
  type Mission, type MissionState, type RunStats,
} from './missions.ts';

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length]!;
};
const stats = (o: Partial<RunStats> = {}): RunStats => ({ ...emptyStats(), ...o });
const DAY = '2026-11-22';
const state = (active: Mission[], stars = 0): MissionState => ({ active, stars, rank: rankFromStars(stars), completedCount: 0, day: DAY, swapsUsed: 0 });

describe('pool', () => {
  it('has the 9 templates with the spec targets and scopes', () => {
    expect(MISSION_POOL.map((d) => [d.id, ...d.targets, d.scope])).toEqual([
      ['nearMiss', 10, 25, 50, 'total'],
      ['combo', 2, 3, 4, 'run'],
      ['survive', 20, 45, 75, 'run'],
      ['starsTotal', 5, 15, 30, 'total'],
      ['starsRun', 3, 6, 10, 'run'],
      ['shieldBreak', 1, 3, 6, 'total'],
      ['score', 150, 400, 800, 'run'],
      ['rush', 1, 2, 4, 'total'],
      ['runs', 3, 6, 10, 'total'],
    ]);
  });
  it('missionTarget reads the tier column', () => {
    expect(missionTarget({ id: 'survive', tier: 2, progress: 0 })).toBe(45);
  });
});

describe('rank', () => {
  it('every 5 mission stars raise rank by 1, starting at 1', () => {
    expect([0, 4, 5, 14, 15].map(rankFromStars)).toEqual([1, 1, 2, 3, 4]);
  });
  it('multiplier is 1 + 0.05(rank-1), capped at 2.00 (rank 21)', () => {
    expect(rankMultiplier(1)).toBe(1);
    expect(rankMultiplier(3)).toBe(1.1);
    expect(rankMultiplier(8)).toBe(1.35);
    expect(rankMultiplier(21)).toBe(2);
    expect(rankMultiplier(40)).toBe(2);
  });
});

describe('pickTier (rank-weighted)', () => {
  it('rank 1-3: 70/30', () => {
    expect([0.69, 0.7, 0.99].map((r) => pickTier(1, () => r))).toEqual([1, 2, 2]);
    expect(pickTier(3, () => 0.8)).toBe(2);
  });
  it('rank 4-7: 40/45/15', () => {
    expect([0.39, 0.4, 0.84, 0.85].map((r) => pickTier(4, () => r))).toEqual([1, 2, 2, 3]);
    expect(pickTier(7, () => 0.99)).toBe(3);
  });
  it('rank 8+: 20/45/35', () => {
    expect([0.19, 0.2, 0.64, 0.65].map((r) => pickTier(8, () => r))).toEqual([1, 2, 2, 3]);
    expect(pickTier(30, () => 0.5)).toBe(2);
  });
});

describe('drawMission / initialMissions', () => {
  it('never draws an excluded template and starts at progress 0', () => {
    const all = MISSION_POOL.map((d) => d.id);
    const left = all[6]!;
    const m = drawMission(all.filter((id) => id !== left), 2, seq(0.5));
    expect(m).toEqual({ id: left, tier: 2, progress: 0 });
  });
  it('picks uniformly among remaining templates (pool order)', () => {
    expect(drawMission([], 1, () => 0).id).toBe('nearMiss');
    expect(drawMission([], 1, () => 0.9999).id).toBe('runs');
  });
  it('initial state: 3 distinct tier-1 missions, rank 1, no stars', () => {
    const s = initialMissions(seq(0.1, 0.5, 0.9), DAY);
    expect(s.active).toHaveLength(3);
    expect(new Set(s.active.map((m) => m.id)).size).toBe(3);
    expect(s.active.every((m) => m.tier === 1 && m.progress === 0)).toBe(true);
    expect([s.stars, s.rank, s.completedCount, s.day, s.swapsUsed]).toEqual([0, 1, 0, DAY, 0]);
  });
});

describe('progress', () => {
  it('runValue maps each template to a stat', () => {
    const s = stats({ nearMisses: 7, maxMultiplier: 3, seconds: 41, stars: 5, shieldBlocks: 2, score: 333, rushes: 1, runs: 1 });
    const v = (id: Mission['id']) => runValue(id, s);
    expect([v('nearMiss'), v('combo'), v('survive'), v('starsTotal'), v('starsRun'), v('shieldBreak'), v('score'), v('rush'), v('runs')]).toEqual([7, 3, 41, 5, 5, 2, 333, 1, 1]);
  });
  it('total scope adds to saved progress; run scope takes the max', () => {
    expect(liveProgress({ id: 'nearMiss', tier: 1, progress: 4 }, stats({ nearMisses: 3 }))).toBe(7);
    expect(liveProgress({ id: 'score', tier: 1, progress: 100 }, stats({ score: 60 }))).toBe(100);
    expect(liveProgress({ id: 'score', tier: 1, progress: 100 }, stats({ score: 180 }))).toBe(180);
  });
  it('isComplete uses the tier target', () => {
    expect(isComplete({ id: 'nearMiss', tier: 1, progress: 9 }, stats({ nearMisses: 1 }))).toBe(true);
    expect(isComplete({ id: 'nearMiss', tier: 1, progress: 8 }, stats({ nearMisses: 1 }))).toBe(false);
  });
  it('newlyCompleted skips ids already toasted', () => {
    const st = state([{ id: 'combo', tier: 1, progress: 0 }, { id: 'score', tier: 1, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }]);
    const s = stats({ maxMultiplier: 2, score: 200 });
    expect(newlyCompleted(st, s, new Set()).map((m) => m.id)).toEqual(['combo', 'score']);
    expect(newlyCompleted(st, s, new Set(['combo'])).map((m) => m.id)).toEqual(['score']);
  });
});

describe('applyRun', () => {
  const active: Mission[] = [
    { id: 'nearMiss', tier: 1, progress: 4 },
    { id: 'combo', tier: 1, progress: 0 },
    { id: 'survive', tier: 2, progress: 0 },
  ];
  it('completes, awards stars + coins, stores progress for the rest, keeps done missions in place', () => {
    const r = applyRun(state(active), stats({ nearMisses: 6, maxMultiplier: 2, seconds: 30 }));
    expect(r.completed.map((m) => m.id)).toEqual(['nearMiss', 'combo']);
    expect(r.starsGained).toBe(2);
    expect(r.coinsGained).toBe(40);
    expect(r.state.stars).toBe(2);
    expect(r.state.completedCount).toBe(2);
    expect(r.state.active.map((m) => m.id)).toEqual(['nearMiss', 'combo', 'survive']);
    expect(r.state.active.map((m) => m.done === true)).toEqual([true, true, false]);
    expect(r.state.active[2]).toEqual({ id: 'survive', tier: 2, progress: 30 });
    expect(r.rankBefore).toBe(1);
    expect(r.rankAfter).toBe(1);
  });
  it('reward is 20 x tier coins', () => {
    expect([1, 2, 3].map((t) => missionReward({ id: 'combo', tier: t as 1 | 2 | 3, progress: 0 }))).toEqual([20, 40, 60]);
    const r = applyRun(state([{ id: 'survive', tier: 2, progress: 0 }, { id: 'combo', tier: 3, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }]), stats({ seconds: 50 }));
    expect(r.coinsGained).toBe(40);
  });
  it('done missions are not completed or rewarded twice', () => {
    const st = state([{ id: 'runs', tier: 1, progress: 3, done: true }, { id: 'combo', tier: 1, progress: 0 }, { id: 'score', tier: 1, progress: 0 }]);
    const r = applyRun(st, stats({ runs: 1 }));
    expect(r.completed).toEqual([]);
    expect(r.coinsGained).toBe(0);
    expect(r.state.active[0]).toEqual({ id: 'runs', tier: 1, progress: 3, done: true });
  });
  it('rank-up when stars cross a multiple of 5', () => {
    const st = state([{ id: 'survive', tier: 2, progress: 0 }, { id: 'combo', tier: 1, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }], 4);
    const r = applyRun(st, stats({ seconds: 50 }));
    expect(r.starsGained).toBe(2);
    expect(r.rankBefore).toBe(1);
    expect(r.rankAfter).toBe(2);
    expect(r.state.rank).toBe(2);
  });
  it('runs mission counts the run', () => {
    const st = state([{ id: 'runs', tier: 1, progress: 2 }, { id: 'combo', tier: 3, progress: 0 }, { id: 'rush', tier: 3, progress: 0 }]);
    expect(applyRun(st, stats({ runs: 1 })).completed.map((m) => m.id)).toEqual(['runs']);
  });
  it('is pure: input state is not mutated', () => {
    const st = state(active.map((m) => ({ ...m })));
    applyRun(st, stats({ nearMisses: 99 }));
    expect(st.active[0]!.progress).toBe(4);
    expect(st.stars).toBe(0);
  });
});

describe('newlyCompleted ignores done missions', () => {
  it('skips done', () => {
    const st = state([{ id: 'combo', tier: 1, progress: 2, done: true }, { id: 'score', tier: 1, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }]);
    expect(newlyCompleted(st, stats({ maxMultiplier: 4, score: 200 }), new Set()).map((m) => m.id)).toEqual(['score']);
  });
});

describe('swap', () => {
  const st = state([{ id: 'nearMiss', tier: 2, progress: 3 }, { id: 'combo', tier: 1, progress: 0, done: true }, { id: 'score', tier: 3, progress: 0 }], 7);
  it('first swap of the day is free, later ones cost 15', () => {
    expect(swapCost(st)).toBe(0);
    expect(swapCost({ ...st, swapsUsed: 1 })).toBe(15);
    expect(swapCost({ ...st, swapsUsed: 4 })).toBe(15);
  });
  it('rejects when poor, index invalid, or mission is done', () => {
    const paid = { ...st, swapsUsed: 1 };
    expect(swapMission(paid, 0, 14, seq(0.5))).toEqual({ ok: false, reason: 'poor' });
    expect(swapMission(st, 5, 999, seq(0.5))).toEqual({ ok: false, reason: 'index' });
    expect(swapMission(st, 1, 999, seq(0.5))).toEqual({ ok: false, reason: 'done' });
  });
  it('free swap spends no coins, bumps swapsUsed, keeps tier and excludes today ids', () => {
    const r = swapMission(st, 0, 0, seq(0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.coins).toBe(0);
    expect(r.state.swapsUsed).toBe(1);
    expect(r.state.active[0]!.tier).toBe(2);
    expect(r.state.active[0]!.progress).toBe(0);
    expect(['nearMiss', 'combo', 'score']).not.toContain(r.state.active[0]!.id);
    expect(r.state.stars).toBe(7);
    expect(r.state.rank).toBe(2);
  });
  it('paid swap costs 15', () => {
    const r = swapMission({ ...st, swapsUsed: 2 }, 0, 100, seq(0));
    expect(r.ok && r.coins).toBe(85);
  });
});

describe('daily rollover', () => {
  const old = (day?: string): MissionState => ({
    active: [{ id: 'combo', tier: 2, progress: 1, done: true }, { id: 'score', tier: 1, progress: 50 }, { id: 'runs', tier: 1, progress: 1 }],
    stars: 12, rank: 3, completedCount: 4, day: day ?? DAY, swapsUsed: 3,
  });
  it('same day: state unchanged', () => {
    const s = old();
    expect(rollDay(s, DAY, seq(0.5))).toBe(s);
  });
  it('new day: 3 fresh distinct missions, swaps reset, stars/rank/count kept', () => {
    const r = rollDay(old('2026-11-21'), DAY, seq(0.1, 0.5, 0.9));
    expect(r.day).toBe(DAY);
    expect(r.swapsUsed).toBe(0);
    expect(r.active).toHaveLength(3);
    expect(new Set(r.active.map((m) => m.id)).size).toBe(3);
    expect(r.active.every((m) => m.progress === 0 && !m.done)).toBe(true);
    expect([r.stars, r.rank, r.completedCount]).toEqual([12, 3, 4]);
  });
  it('localDay formats the local date; msUntilReset counts to next local midnight', () => {
    expect(localDay(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
    expect(msUntilReset(new Date(2026, 10, 2, 22, 30, 0))).toBe(90 * 60 * 1000);
  });
  it('rankProgress shows stars toward next rank; allDone detects a finished day', () => {
    expect(rankProgress(12)).toEqual({ have: 2, need: 5 });
    expect(allDone(old())).toBe(false);
    expect(allDone({ ...old(), active: old().active.map((m) => ({ ...m, done: true })) })).toBe(true);
  });
});

describe('sanitizeMissions', () => {
  it('garbage -> initial state', () => {
    const s = sanitizeMissions('x', seq(0.1, 0.5, 0.9), DAY);
    expect(s.active).toHaveLength(3);
    expect(s.active.every((m) => m.tier === 1)).toBe(true);
  });
  it('drops invalid / duplicate entries, clamps, refills to 3, derives rank from stars', () => {
    const raw = {
      active: [
        { id: 'combo', tier: 2, progress: -5 },
        { id: 'combo', tier: 1, progress: 1 },
        { id: 'nope', tier: 1, progress: 0 },
        { id: 'runs', tier: 9, progress: 2 },
      ],
      stars: 12.7, rank: 99, completedCount: -3, day: DAY, swapsUsed: 2.9,
    };
    const s = sanitizeMissions(raw, seq(0.1, 0.5, 0.9), DAY);
    expect(s.active).toHaveLength(3);
    expect(s.active[0]).toEqual({ id: 'combo', tier: 2, progress: 0 });
    expect(new Set(s.active.map((m) => m.id)).size).toBe(3);
    expect(s.stars).toBe(12);
    expect(s.rank).toBe(3);
    expect(s.completedCount).toBe(0);
  });
  it('keeps done flags and swapsUsed on the same day', () => {
    const s = sanitizeMissions({ active: [{ id: 'combo', tier: 1, progress: 2, done: true }], stars: 3, day: DAY, swapsUsed: 2.9 }, seq(0.1, 0.5, 0.9), DAY);
    expect(s.active[0]).toEqual({ id: 'combo', tier: 1, progress: 2, done: true });
    expect(s.swapsUsed).toBe(2);
  });
  it('old state without day is a new day: fresh set, stars/rank kept', () => {
    const s = sanitizeMissions({ active: [{ id: 'combo', tier: 1, progress: 2 }], stars: 12, completedCount: 4 }, seq(0.1, 0.5, 0.9), DAY);
    expect(s.day).toBe(DAY);
    expect(s.swapsUsed).toBe(0);
    expect(s.active.every((m) => m.progress === 0)).toBe(true);
    expect([s.stars, s.rank, s.completedCount]).toEqual([12, 3, 4]);
  });
});
