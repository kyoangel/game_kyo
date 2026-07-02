import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import { bondKey } from '../../src/battle/BondSystem';
import type { Character, GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: pixel-squad-bond-system
// processVictory must accept an 8th `playerParty: Character[] = []` parameter
// (after alliesSurvived, without disturbing the existing 7 parameters) and,
// near the existing bestStarRatings/perfectClearStageIds block, apply
// BondSystem.applyBondGains(gameState.bondLevels, playerParty) into
// state.bondLevels.
// AC-11, AC-12.

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '2-5', chapterId: 'ch2', name: '[BOSS] 影鴉 Crow', stageIndex: 4,
    isBoss: true, isSideQuest: false,
    enemies: [], expReward: 180, currencyReward: 120,
    ...overrides,
  };
}

function makeChar(overrides: Record<string, unknown> = {}): Character {
  return Object.assign(
    {
      id: 'c1', templateId: 'c1', name: 'Char', isProtagonist: false, isPlayer: true,
      level: 1, exp: 0, expToNext: 50,
      stats: { hp: 100, maxHp: 100, atk: 20, def: 5, spd: 10 },
      skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
      activeBuffs: [], activeStatusEffects: [], skillCooldowns: {}, equipment: {},
    },
    overrides,
  ) as Character;
}

describe('AC-11: processVictory applies bond gains for a fully-alive playerParty', () => {
  it('increments all 3 pair keys by 4 over whatever bondLevels held before', () => {
    const a = makeChar({ id: 'a', templateId: 'rex', alive: true });
    const b = makeChar({ id: 'b', templateId: 'nyx', alive: true });
    const c = makeChar({ id: 'c', templateId: 'zed', alive: true });

    const state = makeGameState({ bondLevels: { [bondKey('rex', 'nyx')]: 6 } } as any);
    const stage = makeStage();

    const result = processVictory(state, stage, 100, undefined, 0, 1, true, [a, b, c]) as any;

    expect(result.bondLevels[bondKey('rex', 'nyx')]).toBe(10);
    expect(result.bondLevels[bondKey('rex', 'zed')]).toBe(4);
    expect(result.bondLevels[bondKey('nyx', 'zed')]).toBe(4);
  });
});

describe('AC-12: legacy call site with no 8th argument does not throw and adds no bond pairs', () => {
  it('leaves bondLevels equal to the input when playerParty defaults to []', () => {
    const state = makeGameState({ bondLevels: { [bondKey('rex', 'nyx')]: 8 } } as any);
    const stage = makeStage();

    expect(() => processVictory(state, stage, 100, undefined, 0, 1, true)).not.toThrow();

    const result = processVictory(state, stage, 100, undefined, 0, 1, true) as any;
    expect(result.bondLevels).toEqual({ [bondKey('rex', 'nyx')]: 8 });
  });

  it('does not throw when gameState.bondLevels is entirely absent (legacy save)', () => {
    const legacyState = makeGameState();
    delete (legacyState as any).bondLevels;
    const stage = makeStage();

    expect(() => processVictory(legacyState, stage, 100, undefined, 0, 1, true)).not.toThrow();
  });
});
