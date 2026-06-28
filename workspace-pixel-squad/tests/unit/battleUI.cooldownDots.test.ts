/**
 * AC-4: Battle — skill cooldown dots
 * One dot per skill: filled (ready) vs. empty ring (on cooldown).
 * Maps character.skills + character.skillCooldowns to an array of dot states.
 */
import { describe, it, expect } from 'vitest';
import { getCooldownDotStates } from '../../src/ui/battleCooldownDots';
import type { Character, Skill } from '../../src/types';

function makeSkill(id: string): Skill {
  return { id, name: id, type: 'attack', target: 'enemy', multiplier: 1.0, description: '', cooldown: 3 };
}

function makeChar(skills: Skill[], cooldowns: Record<string, number> = {}): Character {
  return {
    id: 'c1', templateId: 'c1', name: 'Hero', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd: 8 },
    skills, statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: cooldowns,
  };
}

describe('getCooldownDotStates', () => {
  it('returns empty array when character has no skills', () => {
    const char = makeChar([]);
    expect(getCooldownDotStates(char)).toEqual([]);
  });

  it('returns one dot per skill', () => {
    const char = makeChar([makeSkill('s1'), makeSkill('s2'), makeSkill('s3')]);
    expect(getCooldownDotStates(char)).toHaveLength(3);
  });

  it('dot is ready when skill has no entry in skillCooldowns', () => {
    const char = makeChar([makeSkill('s1')], {});
    const dots = getCooldownDotStates(char);
    expect(dots[0].ready).toBe(true);
  });

  it('dot is ready when skill cooldown entry is 0', () => {
    const char = makeChar([makeSkill('s1')], { s1: 0 });
    const dots = getCooldownDotStates(char);
    expect(dots[0].ready).toBe(true);
  });

  it('dot is NOT ready when skill cooldown is greater than 0', () => {
    const char = makeChar([makeSkill('s1')], { s1: 2 });
    const dots = getCooldownDotStates(char);
    expect(dots[0].ready).toBe(false);
  });

  it('each dot includes its skillId for identity', () => {
    const char = makeChar([makeSkill('slash')], {});
    const dots = getCooldownDotStates(char);
    expect(dots[0].skillId).toBe('slash');
  });

  it('mixed ready and on-cooldown states in the same character', () => {
    const char = makeChar([makeSkill('s1'), makeSkill('s2')], { s2: 1 });
    const dots = getCooldownDotStates(char);
    expect(dots[0].ready).toBe(true);  // s1 ready
    expect(dots[1].ready).toBe(false); // s2 on cooldown
  });

  it('each dot includes remainingTurns for the blocked skill', () => {
    const char = makeChar([makeSkill('s1')], { s1: 3 });
    const dots = getCooldownDotStates(char);
    expect(dots[0].remainingTurns).toBe(3);
  });

  it('ready skill has remainingTurns of 0', () => {
    const char = makeChar([makeSkill('s1')], {});
    const dots = getCooldownDotStates(char);
    expect(dots[0].remainingTurns).toBe(0);
  });
});
