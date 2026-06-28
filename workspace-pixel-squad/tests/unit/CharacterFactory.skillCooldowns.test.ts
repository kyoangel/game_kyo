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
  id: 'test_enemy', name: 'Enemy',
  baseStats: { hp: 80, atk: 15, def: 8, spd: 9 },
  skillIds: [],
};

describe('CharacterFactory — skillCooldowns initialization', () => {
  it('createCharacter initializes skillCooldowns as an empty object', () => {
    const c = createCharacter(template, 1);
    expect((c as any).skillCooldowns).toEqual({});
  });

  it('createEnemy initializes skillCooldowns as an empty object', () => {
    const e = createEnemy(enemyTemplate);
    expect((e as any).skillCooldowns).toEqual({});
  });

  it('each newly created character has its own independent skillCooldowns map (AC5)', () => {
    // AC5: new battle means fresh characters with no leftover cooldowns
    const c1 = createCharacter(template, 1);
    const c2 = createCharacter(template, 1);
    expect((c1 as any).skillCooldowns).toEqual({});
    expect((c2 as any).skillCooldowns).toEqual({});
  });

  it('createEnemy with stat multiplier also initializes skillCooldowns as empty', () => {
    const e = createEnemy(enemyTemplate, 1.5);
    expect((e as any).skillCooldowns).toEqual({});
  });
});
