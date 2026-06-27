import { describe, it, expect } from 'vitest';
import { deriveFlashTint, SKILL_CAST_CONFIG } from '../../src/battle/AnimationState';
import type { Skill } from '../../src/types';

// Tests fail until src/battle/AnimationState.ts exports deriveFlashTint and SKILL_CAST_CONFIG.
//
// Spec: skill cast plays instead of attack when cmd.action === 'skill'.
//   heal skill → blue flash (matches SFX_KEYS.heal call site)
//   buff skill  → green flash (matches SFX_KEYS.buff call site)
//   attack-type damage skill → white flash
//   No walk step for self/ally-targeted skills (caster doesn't approach).

function makeSkill(overrides: Partial<Skill>): Skill {
  return {
    id: 's1',
    name: 'Test',
    type: 'attack',
    target: 'enemy',
    multiplier: 1.0,
    description: '',
    ...overrides,
  };
}

describe('deriveFlashTint', () => {
  it('is exported from AnimationState.ts', () => {
    expect(deriveFlashTint).toBeDefined();
  });

  it('returns "blue" for heal skills — matches SFX_KEYS.heal color association', () => {
    expect(deriveFlashTint(makeSkill({ type: 'heal' }))).toBe('blue');
  });

  it('returns "green" for buff skills — matches SFX_KEYS.buff color association', () => {
    expect(deriveFlashTint(makeSkill({ type: 'buff' }))).toBe('green');
  });

  it('returns "white" for attack-type skills (damage dealing)', () => {
    expect(deriveFlashTint(makeSkill({ type: 'attack' }))).toBe('white');
  });

  it('all three skill types map to distinct flash tints', () => {
    const heal = deriveFlashTint(makeSkill({ type: 'heal' }));
    const buff = deriveFlashTint(makeSkill({ type: 'buff' }));
    const attack = deriveFlashTint(makeSkill({ type: 'attack' }));
    expect(new Set([heal, buff, attack]).size).toBe(3);
  });
});

describe('SKILL_CAST_CONFIG', () => {
  it('is exported from AnimationState.ts', () => {
    expect(SKILL_CAST_CONFIG).toBeDefined();
  });

  it('color flash overlay duration is 250ms', () => {
    expect(SKILL_CAST_CONFIG.flashDuration).toBe(250);
  });
});
