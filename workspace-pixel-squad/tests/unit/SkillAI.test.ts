import { describe, it, expect } from 'vitest';
import { decideAction } from '../../src/battle/SkillAI';
import type { Character, Skill } from '../../src/types';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: {},
    ...overrides,
  };
}

const healSkill: Skill = {
  id: 'field_medic', name: '戰地醫療', type: 'heal', target: 'ally', multiplier: 0.8, description: '',
};
const buffSkill: Skill = {
  id: 'iron_will', name: '鋼鐵意志', type: 'buff', target: 'ally',
  multiplier: 0, buffStat: 'def', buffAmountPct: 0.4, buffDuration: 3, description: '',
};
const attackSkill: Skill = { id: 'burst_shot', name: '爆發射擊', type: 'attack', target: 'enemy', multiplier: 1.5, description: '' };

describe('decideAction priority: heal > buff > attack-skill > basic attack', () => {
  it('heals the lowest-HP% living ally when any ally is below 50% HP', () => {
    const healer = makeChar({ id: 'healer', skills: [healSkill] });
    const hurtAlly = makeChar({ id: 'hurt', stats: { hp: 30, maxHp: 100, atk: 10, def: 5, spd: 10 } });
    const okAlly = makeChar({ id: 'ok', stats: { hp: 90, maxHp: 100, atk: 10, def: 5, spd: 10 } });
    const enemies = [makeChar({ id: 'enemy1', isPlayer: false })];

    const decision = decideAction(healer, [healer, hurtAlly, okAlly], enemies);
    expect(decision.skill?.id).toBe('field_medic');
    expect(decision.target.id).toBe('hurt');
  });

  it('does not heal when all allies are at or above 50% HP', () => {
    const healer = makeChar({ id: 'healer', skills: [healSkill] });
    const okAlly = makeChar({ id: 'ok', stats: { hp: 90, maxHp: 100, atk: 10, def: 5, spd: 10 } });
    const enemies = [makeChar({ id: 'enemy1', isPlayer: false })];

    const decision = decideAction(healer, [healer, okAlly], enemies);
    expect(decision.skill?.type).not.toBe('heal');
  });

  it('buffs when no heal is needed and the stat is not currently buffed', () => {
    const buffer = makeChar({ id: 'buffer', skills: [buffSkill] });
    const ally = makeChar({ id: 'ally' });
    const enemies = [makeChar({ id: 'enemy1', isPlayer: false })];

    const decision = decideAction(buffer, [buffer, ally], enemies);
    expect(decision.skill?.id).toBe('iron_will');
  });

  it('does not re-buff a stat that is already actively buffed on the intended target', () => {
    const buffer = makeChar({
      id: 'buffer', skills: [buffSkill],
      activeBuffs: [{ stat: 'def', amountPct: 0.4, turnsRemaining: 2, sourceSkillId: 'iron_will' }],
    });
    const enemies = [makeChar({ id: 'enemy1', isPlayer: false })];

    const decision = decideAction(buffer, [buffer], enemies);
    expect(decision.skill?.type).not.toBe('buff');
  });

  it('falls back to attack skill (50% chance) or basic attack when no heal/buff applies', () => {
    const attacker = makeChar({ id: 'attacker', skills: [attackSkill] });
    const enemy = makeChar({ id: 'enemy1', isPlayer: false });

    const decision = decideAction(attacker, [attacker], [enemy]);
    expect(['burst_shot', undefined]).toContain(decision.skill?.id);
    expect(decision.target.id).toBe('enemy1');
  });

  it('basic attack (no skill) when character has no skills at all', () => {
    const plainAttacker = makeChar({ id: 'plain', skills: [] });
    const enemy = makeChar({ id: 'enemy1', isPlayer: false });

    const decision = decideAction(plainAttacker, [plainAttacker], [enemy]);
    expect(decision.skill).toBeUndefined();
    expect(decision.target.id).toBe('enemy1');
  });
});
