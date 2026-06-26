import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

function makeGameState(): GameState {
  return newGame(0);
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

describe('processVictory item rewards', () => {
  it('grants itemRewards to inventory on first clear', () => {
    const state = makeGameState();
    const stage = makeSideQuestStage();
    const result = processVictory(state, stage, 0, undefined);
    expect(result.inventory).toEqual([{ itemId: 'scroll_overdrive', quantity: 1 }]);
  });

  it('grants no additional items on a repeat clear', () => {
    const state = makeGameState();
    state.stageProgress.completedStageIds = ['SQ-1'];
    state.inventory = [];
    const stage = makeSideQuestStage();
    const result = processVictory(state, stage, 0, undefined);
    expect(result.inventory).toEqual([]);
  });

  it('still grants EXP and currency on a repeat clear even without item rewards', () => {
    const state = makeGameState();
    state.stageProgress.completedStageIds = ['SQ-1'];
    state.expPool = 0;
    state.currency = 0;
    const stage = makeSideQuestStage();
    const result = processVictory(state, stage, 30, undefined);
    expect(result.expPool).toBe(30);
    expect(result.currency).toBe(20);
  });

  it('grants quantity > 1 as repeated entries that merge into one quantity', () => {
    const state = makeGameState();
    const stage = makeSideQuestStage({
      id: 'SQ-2', itemRewards: [{ itemId: 'supply_nano_kit', quantity: 2 }],
    });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.inventory).toEqual([{ itemId: 'supply_nano_kit', quantity: 2 }]);
  });

  it('grants multiple distinct itemRewards in one clear', () => {
    const state = makeGameState();
    const stage = makeSideQuestStage({
      id: 'SQ-3',
      itemRewards: [
        { itemId: 'scroll_field_medic', quantity: 1 },
        { itemId: 'supply_nano_kit', quantity: 1 },
      ],
    });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.inventory).toEqual([
      { itemId: 'scroll_field_medic', quantity: 1 },
      { itemId: 'supply_nano_kit', quantity: 1 },
    ]);
  });

  it('merges an itemReward into an already-owned inventory entry instead of duplicating', () => {
    const state = makeGameState();
    state.inventory = [{ itemId: 'scroll_field_medic', quantity: 1 }];
    const stage = makeSideQuestStage({
      id: 'SQ-3',
      itemRewards: [{ itemId: 'scroll_field_medic', quantity: 1 }],
    });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.inventory).toEqual([{ itemId: 'scroll_field_medic', quantity: 2 }]);
  });

  it('does not mutate the original gameState.inventory array', () => {
    const state = makeGameState();
    state.inventory = [];
    const stage = makeSideQuestStage();
    processVictory(state, stage, 0, undefined);
    expect(state.inventory).toEqual([]);
  });

  it('leaves inventory unchanged on first clear of a stage with no itemRewards', () => {
    const state = makeGameState();
    state.inventory = [{ itemId: 'supply_medkit_s', quantity: 1 }];
    const stage: Stage = {
      id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
      isBoss: false, isSideQuest: false,
      enemies: [], expReward: 40, currencyReward: 20,
    };
    const result = processVictory(state, stage, 0, undefined);
    expect(result.inventory).toEqual([{ itemId: 'supply_medkit_s', quantity: 1 }]);
  });
});
