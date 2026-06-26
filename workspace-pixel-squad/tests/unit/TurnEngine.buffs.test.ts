import { describe, it, expect } from 'vitest';
import { computeTurnOrder } from '../../src/battle/TurnEngine';
import type { Character } from '../../src/types';

function makeChar(id: string, spd: number, overrides: Partial<Character> = {}): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

describe('computeTurnOrder — buffed spd affects order', () => {
  it('a spd-buffed slower character can now act before a faster unbuffed one', () => {
    const slowButBuffed = makeChar('slow', 10, {
      activeBuffs: [{ stat: 'spd', amountPct: 1.0, turnsRemaining: 3, sourceSkillId: 'speed_boost' }],
    });
    const fastUnbuffed = makeChar('fast', 15);

    const order = computeTurnOrder([fastUnbuffed, slowButBuffed]);
    // effective spd: slow = 10*2=20, fast = 15 -> slow should go first
    expect(order[0].id).toBe('slow');
  });

  it('unbuffed ordering is unchanged (regression)', () => {
    const a = makeChar('a', 20);
    const b = makeChar('b', 10);
    const order = computeTurnOrder([b, a]);
    expect(order.map(c => c.id)).toEqual(['a', 'b']);
  });
});
