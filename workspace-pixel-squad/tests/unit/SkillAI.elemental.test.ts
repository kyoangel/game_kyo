import { describe, it, expect } from 'vitest';
import * as SkillAIModule from '../../src/battle/SkillAI';
import type { Character, Skill } from '../../src/types';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: {},
    ...overrides,
  } as Character;
}

const iceSkill: Skill = {
  id: 'cryo_round', name: '冰凍彈', type: 'attack', target: 'enemy',
  multiplier: 1.2, description: '',
  ...(({ element: 'ice' }) as any),
} as any;

const physicalSkill: Skill = {
  id: 'swift_strike', name: '迅捷突刺', type: 'attack', target: 'enemy',
  multiplier: 1.3, description: '',
} as Skill;

// AC-10: Auto-battle prefers weakness-matching skill over non-elemental attack

describe('AC-10: AI uses elemental awareness when weaknesses are discovered', () => {
  it('decideActionWithAwareness is exported from SkillAI', () => {
    // New export required for weakness-aware AI
    expect(typeof (SkillAIModule as any).decideActionWithAwareness).toBe('function');
  });

  it('AI always selects the weakness-matching skill when weakness is known', () => {
    const actor = makeChar({
      id: 'hero',
      skills: [iceSkill, physicalSkill],
      skillCooldowns: {},
    });
    // enemy templateId = 'demon', weakness = 'ice' — already discovered
    const enemy = makeChar({ id: 'enemy1', templateId: 'demon', isPlayer: false });
    const discoveredWeaknesses = { demon: 'ice' };

    const decision = (SkillAIModule as any).decideActionWithAwareness(
      actor, [actor], [enemy], discoveredWeaknesses,
    );

    expect(decision.skill?.id).toBe('cryo_round');
    expect(decision.target.id).toBe('enemy1');
  });

  it('AI targets the enemy with the known weakness when multiple enemies present', () => {
    const actor = makeChar({
      id: 'hero',
      skills: [iceSkill, physicalSkill],
      skillCooldowns: {},
    });
    const weakEnemy = makeChar({ id: 'demon1', templateId: 'demon', isPlayer: false });
    const otherEnemy = makeChar({ id: 'wolf1', templateId: 'wolf', isPlayer: false });
    const discoveredWeaknesses = { demon: 'ice' };

    const decision = (SkillAIModule as any).decideActionWithAwareness(
      actor, [actor], [weakEnemy, otherEnemy], discoveredWeaknesses,
    );

    expect(decision.skill?.id).toBe('cryo_round');
    expect(decision.target.id).toBe('demon1');
  });

  it('AI falls back to normal behavior when no weakness is discovered', () => {
    const actor = makeChar({
      id: 'hero',
      skills: [iceSkill, physicalSkill],
      skillCooldowns: {},
    });
    const enemy = makeChar({ id: 'enemy1', templateId: 'unknown_type', isPlayer: false });
    const discoveredWeaknesses: Record<string, string> = {}; // nothing discovered

    const decision = (SkillAIModule as any).decideActionWithAwareness(
      actor, [actor], [enemy], discoveredWeaknesses,
    );

    // Should still pick some valid target
    expect(decision.target).toBeDefined();
    expect(decision.target.id).toBe('enemy1');
  });

  it('AI falls back to normal behavior when discovered weakness does not match any ready skill', () => {
    const actor = makeChar({
      id: 'hero',
      // Only has physical skill, not ice
      skills: [physicalSkill],
      skillCooldowns: {},
    });
    const enemy = makeChar({ id: 'enemy1', templateId: 'demon', isPlayer: false });
    const discoveredWeaknesses = { demon: 'ice' }; // ice discovered but actor has no ice skill

    const decision = (SkillAIModule as any).decideActionWithAwareness(
      actor, [actor], [enemy], discoveredWeaknesses,
    );

    // No ice skill available — should still attack without crashing
    expect(decision.target).toBeDefined();
  });

  it('AI does not use a weakness skill that is on cooldown', () => {
    const actor = makeChar({
      id: 'hero',
      skills: [iceSkill, physicalSkill],
      skillCooldowns: { cryo_round: 2 }, // cryo_round on cooldown
    });
    const enemy = makeChar({ id: 'enemy1', templateId: 'demon', isPlayer: false });
    const discoveredWeaknesses = { demon: 'ice' };

    const decision = (SkillAIModule as any).decideActionWithAwareness(
      actor, [actor], [enemy], discoveredWeaknesses,
    );

    // cryo_round is on cooldown — must not be selected
    expect(decision.skill?.id).not.toBe('cryo_round');
  });
});
