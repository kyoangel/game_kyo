import { describe, it, expect } from 'vitest';
import { createEnemy, enemyToPlayerCharacter } from '../../src/battle/CharacterFactory';
import type { EnemyTemplate } from '../../src/types';

// Spec: boss-phase-weakness — Character gains a typed `weakness` field.
// createEnemy must copy EnemyTemplate.weakness onto the live Character so
// that the field exists to be mutated later by the boss phase reveal.

describe('createEnemy copies weakness from template', () => {
  it('copies template.weakness onto the created Character', () => {
    const template: EnemyTemplate = {
      id: 'mutant_01',
      name: 'Mutant',
      baseStats: { hp: 50, atk: 10, def: 5, spd: 8 },
      skillIds: [],
      weakness: 'fire',
    };

    const enemy = createEnemy(template);
    expect((enemy as any).weakness).toBe('fire');
  });

  it('leaves weakness undefined when the template has none (boss templates today)', () => {
    const template: EnemyTemplate = {
      id: 'vega',
      name: 'Vega',
      baseStats: { hp: 200, atk: 35, def: 15, spd: 14 },
      skillIds: [],
    };

    const enemy = createEnemy(template);
    expect((enemy as any).weakness).toBeUndefined();
  });

  it('still copies weakness when statMultiplier (NG+) scaling is applied', () => {
    const template: EnemyTemplate = {
      id: 'wolf_a',
      name: 'Wolf',
      baseStats: { hp: 80, atk: 20, def: 8, spd: 12 },
      skillIds: [],
      weakness: 'thunder',
    };

    const enemy = createEnemy(template, 1.3);
    expect((enemy as any).weakness).toBe('thunder');
  });
});

describe('enemyToPlayerCharacter does not carry over weakness (recruit interaction)', () => {
  it('returned player Character has weakness undefined even when the enemy had one', () => {
    const template: EnemyTemplate = {
      id: 'vega',
      name: 'Vega',
      baseStats: { hp: 200, atk: 35, def: 15, spd: 14 },
      skillIds: [],
    };
    const enemy = createEnemy(template);
    // Simulate a boss berserk-phase weakness reveal having happened mid-battle.
    (enemy as any).weakness = 'ice';

    const player = enemyToPlayerCharacter(enemy, 200);
    expect((player as any).weakness).toBeUndefined();
  });
});
