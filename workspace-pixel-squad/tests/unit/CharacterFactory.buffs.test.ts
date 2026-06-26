import { describe, it, expect } from 'vitest';
import { createCharacter, createEnemy } from '../../src/battle/CharacterFactory';
import type { CharacterTemplate, EnemyTemplate } from '../../src/types';

const template: CharacterTemplate = {
  id: 'test_char', name: 'Test', isProtagonist: false,
  baseStats: { hp: 100, atk: 20, def: 10, spd: 10 },
  skillIds: [],
  statGrowth: { hp: 5, atk: 1, def: 1, spd: 1 },
  unlockMethod: 'start',
};

const enemyTemplate: EnemyTemplate = {
  id: 'test_enemy', name: 'Enemy', baseStats: { hp: 80, atk: 15, def: 8, spd: 9 }, skillIds: [],
};

describe('CharacterFactory — activeBuffs initialization', () => {
  it('createCharacter initializes activeBuffs as an empty array', () => {
    const c = createCharacter(template, 1);
    expect(c.activeBuffs).toEqual([]);
  });

  it('createEnemy initializes activeBuffs as an empty array', () => {
    const e = createEnemy(enemyTemplate);
    expect(e.activeBuffs).toEqual([]);
  });
});
