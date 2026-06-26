import { describe, it, expect } from 'vitest';
import { chooseTarget } from '../../src/battle/AI';
import type { Character } from '../../src/types';

function makeChar(id: string, atk: number, overrides: Partial<Character> = {}): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 50, maxHp: 100, atk, def: 5, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

describe('chooseTarget highest-atk — uses effective (buffed) ATK', () => {
  it('picks the character whose buffed effective ATK is highest, not raw stats.atk', () => {
    const a = makeChar('a', 20);
    const b = makeChar('b', 18, {
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 'combat_stim' }],
    });
    // raw: a(20) > b(18); effective: b = 18*1.3 = 23.4 > a(20)
    expect(chooseTarget([a, b], 'highest-atk')?.id).toBe('b');
  });
});
