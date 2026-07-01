import { describe, it, expect } from 'vitest';
import { createCharacter, createEnemy, enemyToPlayerCharacter } from '../../src/battle/CharacterFactory';
import type { Character, CharacterTemplate, EnemyTemplate } from '../../src/types';

// Spec: specs/pixel-squad-skill-tree.md — "Code changes / battle/CharacterFactory.ts"

type CharacterWithSkillTree = Character & {
  skillPoints?: number;
  unlockedSkillNodeIds?: string[];
};

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

describe('CharacterFactory — skill tree field initialization', () => {
  it('createCharacter initializes skillPoints to 0', () => {
    const c = createCharacter(template, 1) as CharacterWithSkillTree;
    expect(c.skillPoints).toBe(0);
  });

  it('createCharacter initializes unlockedSkillNodeIds to an empty array', () => {
    const c = createCharacter(template, 1) as CharacterWithSkillTree;
    expect(c.unlockedSkillNodeIds).toEqual([]);
  });

  it('enemyToPlayerCharacter initializes skillPoints to 0', () => {
    const enemy = createEnemy(enemyTemplate);
    const player = enemyToPlayerCharacter(enemy, 80) as CharacterWithSkillTree;
    expect(player.skillPoints).toBe(0);
  });

  it('enemyToPlayerCharacter initializes unlockedSkillNodeIds to an empty array', () => {
    const enemy = createEnemy(enemyTemplate);
    const player = enemyToPlayerCharacter(enemy, 80) as CharacterWithSkillTree;
    expect(player.unlockedSkillNodeIds).toEqual([]);
  });
});
