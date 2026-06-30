/**
 * Status Effect Expansion — Stun acceptance criteria for turn order.
 * computeTurnOrder uses effectiveSpd, which returns 0 for stunned characters,
 * so they naturally sort to the back but still appear in the order (they act, just last).
 */
import { describe, it, expect } from 'vitest';
import { computeTurnOrder } from '../../src/battle/TurnEngine';
import type { Character } from '../../src/types';

function makeChar(id: string, spd: number, isPlayer: boolean, overrides: Partial<Character> = {}): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {},
    ...overrides,
  };
}

describe('computeTurnOrder — Stun', () => {
  it('a stunned enemy (effectiveSpd 0) appears after a player character with SPD 10', () => {
    const player = makeChar('player', 10, true);
    const stunnedEnemy = makeChar('enemy', 30, false, {
      activeStatusEffects: [{ type: 'stun', turnsRemaining: 1, sourceSkillId: 'emp_pulse' }],
    });
    const order = computeTurnOrder([player, stunnedEnemy]);
    expect(order.map(c => c.id)).toEqual(['player', 'enemy']);
  });

  it('a stunned character still appears in the turn order (delayed, not skipped)', () => {
    const stunned = makeChar('stunned', 50, true, {
      activeStatusEffects: [{ type: 'stun', turnsRemaining: 1, sourceSkillId: 'emp_pulse' }],
    });
    const order = computeTurnOrder([stunned]);
    expect(order).toHaveLength(1);
    expect(order[0].id).toBe('stunned');
  });

  it('a non-stunned character with higher SPD acts before one with lower SPD, unaffected by unrelated statuses', () => {
    const a = makeChar('a', 20, true, {
      activeStatusEffects: [{ type: 'burn', turnsRemaining: 2, sourceSkillId: 'acid_splash' }],
    });
    const b = makeChar('b', 10, true);
    const order = computeTurnOrder([a, b]);
    expect(order.map(c => c.id)).toEqual(['a', 'b']);
  });
});
