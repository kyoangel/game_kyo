import { describe, it, expect } from 'vitest';
import { createCharacter, createEnemy, enemyToPlayerCharacter } from '../../src/battle/CharacterFactory';
import type { Character, CharacterTemplate, EnemyTemplate } from '../../src/types';

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

describe('CharacterFactory — equipment initialization', () => {
  it('createCharacter defaults equipment to {}', () => {
    const c = createCharacter(template, 1);
    expect(c.equipment).toEqual({});
  });

  it('createEnemy defaults equipment to {}', () => {
    const e = createEnemy(enemyTemplate);
    expect(e.equipment).toEqual({});
  });

  it('enemyToPlayerCharacter defaults equipment to {} even if the source enemy somehow had gear', () => {
    const enemy = createEnemy(enemyTemplate);
    (enemy as Character).equipment = {
      weapon: { id: 'weapon_pipe', slot: 'weapon', name: 'x', price: 1, description: '', statBonus: {} },
    };
    const player = enemyToPlayerCharacter(enemy, 80);
    expect(player.equipment).toEqual({});
  });
});
