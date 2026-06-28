import { describe, it, expect } from 'vitest';
import { decideAction } from '../../src/battle/SkillAI';
import type { Skill } from '../../src/types';

// Use `any` so TypeScript does not reject skillCooldowns (not yet on Character type).
function makeChar(overrides: Record<string, any> = {}): any {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [],
    skillCooldowns: {},
    ...overrides,
  };
}

const overdriveSkill: Skill = {
  id: 'overdrive', name: '超載', type: 'buff', target: 'self',
  multiplier: 0, buffStat: 'atk', buffAmountPct: 0.5, buffDuration: 2,
  description: '',
};

const fieldMedicSkill: Skill = {
  id: 'field_medic', name: '戰地醫療', type: 'heal', target: 'ally',
  multiplier: 0.8, description: '',
};

const burstShotSkill: Skill = {
  id: 'burst_shot', name: '爆發射擊', type: 'attack', target: 'enemy',
  multiplier: 1.5, description: '',
};

describe('SkillAI.decideAction — cooldown awareness (AC4)', () => {
  it('does not choose a buff skill whose cooldown counter is > 0', () => {
    // AC4: enemy AI used overdrive; next round it must fall back, not re-use it
    const actor = makeChar({
      id: 'actor',
      skills: [overdriveSkill],
      skillCooldowns: { overdrive: 4 },
      activeBuffs: [],
    });
    const enemy = makeChar({ id: 'enemy', isPlayer: false });

    const decision = decideAction(actor, [actor], [enemy]);
    expect(decision.skill?.id).not.toBe('overdrive');
  });

  it('does not choose a heal skill whose cooldown counter is > 0 even when an ally is below 50% HP', () => {
    const healer = makeChar({
      id: 'healer',
      skills: [fieldMedicSkill],
      skillCooldowns: { field_medic: 2 },
    });
    const hurtAlly = makeChar({
      id: 'hurt',
      stats: { hp: 30, maxHp: 100, atk: 10, def: 5, spd: 10 },
    });
    const enemy = makeChar({ id: 'enemy', isPlayer: false });

    const decision = decideAction(healer, [healer, hurtAlly], [enemy]);
    expect(decision.skill?.id).not.toBe('field_medic');
  });

  it('never chooses an attack skill that is on cooldown', () => {
    // With the only attack skill on cooldown, AI must always fall back to basic attack.
    const actor = makeChar({
      id: 'actor',
      skills: [burstShotSkill],
      skillCooldowns: { burst_shot: 3 },
    });
    const enemy = makeChar({ id: 'enemy', isPlayer: false });

    // Run enough trials to be statistically certain — current (unguarded) AI picks
    // attack skills with 50% probability, so at least one of 30 calls will choose burst_shot.
    for (let i = 0; i < 30; i++) {
      const decision = decideAction(actor, [actor], [enemy]);
      expect(decision.skill?.id).not.toBe('burst_shot');
    }
  });

});
