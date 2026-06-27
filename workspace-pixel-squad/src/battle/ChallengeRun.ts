import type { Character, ChallengeRunState, Stage } from '../types';
import { EXCLUSIVE_ITEMS } from '../data/exclusiveItems';

export const BOSS_RUSH_STAGE_IDS = ['1-5', '2-5', '3-5', '4-5', '5-5'];

export function startChallengeRun(squad: Character[]): ChallengeRunState {
  return {
    bossStageIds: [...BOSS_RUSH_STAGE_IDS],
    lockedSquad: squad.map(c => ({
      ...c,
      stats: { ...c.stats },
      activeBuffs: [...c.activeBuffs],
      skills: [...c.skills],
    })),
    accumulatedCurrency: 0,
  };
}

export function advanceChallengeRun(
  run: ChallengeRunState,
  clearedStage: Stage,
  survivors: Character[],
): ChallengeRunState {
  return {
    bossStageIds: run.bossStageIds.filter(id => id !== clearedStage.id),
    lockedSquad: survivors.map(c => ({
      ...c,
      stats: { ...c.stats },
      activeBuffs: [...c.activeBuffs],
      skills: [...c.skills],
      defending: false,
    })),
    accumulatedCurrency: run.accumulatedCurrency + clearedStage.currencyReward,
  };
}

export function isChallengeRunComplete(run: ChallengeRunState): boolean {
  return run.bossStageIds.length === 0;
}

export function isSquadDefeated(squad: Character[]): boolean {
  return squad.every(c => !c.alive);
}

export function settleChallengeRunRewards(
  accumulatedCurrency: number,
  ownedItemIds: string[],
  randomIndex: (count: number) => number,
): { currency: number; itemId?: string } {
  const currency = Math.round(accumulatedCurrency * 1.5);
  const unowned = EXCLUSIVE_ITEMS.filter(item => !ownedItemIds.includes(item.id));
  if (unowned.length === 0) {
    return { currency };
  }
  const itemId = unowned[randomIndex(unowned.length)].id;
  return { currency, itemId };
}
