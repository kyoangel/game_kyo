import { describe, it, expect } from 'vitest';
import {
  isCommandAllowedUnderConstraint,
  isChallengePhraseConstraintViolated,
} from '../../src/battle/ChallengePhrase';
import type { Character, PendingCommand } from '../../src/types';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
// AC-2: Given a player selects an unlocked phrase, When they begin the next
// run, Then the game enforces all constraints defined by that phrase.
//
// Constraint enforcement is exercised as pure functions here, independent of
// TurnEngine/BattleScene wiring, per the "pure business logic only" rule.

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'p1', templateId: 'vega', name: 'Vega', isProtagonist: false, isPlayer: true,
    level: 5, exp: 0, expToNext: 250,
    stats: { hp: 80, maxHp: 100, atk: 30, def: 10, spd: 14 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

function makeCommand(action: PendingCommand['action']): PendingCommand {
  return { character: makeCharacter(), action };
}

describe('isCommandAllowedUnderConstraint — physicalOnly', () => {
  it('allows a basic attack command', () => {
    const allowed = isCommandAllowedUnderConstraint({ type: 'physicalOnly' }, makeCommand('attack'));
    expect(allowed).toBe(true);
  });

  it('allows a defend command', () => {
    const allowed = isCommandAllowedUnderConstraint({ type: 'physicalOnly' }, makeCommand('defend'));
    expect(allowed).toBe(true);
  });

  it('disallows a skill command', () => {
    const allowed = isCommandAllowedUnderConstraint({ type: 'physicalOnly' }, makeCommand('skill'));
    expect(allowed).toBe(false);
  });
});

describe('isCommandAllowedUnderConstraint — turnLimit', () => {
  it('does not restrict command choice (any action is legal under a turn limit)', () => {
    const constraint = { type: 'turnLimit' as const, turnLimit: 3 };
    expect(isCommandAllowedUnderConstraint(constraint, makeCommand('attack'))).toBe(true);
    expect(isCommandAllowedUnderConstraint(constraint, makeCommand('skill'))).toBe(true);
    expect(isCommandAllowedUnderConstraint(constraint, makeCommand('defend'))).toBe(true);
  });
});

describe('isChallengePhraseConstraintViolated — turnLimit', () => {
  it('is not violated while roundsUsed is within the limit', () => {
    const constraint = { type: 'turnLimit' as const, turnLimit: 3 };
    expect(isChallengePhraseConstraintViolated(constraint, { roundsUsed: 3 })).toBe(false);
  });

  it('is violated once roundsUsed exceeds the limit', () => {
    const constraint = { type: 'turnLimit' as const, turnLimit: 3 };
    expect(isChallengePhraseConstraintViolated(constraint, { roundsUsed: 4 })).toBe(true);
  });

  it('is not violated when roundsUsed is omitted (battle not yet started)', () => {
    const constraint = { type: 'turnLimit' as const, turnLimit: 3 };
    expect(isChallengePhraseConstraintViolated(constraint, {})).toBe(false);
  });
});

describe('isChallengePhraseConstraintViolated — physicalOnly', () => {
  it('is violated once a non-physical (skill) action has been used', () => {
    const constraint = { type: 'physicalOnly' as const };
    expect(isChallengePhraseConstraintViolated(constraint, { usedSkill: true })).toBe(true);
  });

  it('is not violated while only basic attacks/defends have been used', () => {
    const constraint = { type: 'physicalOnly' as const };
    expect(isChallengePhraseConstraintViolated(constraint, { usedSkill: false })).toBe(false);
  });
});
