/**
 * Status Effect Expansion — Poison / Burn / Freeze / Stun core logic in Buffs.ts
 * Covers: effectiveAtk (burn), effectiveSpd (stun), applyStatusEffect, tickStatusEffects.
 */
import { describe, it, expect } from 'vitest';
import { effectiveAtk, effectiveSpd, applyStatusEffect, tickStatusEffects } from '../../src/battle/Buffs';
import type { Character, StatusEffectType } from '../../src/types';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '狙擊', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {},
    ...overrides,
  };
}

describe('effectiveAtk — Burn', () => {
  it('reduces effectiveAtk by 30% when burn is active', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'burn', turnsRemaining: 2, sourceSkillId: 'acid_splash' }],
    });
    expect(effectiveAtk(c)).toBe(Math.floor(20 * 0.70));
  });

  it('stacks burn reduction on top of an active ATK buff', () => {
    const c = makeChar({
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 'combat_stim' }],
      activeStatusEffects: [{ type: 'burn', turnsRemaining: 2, sourceSkillId: 'acid_splash' }],
    });
    // base 20 * 1.3 (buff) * 0.70 (burn), floored
    expect(effectiveAtk(c)).toBe(Math.floor(20 * 1.3 * 0.70));
  });

  it('does not reduce ATK when no burn is active', () => {
    const c = makeChar();
    expect(effectiveAtk(c)).toBe(20);
  });

  it('ignores other status effect types (e.g. poison) for ATK calc', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    expect(effectiveAtk(c)).toBe(20);
  });
});

describe('effectiveSpd — Stun', () => {
  it('returns 0 when stun is active, regardless of base SPD', () => {
    const c = makeChar({
      stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 50 },
      activeStatusEffects: [{ type: 'stun', turnsRemaining: 1, sourceSkillId: 'emp_pulse' }],
    });
    expect(effectiveSpd(c)).toBe(0);
  });

  it('returns normal effectiveSpd when no stun is active', () => {
    const c = makeChar();
    expect(effectiveSpd(c)).toBe(15);
  });

  it('ignores other status effect types (e.g. freeze) for SPD calc', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'freeze', turnsRemaining: 1, sourceSkillId: 'cryo_round' }],
    });
    expect(effectiveSpd(c)).toBe(15);
  });
});

describe('applyStatusEffect', () => {
  it('adds a new status effect entry for an unafflicted character', () => {
    const c = makeChar();
    applyStatusEffect(c, 'poison', 3, 'toxic_spray');
    expect(c.activeStatusEffects).toHaveLength(1);
    expect(c.activeStatusEffects[0]).toMatchObject({ type: 'poison', turnsRemaining: 3, sourceSkillId: 'toxic_spray' });
  });

  it('refreshes (overwrites) duration when the same status type is reapplied — no stacking', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 1, sourceSkillId: 'toxic_spray' }],
    });
    applyStatusEffect(c, 'poison', 3, 'toxic_spray');
    expect(c.activeStatusEffects).toHaveLength(1);
    expect(c.activeStatusEffects[0].turnsRemaining).toBe(3);
  });

  it('allows two different status types to coexist on the same character', () => {
    const c = makeChar();
    applyStatusEffect(c, 'poison', 3, 'toxic_spray');
    applyStatusEffect(c, 'burn', 2, 'acid_splash');
    expect(c.activeStatusEffects).toHaveLength(2);
    expect(c.activeStatusEffects.map(s => s.type).sort()).toEqual(['burn', 'poison']);
  });

  it('can apply status effects to enemy characters as well as players', () => {
    const enemy = makeChar({ isPlayer: false });
    applyStatusEffect(enemy, 'freeze', 1, 'cryo_round');
    expect(enemy.activeStatusEffects).toHaveLength(1);
  });
});

