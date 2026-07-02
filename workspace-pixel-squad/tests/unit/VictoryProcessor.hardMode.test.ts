import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { Character, GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: specs/pixel-squad-permanent-death-mode.md
// processVictory() does not yet strip permanently-lost characters out of
// pool/squad/currentRosterIds when a stage clears, and GameState has no
// currentRosterIds field yet — every test below fails today either because
// the field is missing/unchanged or because a permanentLoss survivor is
// still present after the call. Covers AC-4 ("returns to the main menu").

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1', templateId: 'rex', name: 'Rex', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 5, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {}, equipment: {},
    ...overrides,
  } as Character;
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 40, currencyReward: 20,
    ...overrides,
  };
}

describe('AC-4: clearing a stage and returning to the main menu reflects a reduced roster', () => {
  it('a permanently-lost squad member is removed from the resulting pool/squad/currentRosterIds', () => {
    const survivor = makeChar({ id: 'survivor' });
    const lost = makeChar({ id: 'lost', deathStatus: 'permanentLoss', alive: false } as any);
    const state = makeGameState({
      pool: [survivor, lost],
      squad: [survivor, lost],
      currentRosterIds: ['survivor', 'lost'],
    } as any);
    const stage = makeStage();

    const result = processVictory(state, stage, 40, undefined, 0, 1, false, [survivor, lost]) as any;

    expect(result.pool.map((c: Character) => c.id)).not.toContain('lost');
    expect(result.squad.map((c: Character) => c.id)).not.toContain('lost');
    expect(result.currentRosterIds).not.toContain('lost');
    expect(result.currentRosterIds).toContain('survivor');
  });

  it('a normal (non-permanent) survivor party leaves pool/squad/currentRosterIds unchanged in composition', () => {
    const a = makeChar({ id: 'a' });
    const b = makeChar({ id: 'b' });
    const state = makeGameState({
      pool: [a, b],
      squad: [a, b],
      currentRosterIds: ['a', 'b'],
    } as any);
    const stage = makeStage();

    const result = processVictory(state, stage, 40, undefined, 0, 1, true, [a, b]) as any;

    expect(result.currentRosterIds.sort()).toEqual(['a', 'b']);
    expect(result.pool.map((c: Character) => c.id).sort()).toEqual(['a', 'b']);
  });
});
