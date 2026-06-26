import { describe, it, expect } from 'vitest';
import { SKILLS } from '../../src/data/skills';

describe('SKILLS — target field', () => {
  it('existing attack skills declare target: enemy', () => {
    expect(SKILLS.burst_shot.target).toBe('enemy');
    expect(SKILLS.shield_bash.target).toBe('enemy');
    expect(SKILLS.swift_strike.target).toBe('enemy');
  });

  it('existing attack skill multipliers are unchanged (regression)', () => {
    expect(SKILLS.burst_shot.multiplier).toBe(1.5);
    expect(SKILLS.shield_bash.multiplier).toBe(1.2);
    expect(SKILLS.swift_strike.multiplier).toBe(1.3);
  });
});

describe('SKILLS — new heal skill', () => {
  it('field_medic is a heal skill targeting ally', () => {
    const s = SKILLS.field_medic;
    expect(s).toBeDefined();
    expect(s.type).toBe('heal');
    expect(s.target).toBe('ally');
    expect(s.multiplier).toBe(0.8);
  });
});

describe('SKILLS — new buff skills', () => {
  it('combat_stim is a self-targeted atk buff', () => {
    const s = SKILLS.combat_stim;
    expect(s).toBeDefined();
    expect(s.type).toBe('buff');
    expect(s.target).toBe('self');
    expect(s.buffStat).toBe('atk');
    expect(s.buffAmountPct).toBe(0.3);
    expect(s.buffDuration).toBe(3);
  });

  it('iron_will is an ally-targeted def buff', () => {
    const s = SKILLS.iron_will;
    expect(s).toBeDefined();
    expect(s.type).toBe('buff');
    expect(s.target).toBe('ally');
    expect(s.buffStat).toBe('def');
    expect(s.buffAmountPct).toBe(0.4);
    expect(s.buffDuration).toBe(3);
  });
});
