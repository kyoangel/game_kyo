import { SKINS } from './economy.ts';
import { mergeMedals } from './medals.ts';
import { applyRun, rankMultiplier, type ApplyResult, type MissionState } from './missions.ts';
import {
  advanceStartTier, nextLossStreak, runCoins, updateAssist,
  type AssistState, type CoinResult, type StartTier,
} from './progression.ts';
import type { RunState } from './runState.ts';
import { nextCost, UPGRADE_IDS, type Workshop } from './workshop.ts';

export interface Saved {
  coins: number; lossStreak: number; assist: AssistState; startTier: StartTier;
  /** Medals saved before merging this run. */
  medals: string[];
  missions: MissionState; workshop: Workshop; ownedSkins: string[];
}

export interface Goal { kind: 'workshop' | 'skin'; id: string; level: number; cost: number }

export function nearGoal(workshop: Workshop, ownedSkins: readonly string[]): Goal | null {
  const cheapest = (list: Goal[]): Goal | null =>
    list.reduce<Goal | null>((best, g) => (best === null || g.cost < best.cost ? g : best), null);
  const rows: Goal[] = [];
  for (const id of UPGRADE_IDS) {
    const cost = nextCost(workshop[id]);
    if (cost !== null) rows.push({ kind: 'workshop', id, level: workshop[id] + 1, cost });
  }
  if (rows.length > 0) return cheapest(rows);
  const skins: Goal[] = SKINS.filter((s) => !ownedSkins.includes(s.id)).map((s) => ({ kind: 'skin', id: s.id, level: 0, cost: s.cost }));
  return cheapest(skins);
}

export interface Settled {
  coin: CoinResult;
  /** Star coins from completed missions (20 x tier each). */
  missionCoins: number;
  coinsAfter: number;
  lossStreak: number; assist: AssistState; startTier: StartTier; medals: string[];
  missions: ApplyResult;
  goal: Goal | null;
  goalFrom: number; goalTo: number;
}

export function settleRun(run: RunState, saved: Saved, _rng?: () => number): Settled {
  const lossStreak = nextLossStreak(saved.lossStreak, run.seconds);
  const coin = runCoins({
    score: run.score, headStart: run.headStart, stars: run.stars, lossStreak,
    rankMultiplier: rankMultiplier(saved.missions.rank),
  });
  const medals: string[] = mergeMedals(saved.medals, run.medals);
  const assist = updateAssist(saved.assist, {
    score: run.score - run.headStart, seconds: run.seconds, bronzeOwned: medals.includes('bronze'),
  });
  const startTier = advanceStartTier(saved.startTier, run.medals);
  const missions = applyRun(saved.missions, run.stats);
  const missionCoins = missions.coinsGained;
  const coinsAfter = saved.coins + coin.coins + missionCoins;
  return {
    coin, missionCoins, coinsAfter, lossStreak, assist, startTier, medals, missions,
    goal: nearGoal(saved.workshop, saved.ownedSkins),
    goalFrom: saved.coins, goalTo: coinsAfter,
  };
}
