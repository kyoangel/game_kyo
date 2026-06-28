import { describe, it, expect } from 'vitest';
import { SKILLS } from '../../src/data/skills';

// AC-8: All attack skills have element assignments; new elemental skills exist

describe('AC-8: existing attack skills carry correct element assignments', () => {
  it('burst_shot has element: fire', () => {
    expect((SKILLS.burst_shot as any).element).toBe('fire');
  });

  it('shield_bash has element: physical', () => {
    expect((SKILLS.shield_bash as any).element).toBe('physical');
  });

  it('swift_strike has element: thunder', () => {
    expect((SKILLS.swift_strike as any).element).toBe('thunder');
  });

  it('heal skills have no element (undefined)', () => {
    expect((SKILLS.field_medic as any).element).toBeUndefined();
  });

  it('buff skills have no element (undefined)', () => {
    expect((SKILLS.combat_stim as any).element).toBeUndefined();
    expect((SKILLS.iron_will as any).element).toBeUndefined();
  });
});

describe('AC-8: new elemental skills exist in SKILLS data', () => {
  it('cryo_round exists with element: ice', () => {
    expect(SKILLS['cryo_round']).toBeDefined();
    expect((SKILLS['cryo_round'] as any).element).toBe('ice');
  });

  it('cryo_round has correct properties (type=attack, multiplier=1.2, cooldown=2)', () => {
    const skill = SKILLS['cryo_round'] as any;
    expect(skill.type).toBe('attack');
    expect(skill.target).toBe('enemy');
    expect(skill.multiplier).toBe(1.2);
    expect(skill.cooldown).toBe(2);
  });

  it('acid_splash exists with element: toxin', () => {
    expect(SKILLS['acid_splash']).toBeDefined();
    expect((SKILLS['acid_splash'] as any).element).toBe('toxin');
  });

  it('acid_splash has correct properties (multiplier=1.1, cooldown=1)', () => {
    const skill = SKILLS['acid_splash'] as any;
    expect(skill.type).toBe('attack');
    expect(skill.multiplier).toBe(1.1);
    expect(skill.cooldown).toBe(1);
  });

  it('fire_grenade exists with element: fire', () => {
    expect(SKILLS['fire_grenade']).toBeDefined();
    expect((SKILLS['fire_grenade'] as any).element).toBe('fire');
  });

  it('fire_grenade has correct properties (multiplier=1.6, cooldown=3)', () => {
    const skill = SKILLS['fire_grenade'] as any;
    expect(skill.type).toBe('attack');
    expect(skill.multiplier).toBe(1.6);
    expect(skill.cooldown).toBe(3);
  });

  it('emp_pulse exists with element: thunder', () => {
    expect(SKILLS['emp_pulse']).toBeDefined();
    expect((SKILLS['emp_pulse'] as any).element).toBe('thunder');
  });

  it('emp_pulse has correct properties (multiplier=1.3, cooldown=2)', () => {
    const skill = SKILLS['emp_pulse'] as any;
    expect(skill.type).toBe('attack');
    expect(skill.multiplier).toBe(1.3);
    expect(skill.cooldown).toBe(2);
  });
});

describe('AC-8: element is a valid Element union value when defined', () => {
  const VALID_ELEMENTS = new Set(['fire', 'ice', 'thunder', 'toxin', 'physical']);

  it('every attack skill with an element property uses a valid Element value', () => {
    for (const skill of Object.values(SKILLS)) {
      const element = (skill as any).element;
      if (element !== undefined) {
        expect(VALID_ELEMENTS.has(element)).toBe(true);
      }
    }
  });
});
