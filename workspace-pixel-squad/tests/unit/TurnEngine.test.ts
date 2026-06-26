import { describe, it, expect } from 'vitest';
import { computeTurnOrder } from '../../src/battle/TurnEngine';
import type { Character } from '../../src/types';

function makeChar(id: string, spd: number, isPlayer: boolean, alive = true): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd },
    skills: [], statPoints: 0, archetype: '全能', alive, defending: false, activeBuffs: [],
  };
}

describe('computeTurnOrder', () => {
  it('sorts living characters by SPD descending', () => {
    const chars = [makeChar('a', 10, true), makeChar('b', 20, false), makeChar('c', 15, true)];
    const order = computeTurnOrder(chars);
    expect(order.map(c => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('excludes dead characters', () => {
    const chars = [makeChar('a', 10, true), makeChar('dead', 30, false, false)];
    const order = computeTurnOrder(chars);
    expect(order).toHaveLength(1);
    expect(order[0].id).toBe('a');
  });

  it('on SPD tie: player acts before enemy', () => {
    const chars = [makeChar('enemy', 15, false), makeChar('player', 15, true)];
    const order = computeTurnOrder(chars);
    expect(order[0].id).toBe('player');
    expect(order[1].id).toBe('enemy');
  });

  it('returns empty array when all dead', () => {
    const chars = [makeChar('a', 10, true, false)];
    expect(computeTurnOrder(chars)).toHaveLength(0);
  });
});
