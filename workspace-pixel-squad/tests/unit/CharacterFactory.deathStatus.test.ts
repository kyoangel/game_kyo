import { describe, it, expect } from 'vitest';
import { createCharacter, createEnemy } from '../../src/battle/CharacterFactory';
import { PLAYER_TEMPLATES } from '../../src/data/characters';
import type { EnemyTemplate } from '../../src/types';

// Spec: specs/pixel-squad-permanent-death-mode.md
// Character.deathStatus does not exist yet in the type, and CharacterFactory
// never sets it — these assertions fail today (property is undefined).
// Covers "Data Model Change: Character Interface Update".

describe("Data Model: newly created characters start with deathStatus 'alive'", () => {
  it('createCharacter sets deathStatus to alive', () => {
    const template = PLAYER_TEMPLATES[0];
    const char = createCharacter(template, 1);
    expect((char as any).deathStatus).toBe('alive');
  });

  it('createEnemy sets deathStatus to alive', () => {
    const template: EnemyTemplate = {
      id: 'e1', name: 'Grunt',
      baseStats: { hp: 50, atk: 10, def: 5, spd: 8 },
      skillIds: [],
    };
    const enemy = createEnemy(template);
    expect((enemy as any).deathStatus).toBe('alive');
  });
});