describe('tickStatusEffects — Poison DoT', () => {
  it('deals floor(maxHp * 0.08) true damage on tick', () => {
    const c = makeChar({
      stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([c]);
    expect(c.stats.hp).toBe(92); // 100 - floor(100*0.08)=8
  });

  it('deals a minimum of 1 damage even on low maxHp', () => {
    const c = makeChar({
      stats: { hp: 5, maxHp: 5, atk: 20, def: 10, spd: 15 },
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([c]);
    expect(c.stats.hp).toBe(4);
  });

  it('ignores DEF — poison damage is unaffected by defender.def', () => {
    const low = makeChar({
      stats: { hp: 100, maxHp: 100, atk: 20, def: 0, spd: 15 },
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    const high = makeChar({
      stats: { hp: 100, maxHp: 100, atk: 20, def: 999, spd: 15 },
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([low]);
    tickStatusEffects([high]);
    expect(low.stats.hp).toBe(high.stats.hp);
  });

  it('ignores defending stance — poison damage is unaffected by defend', () => {
    const defending = makeChar({
      stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 }, defending: true,
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([defending]);
    expect(defending.stats.hp).toBe(92);
  });

  it('decrements turnsRemaining by 1 after applying DoT', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([c]);
    expect(c.activeStatusEffects[0].turnsRemaining).toBe(1);
  });

  it('removes the poison effect once turnsRemaining reaches 0', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 1, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([c]);
    expect(c.activeStatusEffects).toHaveLength(0);
  });

  it('sets alive=false when poison damage reduces HP to 0', () => {
    const c = makeChar({
      stats: { hp: 5, maxHp: 100, atk: 20, def: 10, spd: 15 },
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([c]);
    expect(c.stats.hp).toBe(0);
    expect(c.alive).toBe(false);
  });

  it('does not deal poison damage to already-dead characters', () => {
    const c = makeChar({
      alive: false,
      stats: { hp: 0, maxHp: 100, atk: 20, def: 10, spd: 15 },
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    tickStatusEffects([c]);
    expect(c.stats.hp).toBe(0);
  });

  it('returns a StatusTickEvent describing the poison damage dealt', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }],
    });
    const events = tickStatusEffects([c]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ character: c, type: 'poison', damage: 8 });
  });
});

describe('tickStatusEffects — generic duration handling (burn/freeze/stun)', () => {
  it('decrements turnsRemaining for non-poison effects without dealing damage', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'burn', turnsRemaining: 2, sourceSkillId: 'acid_splash' }],
    });
    const hpBefore = c.stats.hp;
    tickStatusEffects([c]);
    expect(c.stats.hp).toBe(hpBefore);
    expect(c.activeStatusEffects[0].turnsRemaining).toBe(1);
  });

  it('removes freeze once turnsRemaining reaches 0, allowing normal action next round', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'freeze', turnsRemaining: 1, sourceSkillId: 'cryo_round' }],
    });
    tickStatusEffects([c]);
    expect(c.activeStatusEffects.some(s => s.type === 'freeze')).toBe(false);
  });

  it('removes stun once turnsRemaining reaches 0', () => {
    const c = makeChar({
      activeStatusEffects: [{ type: 'stun', turnsRemaining: 1, sourceSkillId: 'emp_pulse' }],
    });
    tickStatusEffects([c]);
    expect(c.activeStatusEffects.some(s => s.type === 'stun')).toBe(false);
  });

  it('ticks multiple distinct effects on the same character independently', () => {
    const c = makeChar({
      activeStatusEffects: [
        { type: 'burn', turnsRemaining: 1, sourceSkillId: 'acid_splash' },
        { type: 'poison', turnsRemaining: 3, sourceSkillId: 'toxic_spray' },
      ],
    });
    tickStatusEffects([c]);
    expect(c.activeStatusEffects.some(s => s.type === 'burn')).toBe(false);
    const poison = c.activeStatusEffects.find(s => s.type === 'poison');
    expect(poison?.turnsRemaining).toBe(2);
  });

  it('ticks every living character in the party', () => {
    const a = makeChar({ id: 'a', activeStatusEffects: [{ type: 'poison', turnsRemaining: 2, sourceSkillId: 'toxic_spray' }] });
    const b = makeChar({ id: 'b', activeStatusEffects: [{ type: 'burn', turnsRemaining: 1, sourceSkillId: 'acid_splash' }] });
    tickStatusEffects([a, b]);
    expect(a.activeStatusEffects[0].turnsRemaining).toBe(1);
    expect(b.activeStatusEffects).toHaveLength(0);
  });

  it('does not throw for a character with no active status effects', () => {
    const c = makeChar();
    expect(() => tickStatusEffects([c])).not.toThrow();
    expect(c.activeStatusEffects).toHaveLength(0);
  });
});
