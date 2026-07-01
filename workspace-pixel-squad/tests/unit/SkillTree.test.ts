import { describe, it, expect } from 'vitest';
import { getSkillTree, isNodeUnlocked, canUnlockNode, unlockNode } from '../../src/battle/SkillTree';
import { SKILLS } from '../../src/data/skills';
import { MAX_SKILLS_PER_CHARACTER } from '../../src/battle/ShopSystem';
import type { Character, SkillTreeNode } from '../../src/types';

// Spec: specs/pixel-squad-skill-tree.md

type CharacterWithSkillTree = Character & {
  skillPoints?: number;
  unlockedSkillNodeIds?: string[];
};

function makeCharacter(overrides: Partial<CharacterWithSkillTree> = {}): CharacterWithSkillTree {
  return {
    id: 'c1',
    templateId: 'rex',
    name: 'Rex',
    isProtagonist: false,
    isPlayer: true,
    level: 5,
    exp: 0,
    expToNext: 250,
    stats: { hp: 150, maxHp: 150, atk: 30, def: 25, spd: 8 },
    skills: [],
    statPoints: 0,
    archetype: '坦克',
    alive: true,
    defending: false,
    activeBuffs: [],
    activeStatusEffects: [],
    skillCooldowns: {},
    equipment: {},
    skillPoints: 0,
    unlockedSkillNodeIds: [],
    ...overrides,
  };
}

// The exact node array given in the spec for `rex`, used as fixture input to
// canUnlockNode/unlockNode (those two take the tree as a parameter, so they
// don't depend on data/characters.ts being wired up yet).
const REX_TREE: SkillTreeNode[] = [
  { id: 'rex_offense_1', branch: 'offense', tier: 1, skillId: 'burst_shot', cost: 1 },
  { id: 'rex_offense_2', branch: 'offense', tier: 2, skillId: 'fire_grenade', cost: 2 },
  { id: 'rex_control_1', branch: 'control', tier: 1, skillId: 'acid_splash', cost: 1 },
  { id: 'rex_control_2', branch: 'control', tier: 2, skillId: 'toxic_spray', cost: 2 },
  { id: 'rex_support_1', branch: 'support', tier: 1, skillId: 'iron_will', cost: 1 },
  { id: 'rex_support_2', branch: 'support', tier: 2, skillId: 'overdrive', cost: 2 },
];

describe('getSkillTree', () => {
  it('returns the 6-node tree for a known PLAYER_TEMPLATES id (rex)', () => {
    const tree = getSkillTree('rex');
    expect(tree).toEqual(REX_TREE);
  });

  it('AC-8 (data side): returns undefined for a templateId with no matching PLAYER_TEMPLATES entry (e.g. enemy-origin recruit)', () => {
    expect(getSkillTree('some_enemy_template_id_not_in_player_templates')).toBeUndefined();
  });
});

describe('isNodeUnlocked', () => {
  it('returns false when unlockedSkillNodeIds is empty', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: [] });
    expect(isNodeUnlocked(char, 'rex_offense_1')).toBe(false);
  });

  it('returns true when the node id is present', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: ['rex_offense_1'] });
    expect(isNodeUnlocked(char, 'rex_offense_1')).toBe(true);
  });

  it('rule 7: defaults to false when unlockedSkillNodeIds is undefined (pre-feature save)', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: undefined });
    expect(isNodeUnlocked(char, 'rex_offense_1')).toBe(false);
  });
});

