import { describe, expect, it } from 'vitest';
import {
  applyRun, drawMission, emptyStats, initialMissions, isComplete, liveProgress, MISSION_POOL, missionTarget,
  newlyCompleted, pickTier, rankFromStars, rankMultiplier, runValue, sanitizeMissions, swapCost, swapMission,
  missionReward, rankProgress, SWAP_COST,
  type Mission, type MissionState, type RunStats,
} from './missions.ts';

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length]!;
};
const stats = (o: Partial<RunStats> = {}): RunStats => ({ ...emptyStats(), ...o });
const state = (active: Mission[], stars = 0): MissionState => ({ active, stars, rank: rankFromStars(stars), completedCount: 0 });

describe('pool', () => {
  it('has the 9 templates with the spec targets and scopes', () => {
    expect(MISSION_POOL.map((d) => [d.id, ...d.targets, d.scope])).toEqual([
      ['nearMiss', 10, 25, 50, 'total'],
      ['chompRun', 1, 2, 3, 'run'],
      ['survive', 20, 45, 75, 'run'],
      ['starsTotal', 5, 15, 30, 'total'],
      ['starsRun', 3, 6, 10, 'run'],
      ['shieldBreak', 1, 3, 6, 'total'],
      ['chompEat', 5, 12, 20, 'run'],
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
    const s = initialMissions(seq(0.1, 0.5, 0.9));
    expect(s.active).toHaveLength(3);
    expect(new Set(s.active.map((m) => m.id)).size).toBe(3);
    expect(s.active.every((m) => m.tier === 1 && m.progress === 0)).toBe(true);
    expect([s.stars, s.rank, s.completedCount]).toEqual([0, 1, 0]);
    expect(Object.keys(s).sort()).toEqual(['active', 'completedCount', 'rank', 'stars']);
  });
});

describe('progress', () => {
  it('runValue maps each template to a stat', () => {
    const s = stats({ nearMisses: 7, grazeChomps: 3, seconds: 41, stars: 5, shieldBlocks: 2, chompEats: 333, rushes: 1, runs: 1 });
    const v = (id: Mission['id']) => runValue(id, s);
    expect([v('nearMiss'), v('chompRun'), v('survive'), v('starsTotal'), v('starsRun'), v('shieldBreak'), v('chompEat'), v('rush'), v('runs')]).toEqual([7, 3, 41, 5, 5, 2, 333, 1, 1]);
  });
  it('total scope adds to saved progress; run scope takes the max', () => {
    expect(liveProgress({ id: 'nearMiss', tier: 1, progress: 4 }, stats({ nearMisses: 3 }))).toBe(7);
    expect(liveProgress({ id: 'chompEat', tier: 1, progress: 100 }, stats({ chompEats: 60 }))).toBe(100);
    expect(liveProgress({ id: 'chompEat', tier: 1, progress: 100 }, stats({ chompEats: 180 }))).toBe(180);
  });
  it('isComplete uses the tier target', () => {
    expect(isComplete({ id: 'nearMiss', tier: 1, progress: 9 }, stats({ nearMisses: 1 }))).toBe(true);
    expect(isComplete({ id: 'nearMiss', tier: 1, progress: 8 }, stats({ nearMisses: 1 }))).toBe(false);
  });
  it('newlyCompleted skips ids already toasted', () => {
    const st = state([{ id: 'chompRun', tier: 1, progress: 0 }, { id: 'chompEat', tier: 1, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }]);
    const s = stats({ grazeChomps: 2, chompEats: 200 });
    expect(newlyCompleted(st, s, new Set()).map((m) => m.id)).toEqual(['chompRun', 'chompEat']);
    expect(newlyCompleted(st, s, new Set(['chompRun'])).map((m) => m.id)).toEqual(['chompEat']);
  });
});

describe('applyRun', () => {
  const active: Mission[] = [
    { id: 'nearMiss', tier: 1, progress: 4 },
    { id: 'chompRun', tier: 1, progress: 0 },
    { id: 'survive', tier: 2, progress: 0 },
  ];
  it('completes, awards stars + coins, replaces completed missions, stores progress for the rest', () => {
    const r = applyRun(state(active), stats({ nearMisses: 6, grazeChomps: 2, seconds: 30 }), seq(0.5));
    expect(r.completed.map((m) => m.id)).toEqual(['nearMiss', 'chompRun']);
    expect(r.starsGained).toBe(2);
    expect(r.coinsGained).toBe(40);
    expect(r.state.stars).toBe(2);
    expect(r.state.completedCount).toBe(2);
    expect(r.replacements).toHaveLength(2);
    expect(r.state.active).toHaveLength(3);
    expect(r.state.active[2]).toEqual({ id: 'survive', tier: 2, progress: 30 });
    const ids = r.state.active.map((m) => m.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain('nearMiss');
    expect(ids).not.toContain('chompRun');
    expect(r.state.active.slice(0, 2).every((m) => m.progress === 0)).toBe(true);
    expect(r.rankBefore).toBe(1);
    expect(r.rankAfter).toBe(1);
  });
  it('replacement tier is rank-weighted by the new rank', () => {
    const st = state([{ id: 'survive', tier: 2, progress: 0 }, { id: 'chompRun', tier: 3, progress: 0 }, { id: 'runs', tier: 3, progress: 0 }], 4);
    const r = applyRun(st, stats({ seconds: 50 }), seq(0.99));
    expect(r.rankAfter).toBe(2);
    expect(r.replacements[0]!.tier).toBe(2);
  });
  it('reward is 20 x tier coins', () => {
    expect([1, 2, 3].map((t) => missionReward({ id: 'chompRun', tier: t as 1 | 2 | 3, progress: 0 }))).toEqual([20, 40, 60]);
    const r = applyRun(state([{ id: 'survive', tier: 2, progress: 0 }, { id: 'chompRun', tier: 3, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }]), stats({ seconds: 50 }), seq(0.5));
    expect(r.coinsGained).toBe(40);
  });
  it('rank-up when stars cross a multiple of 5', () => {
    const st = state([{ id: 'survive', tier: 2, progress: 0 }, { id: 'chompRun', tier: 1, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }], 4);
    const r = applyRun(st, stats({ seconds: 50 }), seq(0.5));
    expect(r.starsGained).toBe(2);
    expect(r.rankBefore).toBe(1);
    expect(r.rankAfter).toBe(2);
    expect(r.state.rank).toBe(2);
  });
  it('runs mission counts the run', () => {
    const st = state([{ id: 'runs', tier: 1, progress: 2 }, { id: 'chompRun', tier: 3, progress: 0 }, { id: 'rush', tier: 3, progress: 0 }]);
    expect(applyRun(st, stats({ runs: 1 }), seq(0.5)).completed.map((m) => m.id)).toEqual(['runs']);
  });
  it('is pure: input state is not mutated', () => {
    const st = state(active.map((m) => ({ ...m })));
    applyRun(st, stats({ nearMisses: 99 }), seq(0.5));
    expect(st.active[0]!.progress).toBe(4);
    expect(st.stars).toBe(0);
  });
});

describe('swap', () => {
  const st = state([{ id: 'nearMiss', tier: 2, progress: 3 }, { id: 'chompRun', tier: 1, progress: 0 }, { id: 'chompEat', tier: 3, progress: 0 }], 7);
  it('always costs a flat 5', () => {
    expect(SWAP_COST).toBe(5);
    expect(swapCost()).toBe(5);
  });
  it('rejects when poor or index invalid', () => {
    expect(swapMission(st, 0, 4, seq(0.5))).toEqual({ ok: false, reason: 'poor' });
    expect(swapMission(st, 5, 999, seq(0.5))).toEqual({ ok: false, reason: 'index' });
  });
  it('the first swap is not free: 0 coins cannot swap', () => {
    expect(swapMission(st, 0, 0, seq(0))).toEqual({ ok: false, reason: 'poor' });
  });
  it('swap spends 5, keeps tier, progress 0 and excludes active ids', () => {
    const r = swapMission(st, 0, 100, seq(0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.coins).toBe(95);
    expect(r.state.active[0]!.tier).toBe(2);
    expect(r.state.active[0]!.progress).toBe(0);
    expect(['nearMiss', 'chompRun', 'chompEat']).not.toContain(r.state.active[0]!.id);
    expect(r.state.stars).toBe(7);
    expect(r.state.rank).toBe(2);
  });
});

describe('rankProgress', () => {
  it('shows stars toward next rank', () => {
    expect(rankProgress(12)).toEqual({ have: 2, need: 5 });
  });
});

describe('sanitizeMissions', () => {
  it('garbage -> initial state', () => {
    const s = sanitizeMissions('x', seq(0.1, 0.5, 0.9));
    expect(s.active).toHaveLength(3);
    expect(s.active.every((m) => m.tier === 1)).toBe(true);
  });
  it('drops invalid / duplicate entries, clamps, refills to 3, derives rank from stars', () => {
    const raw = {
      active: [
        { id: 'chompRun', tier: 2, progress: -5 },
        { id: 'chompRun', tier: 1, progress: 1 },
        { id: 'nope', tier: 1, progress: 0 },
        { id: 'runs', tier: 9, progress: 2 },
      ],
      stars: 12.7, rank: 99, completedCount: -3,
    };
    const s = sanitizeMissions(raw, seq(0.1, 0.5, 0.9));
    expect(s.active).toHaveLength(3);
    expect(s.active[0]).toEqual({ id: 'chompRun', tier: 2, progress: 0 });
    expect(new Set(s.active.map((m) => m.id)).size).toBe(3);
    expect(s.stars).toBe(12);
    expect(s.rank).toBe(3);
    expect(s.completedCount).toBe(0);
  });
  it('drops pre-3.3 score / combo missions (no longer in the pool) and draws replacements', () => {
    const s = sanitizeMissions({
      active: [{ id: 'score', tier: 2, progress: 300 }, { id: 'combo', tier: 1, progress: 2 }, { id: 'runs', tier: 1, progress: 1 }],
      stars: 0, completedCount: 0,
    }, seq(0.1, 0.9, 0.5));
    expect(s.active).toHaveLength(3);
    expect(s.active.map((m) => m.id)).not.toContain('score');
    expect(s.active.map((m) => m.id)).not.toContain('combo');
    expect(s.active.find((m) => m.id === 'runs')).toEqual({ id: 'runs', tier: 1, progress: 1 });
  });
  it('accepts a saved 2.5.0 state (day/swapsUsed/done): ignores the daily fields, re-draws done missions, keeps the rest', () => {
    const s = sanitizeMissions({
      active: [{ id: 'chompRun', tier: 1, progress: 2, done: true }, { id: 'chompEat', tier: 2, progress: 50 }, { id: 'runs', tier: 1, progress: 1 }],
      stars: 12, completedCount: 4, day: '2020-01-01', swapsUsed: 3,
    }, seq(0.5));
    expect(Object.keys(s).sort()).toEqual(['active', 'completedCount', 'rank', 'stars']);
    expect(s.active).toHaveLength(3);
    expect(s.active.map((m) => m.id)).not.toContain('chompRun');
    expect(s.active[0]).toEqual({ id: 'chompEat', tier: 2, progress: 50 });
    expect(s.active[1]).toEqual({ id: 'runs', tier: 1, progress: 1 });
    expect(s.active.every((m) => !('done' in m))).toBe(true);
    expect([s.stars, s.rank, s.completedCount]).toEqual([12, 3, 4]);
  });
});
