/**
 * AC-3: Battle — buff/debuff icons
 * Characters with active buffs expose displayable icon data per buff slot.
 * Each slot must carry the buff's stat key, remaining turns, and a short label.
 */
import { describe, it, expect } from 'vitest';
import { getBuffIconData } from '../../src/ui/battleBuffDisplay';
import type { Character } from '../../src/types';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1', templateId: 'c1', name: 'Hero', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: {},
    ...overrides,
  };
}

describe('getBuffIconData', () => {
  it('returns empty array when character has no active buffs', () => {
    const char = makeChar({ activeBuffs: [] });
    expect(getBuffIconData(char)).toEqual([]);
  });

  it('returns one entry per active buff', () => {
    const char = makeChar({
      activeBuffs: [
        { stat: 'atk', amountPct: 0.3, turnsRemaining: 2, sourceSkillId: 's1' },
        { stat: 'def', amountPct: 0.2, turnsRemaining: 1, sourceSkillId: 's2' },
      ],
    });
    expect(getBuffIconData(char)).toHaveLength(2);
  });

  it('each entry includes the stat key', () => {
    const char = makeChar({
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 's1' }],
    });
    const icons = getBuffIconData(char);
    expect(icons[0].stat).toBe('atk');
  });

  it('each entry includes turnsRemaining for tooltip display', () => {
    const char = makeChar({
      activeBuffs: [{ stat: 'spd', amountPct: 0.15, turnsRemaining: 2, sourceSkillId: 's3' }],
    });
    const icons = getBuffIconData(char);
    expect(icons[0].turnsRemaining).toBe(2);
  });

  it('each entry includes a short label string for the icon slot', () => {
    const char = makeChar({
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 1, sourceSkillId: 's1' }],
    });
    const icons = getBuffIconData(char);
    expect(typeof icons[0].label).toBe('string');
    expect(icons[0].label.length).toBeGreaterThan(0);
  });

  it('caps display at 4 icons even if character has more buffs', () => {
    const char = makeChar({
      activeBuffs: [
        { stat: 'atk', amountPct: 0.1, turnsRemaining: 1, sourceSkillId: 'a' },
        { stat: 'def', amountPct: 0.1, turnsRemaining: 1, sourceSkillId: 'b' },
        { stat: 'spd', amountPct: 0.1, turnsRemaining: 1, sourceSkillId: 'c' },
        { stat: 'atk', amountPct: 0.2, turnsRemaining: 2, sourceSkillId: 'd' },
        { stat: 'def', amountPct: 0.2, turnsRemaining: 2, sourceSkillId: 'e' },
      ],
    });
    expect(getBuffIconData(char).length).toBeLessThanOrEqual(4);
  });
});
