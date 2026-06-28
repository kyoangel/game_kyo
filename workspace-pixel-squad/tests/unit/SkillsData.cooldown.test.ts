import { describe, it, expect } from 'vitest';
import { SKILLS } from '../../src/data/skills';

describe('SKILLS — cooldown values', () => {
  it('burst_shot has cooldown 3 (strong nuke — 1.5× multiplier)', () => {
    expect((SKILLS.burst_shot as any).cooldown).toBe(3);
  });

  it('overdrive has cooldown 4 (1.5× effective burst over 2 turns)', () => {
    expect((SKILLS.overdrive as any).cooldown).toBe(4);
  });

  it('iron_will has cooldown 3 (party-wide 40% DEF buff)', () => {
    expect((SKILLS.iron_will as any).cooldown).toBe(3);
  });

  it('combat_stim has cooldown 3 (30% ATK self-buff)', () => {
    expect((SKILLS.combat_stim as any).cooldown).toBe(3);
  });

  it('shield_bash has cooldown 2 (moderate 1.2× attack)', () => {
    expect((SKILLS.shield_bash as any).cooldown).toBe(2);
  });

  it('swift_strike has cooldown 2 (moderate 1.3× attack)', () => {
    expect((SKILLS.swift_strike as any).cooldown).toBe(2);
  });

  it('field_medic has cooldown 2 (sustain heal)', () => {
    expect((SKILLS.field_medic as any).cooldown).toBe(2);
  });

  it('all seven skills have a positive integer cooldown ≥ 1', () => {
    const cooldownSkills = ['burst_shot', 'overdrive', 'iron_will', 'combat_stim',
                            'shield_bash', 'swift_strike', 'field_medic'];
    for (const id of cooldownSkills) {
      const cd = (SKILLS[id] as any).cooldown;
      expect(cd, `${id} should have cooldown ≥ 1`).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(cd), `${id} cooldown should be an integer`).toBe(true);
    }
  });
});
