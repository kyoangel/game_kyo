import { describe, it, expect } from 'vitest';
import {
  BOSS_STAGE_ORDER,
  createChallengeRun,
  advanceChallengeRun,
  isChallengeRunComplete,
  settleChallengeRun,
} from '../../src/battle/ChallengeRunSystem';
import { createCharacter } from '../../src/battle/CharacterFactory';
import { PLAYER_TEMPLATES } from '../../src/data/characters';
import type { Character } from '../../src/types';

function makeSquad(): Character[] {
  const protagonist = PLAYER_TEMPLATES.find(t => t.isProtagonist)!;
  return [createCharacter(protagonist, 1)];
}

describe('BOSS_STAGE_ORDER', () => {
  it('lists the five boss stages in chapter order', () => {
    expect(BOSS_STAGE_ORDER).toEqual(['1-5', '2-5', '3-5', '4-5', '5-5']);
  });
});

describe('createChallengeRun', () => {
  it('initializes bossStageIds to the full boss order', () => {
    const run = createChallengeRun(makeSquad());
    expect(run.bossStageIds).toEqual(['1-5', '2-5', '3-5', '4-5', '5-5']);
  });

  it('snapshots the given squad into lockedSquad', () => {
    const squad = makeSquad();
    const run = createChallengeRun(squad);
    expect(run.lockedSquad).toEqual(squad);
  });

  it('snapshots the squad as a new array, not the same reference', () => {
    const squad = makeSquad();
    const run = createChallengeRun(squad);
    expect(run.lockedSquad).not.toBe(squad);
  });

  it('starts accumulatedCurrency at 0', () => {
    const run = createChallengeRun(makeSquad());
    expect(run.accumulatedCurrency).toBe(0);
  });
});

describe('advanceChallengeRun', () => {
  it('removes the cleared boss stage from the front of bossStageIds', () => {
    const run = createChallengeRun(makeSquad());
    const result = advanceChallengeRun(run, '1-5', 100);
    expect(result.bossStageIds).toEqual(['2-5', '3-5', '4-5', '5-5']);
  });

  it('accumulates the currencyReward from the cleared stage', () => {
    const run = createChallengeRun(makeSquad());
    const afterFirst = advanceChallengeRun(run, '1-5', 100);
    const afterSecond = advanceChallengeRun(afterFirst, '2-5', 150);
    expect(afterSecond.accumulatedCurrency).toBe(250);
  });

  it('does not mutate the original run object', () => {
    const run = createChallengeRun(makeSquad());
    advanceChallengeRun(run, '1-5', 100);
    expect(run.bossStageIds).toEqual(['1-5', '2-5', '3-5', '4-5', '5-5']);
    expect(run.accumulatedCurrency).toBe(0);
  });
});

describe('isChallengeRunComplete', () => {
  it('is false while boss stages remain', () => {
    const run = createChallengeRun(makeSquad());
    expect(isChallengeRunComplete(run)).toBe(false);
  });

  it('is true once all five bosses have been cleared', () => {
    let run = createChallengeRun(makeSquad());
    for (const stageId of BOSS_STAGE_ORDER) {
      run = advanceChallengeRun(run, stageId, 100);
    }
    expect(isChallengeRunComplete(run)).toBe(true);
  });
});

describe('settleChallengeRun', () => {
  it('awards 1.5x the accumulated currency across all five boss fights, rounded', () => {
    let run = createChallengeRun(makeSquad());
    const rewards = [210, 240, 260, 280, 300]; // matches currencyReward of 1-5..5-5
    BOSS_STAGE_ORDER.forEach((stageId, i) => {
      run = advanceChallengeRun(run, stageId, rewards[i]);
    });
    const total = rewards.reduce((a, b) => a + b, 0);
    const result = settleChallengeRun(run, []);
    expect(result.currency).toBe(Math.round(total * 1.5));
  });

  it('awards an exclusive item the player does not yet own', () => {
    let run = createChallengeRun(makeSquad());
    for (const stageId of BOSS_STAGE_ORDER) {
      run = advanceChallengeRun(run, stageId, 100);
    }
    const result = settleChallengeRun(run, []);
    expect(result.awardedItemId).toBeDefined();
  });

  it('only ever awards an item the player does not already own', () => {
    let run = createChallengeRun(makeSquad());
    for (const stageId of BOSS_STAGE_ORDER) {
      run = advanceChallengeRun(run, stageId, 100);
    }
    const result = settleChallengeRun(run, ['scroll_overdrive']);
    expect(result.awardedItemId).not.toBe('scroll_overdrive');
  });

  it('awards no item when the player already owns every exclusive item', () => {
    let run = createChallengeRun(makeSquad());
    for (const stageId of BOSS_STAGE_ORDER) {
      run = advanceChallengeRun(run, stageId, 100);
    }
    const result = settleChallengeRun(run, ['scroll_overdrive', 'supply_nano_kit']);
    expect(result.awardedItemId).toBeUndefined();
  });
});
