import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

function makeBossStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '5-5', chapterId: 'ch5', name: '[BOSS] AAAA', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'aaaa',
    enemies: [], expReward: 500, currencyReward: 300,
    ...overrides,
  };
}

function makeSideQuestStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'SQ-1', chapterId: 'sq', name: '廢土競技場', stageIndex: 0,
    isBoss: false, isSideQuest: true, unlockAfterStageId: '1-5',
    enemies: [], expReward: 40, currencyReward: 20,
    itemRewards: [{ itemId: 'scroll_overdrive', quantity: 1 }],
    ...overrides,
  };
}

describe('processVictory hasClearedGame flag', () => {
  it('sets hasClearedGame to true when clearing stage 5-5 for the first time', () => {
    const state = makeGameState();
    const result = processVictory(state, makeBossStage(), 500, undefined);
    expect(result.hasClearedGame).toBe(true);
  });

  it('does not set hasClearedGame when clearing a non-final stage', () => {
    const state = makeGameState();
    const stage = makeBossStage({ id: '1-5', unlockCharacterId: 'vega' });
    const result = processVictory(state, stage, 120, undefined);
    expect(result.hasClearedGame).toBe(false);
  });

  it('keeps hasClearedGame true on a repeat clear of 5-5 (e.g. during NG+)', () => {
    const state = makeGameState({ hasClearedGame: true, ngPlusCycle: 1 });
    const result = processVictory(state, makeBossStage(), 500, undefined, 1);
    expect(result.hasClearedGame).toBe(true);
  });
});

describe('processVictory NG+ reward scaling', () => {
  it('does not scale rewards when ngPlusCycle is 0 (first playthrough)', () => {
    const state = makeGameState();
    const stage = makeBossStage({ id: '1-1', expReward: 40, currencyReward: 20, unlockCharacterId: undefined });
    const result = processVictory(state, stage, 40, undefined, 0);
    expect(result.expPool).toBe(40);
    expect(result.currency).toBe(20);
  });

  it('scales expGained and currencyReward by 1.2x at ngPlusCycle 1, rounded', () => {
    const state = makeGameState({ ngPlusCycle: 1 });
    const stage = makeBossStage({ id: '1-1', expReward: 40, currencyReward: 20, unlockCharacterId: undefined });
    const result = processVictory(state, stage, 40, undefined, 1);
    expect(result.expPool).toBe(Math.round(40 * 1.2));
    expect(result.currency).toBe(Math.round(20 * 1.2));
  });

  it('scales rewards by 1.4x at ngPlusCycle 2, rounded', () => {
    const state = makeGameState({ ngPlusCycle: 2 });
    const stage = makeBossStage({ id: '1-1', expReward: 90, currencyReward: 45, unlockCharacterId: undefined });
    const result = processVictory(state, stage, 90, undefined, 2);
    expect(result.expPool).toBe(Math.round(90 * 1.4));
    expect(result.currency).toBe(Math.round(45 * 1.4));
  });

  it('does not mutate data/stages.ts source values — only the returned state is scaled', () => {
    const state = makeGameState({ ngPlusCycle: 1 });
    const stage = makeBossStage({ id: '1-1', expReward: 40, currencyReward: 20, unlockCharacterId: undefined });
    processVictory(state, stage, 40, undefined, 1);
    expect(stage.expReward).toBe(40);
    expect(stage.currencyReward).toBe(20);
  });
});

describe('processVictory side quest itemRewards re-granted during NG+', () => {
  it('grants itemRewards again for a stage already in completedStageIds, when ngPlusCycle has reset completedStageIds', () => {
    // Simulates: player cleared SQ-1 in playthrough 1, then started NG+ which cleared
    // completedStageIds — so this is the first NG+ clear of SQ-1, and itemRewards
    // are intentionally granted again (farm incentive, not a bug).
    const state = makeGameState({ ngPlusCycle: 1, stageProgress: { completedStageIds: [] } });
    const stage = makeSideQuestStage();
    const result = processVictory(state, stage, 0, undefined, 1);
    expect(result.inventory).toEqual([{ itemId: 'scroll_overdrive', quantity: 1 }]);
  });
});
