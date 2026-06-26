import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Character, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

function makeGameState(): GameState {
  return newGame(0);
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 40, currencyReward: 20,
    ...overrides,
  };
}

function makeEnemy(templateId: string, name: string): Character {
  return {
    id: 'e1', templateId, name, isProtagonist: false, isPlayer: false,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 0, maxHp: 100, atk: 10, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '坦克', alive: false, defending: false, activeBuffs: [],
    recruited: true,
  };
}

describe('processVictory', () => {
  it('adds stageId to completedStageIds if not already present', () => {
    const state = makeGameState();
    const stage = makeStage({ id: '1-1', currencyReward: 20 });
    const result = processVictory(state, stage, 40, undefined);
    expect(result.stageProgress.completedStageIds).toContain('1-1');
  });

  it('does not duplicate stageId on replay', () => {
    const state = makeGameState();
    state.stageProgress.completedStageIds = ['1-1'];
    const stage = makeStage({ id: '1-1', currencyReward: 20 });
    const result = processVictory(state, stage, 40, undefined);
    expect(result.stageProgress.completedStageIds.filter(id => id === '1-1')).toHaveLength(1);
  });

  it('adds currency reward', () => {
    const state = makeGameState();
    state.currency = 100;
    const stage = makeStage({ currencyReward: 50 });
    const result = processVictory(state, stage, 40, undefined);
    expect(result.currency).toBe(150);
  });

  it('adds expGained to expPool', () => {
    const state = makeGameState();
    state.expPool = 100;
    const stage = makeStage();
    const result = processVictory(state, stage, 40, undefined);
    expect(result.expPool).toBe(140);
  });

  it('adds unlock character to pool on first clear', () => {
    const state = makeGameState();
    const stage = makeStage({ unlockCharacterId: 'rex' });
    const result = processVictory(state, stage, 0, undefined);
    const hasRex = result.pool.some(c => c.templateId === 'rex');
    expect(hasRex).toBe(true);
  });

  it('does not add unlock character if already in pool', () => {
    const state = makeGameState();
    state.stageProgress.completedStageIds = ['1-2'];
    state.pool.push({ id: 'rex_1', templateId: 'rex' } as Character);
    const stage = makeStage({ id: '1-2', unlockCharacterId: 'rex' });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.pool.filter(c => c.templateId === 'rex')).toHaveLength(1);
  });

  it('non-boss story character auto-joins squad on first clear if space', () => {
    const state = makeGameState();
    const stage = makeStage({ unlockCharacterId: 'rex', isBoss: false });
    const result = processVictory(state, stage, 0, undefined);
    const inSquad = result.squad.some(c => c.templateId === 'rex');
    expect(inSquad).toBe(true);
  });

  it('boss unlock character goes to pool only, not squad', () => {
    const state = makeGameState();
    const stage = makeStage({ unlockCharacterId: 'vega', isBoss: true });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.pool.some(c => c.templateId === 'vega')).toBe(true);
    expect(result.squad.some(c => c.templateId === 'vega')).toBe(false);
  });

  it('non-boss story character does not join squad if squad is full', () => {
    const state = makeGameState();
    // Fill squad to 5 using mock chars
    for (let i = 0; i < 4; i++) {
      state.squad.push({ id: `filler_${i}`, templateId: 'filler' } as Character);
    }
    expect(state.squad.length).toBe(5);
    const stage = makeStage({ unlockCharacterId: 'rex', isBoss: false });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.pool.some(c => c.templateId === 'rex')).toBe(true);
    expect(result.squad.some(c => c.templateId === 'rex')).toBe(false);
  });

  it('adds recruited enemy to pool', () => {
    const state = makeGameState();
    const stage = makeStage();
    const enemy = makeEnemy('vega', 'Vega');
    const result = processVictory(state, stage, 0, enemy);
    const hasVega = result.pool.some(c => c.templateId === 'vega');
    expect(hasVega).toBe(true);
  });

  it('adds recruited enemy to squad when squad has space', () => {
    const state = makeGameState();
    const stage = makeStage();
    const enemy = makeEnemy('vega', 'Vega');
    expect(state.squad.length).toBeLessThan(5);
    const result = processVictory(state, stage, 0, enemy);
    const inSquad = result.squad.some(c => c.templateId === 'vega');
    expect(inSquad).toBe(true);
  });

  it('adds recruited boss to squad even when unlock block already added them to pool', () => {
    // Boss stage: unlockCharacterId === recruited enemy's templateId
    // The unlock block runs first (adds to pool), then recruit block must still add to squad
    const state = makeGameState();
    const stage = makeStage({ unlockCharacterId: 'vega' });
    const enemy = makeEnemy('vega', 'Vega');
    const result = processVictory(state, stage, 0, enemy);
    expect(result.pool.filter(c => c.templateId === 'vega')).toHaveLength(1);
    const inSquad = result.squad.some(c => c.templateId === 'vega');
    expect(inSquad).toBe(true);
  });

  it('clears inChapterRun when last stage of chapter (stageIndex 4)', () => {
    const state = makeGameState();
    state.stageProgress.inChapterRun = {
      chapterId: 'ch1', currentStageIndex: 4, lockedSquad: [],
    };
    const stage = makeStage({ id: '1-5', stageIndex: 4, chapterId: 'ch1', isBoss: true });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.stageProgress.inChapterRun).toBeUndefined();
  });

  it('advances inChapterRun.currentStageIndex when not last stage', () => {
    const state = makeGameState();
    state.stageProgress.inChapterRun = {
      chapterId: 'ch1', currentStageIndex: 1, lockedSquad: [],
    };
    const stage = makeStage({ id: '1-2', stageIndex: 1, chapterId: 'ch1' });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.stageProgress.inChapterRun?.currentStageIndex).toBe(2);
  });
});
