/**
 * Status Effect Expansion — SKILLS data carries appliesStatus, and toxic_spray exists.
 */
import { describe, it, expect } from 'vitest';
import { SKILLS } from '../../src/data/skills';

describe('SKILLS — appliesStatus on existing skills', () => {
  it('cryo_round applies freeze', () => {
    expect((SKILLS.cryo_round as any).appliesStatus).toBe('freeze');
  });

  it('acid_splash applies burn', () => {
    expect((SKILLS.acid_splash as any).appliesStatus).toBe('burn');
  });

  it('emp_pulse applies stun', () => {
    expect((SKILLS.emp_pulse as any).appliesStatus).toBe('stun');
  });

  it('fire_grenade does not apply any status (unchanged skill)', () => {
    expect((SKILLS.fire_grenade as any).appliesStatus).toBeUndefined();
  });
});

describe('SKILLS — toxic_spray new skill', () => {
  it('exists with the correct shape', () => {
    const skill = SKILLS['toxic_spray'] as any;
    expect(skill).toBeDefined();
    expect(skill.id).toBe('toxic_spray');
    expect(skill.type).toBe('attack');
    expect(skill.target).toBe('enemy');
    expect(skill.multiplier).toBe(0.8);
    expect(skill.cooldown).toBe(2);
    expect(skill.element).toBe('toxin');
    expect(skill.appliesStatus).toBe('poison');
  });
});

describe('SKILLS — appliesStatus is a valid StatusEffectType when present', () => {
  const VALID_STATUSES = new Set(['poison', 'burn', 'freeze', 'stun']);

  it('every skill with appliesStatus uses a valid status type', () => {
    for (const skill of Object.values(SKILLS)) {
      const status = (skill as any).appliesStatus;
      if (status !== undefined) {
        expect(VALID_STATUSES.has(status)).toBe(true);
      }
    }
  });
});
