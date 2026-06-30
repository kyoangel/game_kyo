/**
 * Status Effect Expansion — Status icon strip data (ui/battleStatusIcons.ts).
 * Characters with active status effects expose displayable icon data,
 * mirroring the existing getBuffIconData pattern in battleBuffDisplay.ts.
 */
import { describe, it, expect } from 'vitest';
import { getStatusIconData } from '../../src/ui/battleStatusIcons';
import type { Character } from '../../src/types';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1', templateId: 'c1', name: 'Hero', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {},
    ...overrides,
  };
}

describe('getStatusIconData', () => {
  it('returns empty array when character has no active status effects', () => {
    const char = makeChar({ activeStatusEffects: [] });
    expect(getStatusIconData(char)).toEqual([]);
  });

  it('returns one entry per active status effect', () => {
    const char = makeChar({
      activeStatusEffects: [
        { type: 'poison', turnsRemaining: 3, sourceSkillId: 'toxic_spray' },
        { type: 'burn', turnsRemaining: 2, sourceSkillId: 'acid_splash' },
      ],
    });
    expect(getStatusIconData(char)).toHaveLength(2);
  });

  it('each entry includes the status type', () => {
    const char = makeChar({
      activeStatusEffects: [{ type: 'freeze', turnsRemaining: 1, sourceSkillId: 'cryo_round' }],
    });
    const icons = getStatusIconData(char);
    expect(icons[0].type).toBe('freeze');
  });

  it('each entry includes turnsRemaining', () => {
    const char = makeChar({
      activeStatusEffects: [{ type: 'stun', turnsRemaining: 1, sourceSkillId: 'emp_pulse' }],
    });
    const icons = getStatusIconData(char);
    expect(icons[0].turnsRemaining).toBe(1);
  });

  it('maps poison to the ☠ icon glyph', () => {
    const char = makeChar({
      activeStatusEffects: [{ type: 'poison', turnsRemaining: 3, sourceSkillId: 'toxic_spray' }],
    });
    expect(getStatusIconData(char)[0].icon).toBe('☠');
  });

  it('maps freeze to the ❄ icon glyph', () => {
    const char = makeChar({
      activeStatusEffects: [{ type: 'freeze', turnsRemaining: 1, sourceSkillId: 'cryo_round' }],
    });
    expect(getStatusIconData(char)[0].icon).toBe('❄');
  });

  it('maps stun to the ⚡ icon glyph', () => {
    const char = makeChar({
      activeStatusEffects: [{ type: 'stun', turnsRemaining: 1, sourceSkillId: 'emp_pulse' }],
    });
    expect(getStatusIconData(char)[0].icon).toBe('⚡');
  });

  it('removing a status effect (e.g. after tick) removes its icon entry', () => {
    const char = makeChar({ activeStatusEffects: [] });
    expect(getStatusIconData(char)).toHaveLength(0);
  });
});
