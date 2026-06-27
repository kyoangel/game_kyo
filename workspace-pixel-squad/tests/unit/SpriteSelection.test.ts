import { describe, it, expect } from 'vitest';
import { shouldUseProtagonistSprite } from '../../src/battle/SpriteSelection';
import type { Character } from '../../src/types';

function makeCharacter(overrides: Partial<Character>): Character {
  return {
    id: 'c1',
    templateId: 'protagonist',
    name: '倖存者',
    isProtagonist: false,
    isPlayer: false,
    level: 1,
    exp: 0,
    expToNext: 100,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 10, spd: 10 },
    skills: [],
    statPoints: 0,
    archetype: '全能',
    alive: true,
    defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

describe('shouldUseProtagonistSprite', () => {
  it('returns true for the protagonist player character when the texture is loaded', () => {
    const protagonist = makeCharacter({ isProtagonist: true, isPlayer: true });
    expect(shouldUseProtagonistSprite(protagonist, true)).toBe(true);
  });

  it('returns false when the texture failed to load, even for the protagonist', () => {
    const protagonist = makeCharacter({ isProtagonist: true, isPlayer: true });
    expect(shouldUseProtagonistSprite(protagonist, false)).toBe(false);
  });

  it('returns false for a non-protagonist ally (e.g. Rex) regardless of texture state', () => {
    const rex = makeCharacter({ templateId: 'rex', name: 'Rex', isProtagonist: false, isPlayer: true });
    expect(shouldUseProtagonistSprite(rex, true)).toBe(false);
  });

  it('returns false for an enemy even if isProtagonist were somehow true', () => {
    const enemy = makeCharacter({ isProtagonist: true, isPlayer: false });
    expect(shouldUseProtagonistSprite(enemy, true)).toBe(false);
  });

  it('returns false for a recruited former enemy who is not the protagonist', () => {
    const recruited = makeCharacter({ isProtagonist: false, isPlayer: true, recruited: true });
    expect(shouldUseProtagonistSprite(recruited, true)).toBe(false);
  });
});
