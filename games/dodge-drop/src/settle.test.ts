import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSIST } from './progression.ts';
import { emptyStats, type MissionState } from './missions.ts';
import { emptyWorkshop, type Workshop } from './workshop.ts';
import type { RunState } from './runState.ts';
import { nearGoal, settleRun, type Saved } from './settle.ts';

const rng = () => 0.5;
const maxed = (): Workshop => ({ shield: 5, shieldStack: 5, startShield: 5, magnet: 5, nearMiss: 5, combo: 5, luck: 5 });
const ms = (o: Partial<MissionState> = {}): MissionState => ({
  active: [
    { id: 'runs', tier: 1, progress: 0 },
    { id: 'score', tier: 1, progress: 0 },
    { id: 'starsRun', tier: 1, progress: 0 },
  ],
  stars: 0, rank: 1, completedCount: 0, ...o,
});
const saved = (o: Partial<Saved> = {}): Saved => ({
  coins: 20, lossStreak: 0, assist: { ...DEFAULT_ASSIST }, startTier: 'none', medals: [],
  missions: ms(), workshop: emptyWorkshop(), ownedSkins: ['cyan'], ...o,
});
const run = (o: Partial<RunState> = {}, st: Partial<RunState['stats']> = {}): RunState => ({
  score: 0, seconds: 0, stars: 0, medals: [], headStart: 0, startTier: 'none',
  stats: { ...emptyStats(), runs: 1, ...st }, ...o,
});

describe('nearGoal', () => {
  it('fresh workshop -> shield level 1 at 15', () => {
    expect(nearGoal(emptyWorkshop(), ['cyan'])).toEqual({ kind: 'workshop', id: 'shield', level: 1, cost: 15 });
  });
  it('picks the cheapest row, ties by order', () => {
    const w = { ...emptyWorkshop(), shield: 2 };
    expect(nearGoal(w, ['cyan'])).toEqual({ kind: 'workshop', id: 'shieldStack', level: 1, cost: 15 });
    expect(nearGoal({ ...w, shieldStack: 1 }, ['cyan'])).toEqual({ kind: 'workshop', id: 'startShield', level: 1, cost: 15 });
  });
  it('all maxed -> cheapest locked skin', () => {
    expect(nearGoal(maxed(), ['cyan'])).toEqual({ kind: 'skin', id: 'lime', level: 0, cost: 30 });
  });
  it('everything owned -> null', () => {
    expect(nearGoal(maxed(), ['cyan', 'lime', 'orb', 'tri', 'diamond', 'hex', 'star', 'prism'])).toBeNull();
  });
});

describe('settleRun', () => {
  it('first short run: floor loses to base', () => {
    const s = settleRun(run({ score: 100, seconds: 15, stars: 3 }), saved(), rng);
    expect(s.lossStreak).toBe(1);
    expect(s.coin.coins).toBe(7);
    expect(s.coin.floorApplied).toBe(false);
    expect(s.coinsAfter).toBe(27);
    expect(s.assist.active).toBe(false);
  });
  it('second zero-score run activates assist and applies floor', () => {
    const s = settleRun(run({ score: 0, seconds: 3 }), saved({
      lossStreak: 1, assist: { zeroStreak: 1, noBronzeStreak: 1, active: false, retired: false },
    }), rng);
    expect(s.assist.active).toBe(true);
    expect(s.lossStreak).toBe(2);
    expect(s.coin.coins).toBe(4);
    expect(s.coin.floorApplied).toBe(true);
  });
  it('bronze run resets streak, retires assist, advances tier', () => {
    const s = settleRun(run({ score: 200, seconds: 31, medals: ['bronze'] }), saved({ lossStreak: 3, medals: ['neon'] }), rng);
    expect(s.lossStreak).toBe(0);
    expect(s.assist.retired).toBe(true);
    expect(s.startTier).toBe('bronze');
    expect(s.medals).toEqual(expect.arrayContaining(['bronze', 'neon']));
  });
  it('tier-start run: coin base excludes head start, tier stays, assist ignored', () => {
    const s = settleRun(run({ score: 160, headStart: 147, seconds: 40, startTier: 'silver' }), saved({
      startTier: 'silver', medals: ['bronze', 'silver'],
    }), rng);
    expect(s.coin.base).toBe(0);
    expect(s.startTier).toBe('silver');
    expect(s.assist.retired).toBe(true);
    expect(s.assist.active).toBe(false);
  });
  it('mission completion flows through; multiplier uses pre-run rank', () => {
    const st = ms({ stars: 4, rank: 1, active: [
      { id: 'starsRun', tier: 2, progress: 0 },
      { id: 'score', tier: 3, progress: 0 },
      { id: 'runs', tier: 3, progress: 0 },
    ] });
    const s = settleRun(run({ score: 100, seconds: 40, stars: 6 }, { stars: 6, score: 100 }), saved({ missions: st }), rng);
    expect(s.missions.completed.map((m) => m.id)).toEqual(['starsRun']);
    expect(s.missions.rankAfter).toBe(2);
    expect(s.coin.multiplier).toBe(1);
    expect(s.missionCoins).toBe(40);
    expect(s.coinsAfter).toBe(20 + s.coin.coins + 40);
  });
  it('goal bar balances', () => {
    const s = settleRun(run({ score: 100, seconds: 15, stars: 3 }), saved({ coins: 10 }), rng);
    expect(s.goalFrom).toBe(10);
    expect(s.goalTo).toBe(17);
    expect(s.goal).toEqual({ kind: 'workshop', id: 'shield', level: 1, cost: 15 });
  });
});
