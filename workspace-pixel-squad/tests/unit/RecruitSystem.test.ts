import { describe, it, expect, vi } from 'vitest';
import {
  canAttemptRecruit,
  recruitChance,
  attemptRecruit,
  isNamedCharacter,
} from '../../src/battle/RecruitSystem';
import type { Character } from '../../src/types';

function makeEnemy(hp: number, maxHp: number): Character {
  return {
    id: 'e1', templateId: 'mutant', name: '變種人', isProtagonist: false, isPlayer: false,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp, atk: 10, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false,
  };
}

describe('canAttemptRecruit', () => {
  it('returns true when hp is below 50% of maxHp', () => {
    expect(canAttemptRecruit(makeEnemy(49, 100))).toBe(true);
  });

  it('returns false at exactly 50% hp', () => {
    expect(canAttemptRecruit(makeEnemy(50, 100))).toBe(false);
  });

  it('returns false when hp is above 50%', () => {
    expect(canAttemptRecruit(makeEnemy(80, 100))).toBe(false);
  });

  it('returns false when enemy is dead', () => {
    const enemy = makeEnemy(0, 100);
    enemy.alive = false;
    expect(canAttemptRecruit(enemy)).toBe(false);
  });
});

describe('recruitChance', () => {
  it('returns 0 at exactly 50% hp (boundary)', () => {
    expect(recruitChance(makeEnemy(50, 100), false)).toBe(0);
  });

  it('returns ~80 at 10% hp for non-named', () => {
    expect(recruitChance(makeEnemy(10, 100), false)).toBe(80);
  });

  it('returns ~90 at 5% hp for non-named', () => {
    expect(recruitChance(makeEnemy(5, 100), false)).toBe(90);
  });

  it('halves the chance for named characters', () => {
    const base = recruitChance(makeEnemy(10, 100), false);
    const named = recruitChance(makeEnemy(10, 100), true);
    expect(named).toBe(Math.floor(base / 2));
  });

  it('returns 40 at 30% hp for non-named', () => {
    expect(recruitChance(makeEnemy(30, 100), false)).toBe(40);
  });
});

describe('attemptRecruit', () => {
  it('returns true when random is below chance/100', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(attemptRecruit(80)).toBe(true);
    vi.restoreAllMocks();
  });

  it('returns false when random is at or above chance/100', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    expect(attemptRecruit(80)).toBe(false);
    vi.restoreAllMocks();
  });

  it('always returns false at 0% chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(attemptRecruit(0)).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('isNamedCharacter', () => {
  it('returns true for vega', () => { expect(isNamedCharacter('vega')).toBe(true); });
  it('returns true for crow', () => { expect(isNamedCharacter('crow')).toBe(true); });
  it('returns true for zora', () => { expect(isNamedCharacter('zora')).toBe(true); });
  it('returns true for dex', () => { expect(isNamedCharacter('dex')).toBe(true); });
  it('returns true for aaaa', () => { expect(isNamedCharacter('aaaa')).toBe(true); });
  it('returns false for regular enemy', () => { expect(isNamedCharacter('mutant')).toBe(false); });
});
