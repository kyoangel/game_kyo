import { describe, it, expect } from 'vitest';
import { shouldTriggerAoa } from '../../src/battle/AllOutAttack';
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

// --- shouldTriggerAoa ---

describe('shouldTriggerAoa — core trigger (AC: all enemies down → prompt)', () => {
  it('returns true when all alive enemies are knocked down and AOA not yet used', () => {
    const enemies = [
      makeEnemy({ id: 'e1', knockedDown: true }),
      makeEnemy({ id: 'e2', knockedDown: true }),
    ];
    expect(shouldTriggerAoa(enemies, { usedThisRound: false })).toBe(true);
  });

  it('returns false when AOA was already used/declined this round', () => {
    const enemies = [makeEnemy({ id: 'e1', knockedDown: true })];
    // usedThisRound=true simulates the player having pressed "Pass"
    expect(shouldTriggerAoa(enemies, { usedThisRound: true })).toBe(false);
  });

  it('returns false when at least one alive enemy is not knocked down', () => {
    const enemies = [
      makeEnemy({ id: 'e1', knockedDown: true }),
      makeEnemy({ id: 'e2', knockedDown: false }),
    ];
    expect(shouldTriggerAoa(enemies, { usedThisRound: false })).toBe(false);
  });

  it('returns false when a boss is alive (boss blocks AOA)', () => {
    const enemies = [
      makeEnemy({ id: 'e1', knockedDown: true }),
      makeEnemy({ id: 'boss', _monsterType: 'boss', knockedDown: false }),
    ];
    expect(shouldTriggerAoa(enemies, { usedThisRound: false })).toBe(false);
  });
});

describe('shouldTriggerAoa — decline path (AC: Pass blocks re-trigger this round)', () => {
  it('returns false after decline even if a new weakness hit would otherwise satisfy the check', () => {
    // After declining AOA, usedThisRound=true. Even if another weakness hit occurs
    // (and allEnemiesKnockedDown would return true), AOA must not re-trigger.
    const allKnockedDown = [
      makeEnemy({ id: 'e1', knockedDown: true }),
    ];
    expect(shouldTriggerAoa(allKnockedDown, { usedThisRound: true })).toBe(false);
  });

  it('returns true again once usedThisRound is reset (round reset AC)', () => {
    // Simulates start of next round: usedThisRound reset to false
    const allKnockedDown = [makeEnemy({ id: 'e1', knockedDown: true })];
    expect(shouldTriggerAoa(allKnockedDown, { usedThisRound: false })).toBe(true);
  });
});

describe('shouldTriggerAoa — dead enemy exclusion', () => {
  it('returns true when only alive enemy is knocked down (dead enemies are excluded)', () => {
    // Scenario: enemy B was killed by a non-weakness hit. Enemy A is alive and knocked down.
    // All alive enemies (just A) are knocked down → WOULD trigger if called on weakness hit.
    // This verifies allEnemiesKnockedDown exclusion logic via shouldTriggerAoa.
    const enemies = [
      makeEnemy({ id: 'A', alive: true, knockedDown: true }),
      makeEnemy({ id: 'B', alive: false, knockedDown: false }),
    ];
    expect(shouldTriggerAoa(enemies, { usedThisRound: false })).toBe(true);
  });

  it('returns false when there are no alive enemies', () => {
    const enemies = [makeEnemy({ id: 'e1', alive: false })];
    expect(shouldTriggerAoa(enemies, { usedThisRound: false })).toBe(false);
  });
});
