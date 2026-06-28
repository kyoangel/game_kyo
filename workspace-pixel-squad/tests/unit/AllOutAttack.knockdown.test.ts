import { describe, it, expect } from 'vitest';
import { canKnockDown, allEnemiesKnockedDown } from '../../src/battle/AllOutAttack';
import type { Character } from '../../src/types';

function makeEnemy(overrides: Record<string, unknown> = {}): Character {
  return Object.assign(
    {
      id: 'e1', templateId: 'e1', name: 'Enemy', isProtagonist: false, isPlayer: false,
      level: 1, exp: 0, expToNext: 50,
      stats: { hp: 80, maxHp: 80, atk: 10, def: 5, spd: 5 },
      skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
      activeBuffs: [], skillCooldowns: {}, knockedDown: false,
    },
    overrides,
  ) as Character;
}

// --- canKnockDown ---

describe('canKnockDown — boss immunity (AC: boss cannot be knocked down)', () => {
  it('returns true for an enemy with no _monsterType', () => {
    const enemy = makeEnemy();
    expect(canKnockDown(enemy)).toBe(true);
  });

  it('returns true for a non-boss monster type (demon)', () => {
    const enemy = makeEnemy({ _monsterType: 'demon' });
    expect(canKnockDown(enemy)).toBe(true);
  });

  it('returns true for a non-boss monster type (dragon)', () => {
    const enemy = makeEnemy({ _monsterType: 'dragon' });
    expect(canKnockDown(enemy)).toBe(true);
  });

  it('returns false for a boss (_monsterType === "boss")', () => {
    const boss = makeEnemy({ _monsterType: 'boss' });
    expect(canKnockDown(boss)).toBe(false);
  });

  it('does NOT mutate the character (read-only check)', () => {
    const boss = makeEnemy({ _monsterType: 'boss', knockedDown: false });
    canKnockDown(boss);
    expect((boss as any).knockedDown).toBe(false);
  });
});

// --- allEnemiesKnockedDown ---

describe('allEnemiesKnockedDown — trigger predicate', () => {
  it('returns true when the single alive enemy is knocked down', () => {
    const enemies = [makeEnemy({ id: 'e1', knockedDown: true })];
    expect(allEnemiesKnockedDown(enemies)).toBe(true);
  });

  it('returns false when the single alive enemy is NOT knocked down', () => {
    const enemies = [makeEnemy({ id: 'e1', knockedDown: false })];
    expect(allEnemiesKnockedDown(enemies)).toBe(false);
  });

  it('returns true when all alive enemies are knocked down', () => {
    const enemies = [
      makeEnemy({ id: 'e1', knockedDown: true }),
      makeEnemy({ id: 'e2', knockedDown: true }),
    ];
    expect(allEnemiesKnockedDown(enemies)).toBe(true);
  });

  it('returns false when one alive enemy is not knocked down', () => {
    const enemies = [
      makeEnemy({ id: 'e1', knockedDown: true }),
      makeEnemy({ id: 'e2', knockedDown: false }),
    ];
    expect(allEnemiesKnockedDown(enemies)).toBe(false);
  });

  it('excludes dead enemies — a dead non-KD enemy does not block the trigger', () => {
    // e1: alive, knocked down. e2: dead, not knocked down.
    // All alive enemies (just e1) are knocked down → should be true.
    const enemies = [
      makeEnemy({ id: 'e1', alive: true, knockedDown: true }),
      makeEnemy({ id: 'e2', alive: false, knockedDown: false }),
    ];
    expect(allEnemiesKnockedDown(enemies)).toBe(true);
  });

  it('returns false when a boss is alive — boss cannot be knocked down so check never passes', () => {
    const enemies = [
      makeEnemy({ id: 'e1', knockedDown: true }),
      makeEnemy({ id: 'boss', _monsterType: 'boss', knockedDown: false }),
    ];
    expect(allEnemiesKnockedDown(enemies)).toBe(false);
  });

  it('returns false when there are no alive enemies (empty field should not trigger AOA)', () => {
    const enemies = [makeEnemy({ id: 'e1', alive: false })];
    expect(allEnemiesKnockedDown(enemies)).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(allEnemiesKnockedDown([])).toBe(false);
  });
});
