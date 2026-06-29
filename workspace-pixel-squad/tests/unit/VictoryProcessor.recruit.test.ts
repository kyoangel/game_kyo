import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { Character, GameState, Stage } from '../../src/types';
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

function makeRecruitedEnemy(overrides: Partial<Character> = {}): Character {
  return {
    id: 'mutant_99', templateId: 'mutant', name: '變種人', isProtagonist: false, isPlayer: false,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 10, maxHp: 60, atk: 15, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false, activeBuffs: [],
    skillCooldowns: {},
    ...overrides,
  };
}

describe('processVictory recruit — non-named enemy without a PLAYER_TEMPLATES match', () => {
  it('adds a player character to pool derived from the enemy itself', () => {
    const state = makeGameState();
    const stage = makeStage();
    const recruitedEnemy = makeRecruitedEnemy();

    const result = processVictory(state, stage, 0, recruitedEnemy);

    const recruit = result.pool.find(c => c.templateId === 'mutant');
    expect(recruit).toBeDefined();
    expect(recruit!.isPlayer).toBe(true);
    expect(recruit!.name).toBe('變種人');
    expect(recruit!.stats.maxHp).toBeGreaterThan(0);
    expect(recruit!.stats.atk).toBeGreaterThan(0);
    expect(recruit!.stats.def).toBeGreaterThan(0);
    expect(recruit!.stats.spd).toBeGreaterThan(0);
  });

  it('also adds the recruit to squad when squad has space', () => {
    const state = makeGameState();
    const stage = makeStage();
    const recruitedEnemy = makeRecruitedEnemy();

    const result = processVictory(state, stage, 0, recruitedEnemy);

    const recruit = result.pool.find(c => c.templateId === 'mutant');
    expect(result.squad.some(s => s.id === recruit!.id)).toBe(true);
  });

  it('adds the recruit to pool but not squad when squad is already full (5 members)', () => {
    const state = makeGameState();
    const filler = (n: number): Character => ({
      id: `filler_${n}`, templateId: `filler_${n}`, name: `Filler${n}`,
      isProtagonist: false, isPlayer: true, level: 1, exp: 0, expToNext: 50,
      stats: { hp: 50, maxHp: 50, atk: 10, def: 10, spd: 10 },
      skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
      activeBuffs: [], skillCooldowns: {},
    });
    state.squad = [filler(1), filler(2), filler(3), filler(4), filler(5)];
    state.pool = [...state.squad];

    const stage = makeStage();
    const recruitedEnemy = makeRecruitedEnemy();

    const result = processVictory(state, stage, 0, recruitedEnemy);

    const recruit = result.pool.find(c => c.templateId === 'mutant');
    expect(recruit).toBeDefined();
    expect(result.squad.length).toBe(5);
    expect(result.squad.some(s => s.templateId === 'mutant')).toBe(false);
  });
});

describe('processVictory recruit — named enemy with a PLAYER_TEMPLATES match', () => {
  it('still uses the player template (createCharacter) rather than enemy-derived stats', () => {
    const state = makeGameState();
    const stage = makeStage();
    const recruitedEnemy = makeRecruitedEnemy({
      id: 'vega_99', templateId: 'vega', name: 'Vega', level: 3,
      stats: { hp: 5, maxHp: 80, atk: 999, def: 999, spd: 999 },
    });

    const result = processVictory(state, stage, 0, recruitedEnemy);

    const recruit = result.pool.find(c => c.templateId === 'vega');
    expect(recruit).toBeDefined();
    // Template-derived stats must not equal the enemy's battle-worn stats.
    expect(recruit!.stats.atk).not.toBe(999);
    expect(recruit!.stats.def).not.toBe(999);
    expect(recruit!.stats.spd).not.toBe(999);
    expect(recruit!.level).toBe(3);
  });
});