describe('canUnlockNode', () => {
  it('AC-3: returns true for a tier-1 node when the character has enough points and no unlocked nodes', () => {
    const char = makeCharacter({ skillPoints: 1, unlockedSkillNodeIds: [] });
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(true);
  });

  it('AC-4: returns false for a tier-1 node when skillPoints is 0', () => {
    const char = makeCharacter({ skillPoints: 0, unlockedSkillNodeIds: [] });
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(false);
  });

  it('rule 7: returns false for a tier-1 node when skillPoints is undefined (pre-feature save defaults to 0)', () => {
    const char = makeCharacter({ skillPoints: undefined, unlockedSkillNodeIds: [] });
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(false);
  });

  it('AC-5: returns false for a tier-2 node when tier-1 of the same branch is not unlocked, even with enough points', () => {
    const char = makeCharacter({ skillPoints: 5, unlockedSkillNodeIds: [] });
    expect(canUnlockNode(char, REX_TREE[1], REX_TREE)).toBe(false);
  });

  it('AC-5: returns true for a tier-2 node once tier-1 of the same branch is unlocked', () => {
    const char = makeCharacter({ skillPoints: 5, unlockedSkillNodeIds: ['rex_offense_1'] });
    expect(canUnlockNode(char, REX_TREE[1], REX_TREE)).toBe(true);
  });

  it('rule 1: tier-1 unlocked in a different branch does not satisfy a tier-2 prerequisite', () => {
    const char = makeCharacter({ skillPoints: 5, unlockedSkillNodeIds: ['rex_control_1'] });
    expect(canUnlockNode(char, REX_TREE[1], REX_TREE)).toBe(false);
  });

  it('rule 1: branches are independent — all three tier-1 nodes are unlockable with no tier-1 prerequisites', () => {
    const char = makeCharacter({ skillPoints: 5, unlockedSkillNodeIds: [] });
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(true); // offense t1
    expect(canUnlockNode(char, REX_TREE[2], REX_TREE)).toBe(true); // control t1
    expect(canUnlockNode(char, REX_TREE[4], REX_TREE)).toBe(true); // support t1
  });

  it('AC-6: returns true when the node skill is already known and points suffice (no cap exemption needed)', () => {
    const char = makeCharacter({
      skillPoints: 1,
      unlockedSkillNodeIds: [],
      skills: [SKILLS.burst_shot],
    });
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(true);
  });

  it('AC-7: returns false when skills are at MAX_SKILLS_PER_CHARACTER and the node skill is not yet known', () => {
    const char = makeCharacter({
      skillPoints: 5,
      unlockedSkillNodeIds: [],
      skills: [SKILLS.shield_bash, SKILLS.swift_strike, SKILLS.cryo_round, SKILLS.field_medic],
    });
    expect(char.skills.length).toBe(MAX_SKILLS_PER_CHARACTER);
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(false);
  });

  it('rule 4/5: still returns true at the skill cap when the node skill is already known (cap check is skipped)', () => {
    const char = makeCharacter({
      skillPoints: 5,
      unlockedSkillNodeIds: [],
      skills: [SKILLS.burst_shot, SKILLS.shield_bash, SKILLS.swift_strike, SKILLS.cryo_round],
    });
    expect(char.skills.length).toBe(MAX_SKILLS_PER_CHARACTER);
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(true);
  });

  it('returns false for a node that is already unlocked', () => {
    const char = makeCharacter({ skillPoints: 5, unlockedSkillNodeIds: ['rex_offense_1'] });
    expect(canUnlockNode(char, REX_TREE[0], REX_TREE)).toBe(false);
  });
});

describe('unlockNode', () => {
  it('AC-3: spends node.cost points, records the node id, and appends the corresponding Skill object', () => {
    const char = makeCharacter({ skillPoints: 1, unlockedSkillNodeIds: [], skills: [] });
    const updated = unlockNode(char, REX_TREE[0]);
    expect(updated.skillPoints).toBe(0);
    expect(updated.unlockedSkillNodeIds).toContain('rex_offense_1');
    expect(updated.skills).toContainEqual(SKILLS.burst_shot);
  });

  it('rule 1: spends 2 points for a tier-2 node and preserves prior unlocked node ids', () => {
    const char = makeCharacter({
      skillPoints: 5,
      unlockedSkillNodeIds: ['rex_offense_1'],
      skills: [SKILLS.burst_shot],
    });
    const updated = unlockNode(char, REX_TREE[1]);
    expect(updated.skillPoints).toBe(3);
    expect(updated.unlockedSkillNodeIds).toEqual(['rex_offense_1', 'rex_offense_2']);
    expect(updated.skills).toContainEqual(SKILLS.fire_grenade);
  });

  it('AC-6: unlocking a node whose skill is already known records the node id and spends points without duplicating the skill', () => {
    const char = makeCharacter({
      skillPoints: 1,
      unlockedSkillNodeIds: [],
      skills: [SKILLS.burst_shot],
    });
    const updated = unlockNode(char, REX_TREE[0]);
    expect(updated.skillPoints).toBe(0);
    expect(updated.unlockedSkillNodeIds).toContain('rex_offense_1');
    expect(updated.skills.filter(s => s.id === 'burst_shot')).toHaveLength(1);
  });

  it('does not mutate the original character (immutable update)', () => {
    const char = makeCharacter({ skillPoints: 1, unlockedSkillNodeIds: [], skills: [] });
    unlockNode(char, REX_TREE[0]);
    expect(char.skillPoints).toBe(1);
    expect(char.unlockedSkillNodeIds).toEqual([]);
    expect(char.skills).toEqual([]);
  });
});
