import { describe, it, expect } from 'vitest';
import {
  calculateRespecRefund,
  resetSkillTree,
  canRespec,
  respecCharacter,
} from '../../src/battle/SkillTree';
import { SKILLS } from '../../src/data/skills';
import type { Character, InventoryEntry, SkillTreeNode } from '../../src/types';

// Spec: specs/pixel-squad-skill-tree-respec.md

const RESPEC_ITEM_ID = 'item_respec_module';

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

// Same fixture tree used in SkillTree.test.ts (skill-tree spec), reused here
// since calculateRespecRefund/resetSkillTree/respecCharacter all take the
// tree as a parameter rather than depending on data/characters.ts wiring.
const REX_TREE: SkillTreeNode[] = [
  { id: 'rex_offense_1', branch: 'offense', tier: 1, skillId: 'burst_shot', cost: 1 },
  { id: 'rex_offense_2', branch: 'offense', tier: 2, skillId: 'fire_grenade', cost: 2 },
  { id: 'rex_control_1', branch: 'control', tier: 1, skillId: 'acid_splash', cost: 1 },
  { id: 'rex_control_2', branch: 'control', tier: 2, skillId: 'toxic_spray', cost: 2 },
  { id: 'rex_support_1', branch: 'support', tier: 1, skillId: 'iron_will', cost: 1 },
  { id: 'rex_support_2', branch: 'support', tier: 2, skillId: 'overdrive', cost: 2 },
];

describe('calculateRespecRefund', () => {
  it('AC-2: sums the cost of every currently-unlocked node (1 + 1 = 2)', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: ['rex_offense_1', 'rex_control_1'] });
    expect(calculateRespecRefund(char, REX_TREE)).toBe(2);
  });

  it('returns 0 when nothing is unlocked', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: [] });
    expect(calculateRespecRefund(char, REX_TREE)).toBe(0);
  });

  it('defaults to 0 refund when unlockedSkillNodeIds is undefined (pre-feature save)', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: undefined });
    expect(calculateRespecRefund(char, REX_TREE)).toBe(0);
  });

  it('includes tier-2 node cost (2) alongside a tier-1 node (1) for a total of 3', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: ['rex_offense_1', 'rex_offense_2'] });
    expect(calculateRespecRefund(char, REX_TREE)).toBe(3);
  });
});

describe('resetSkillTree', () => {
  it('AC-3: refunds spent points and clears unlockedSkillNodeIds', () => {
    const char = makeCharacter({ skillPoints: 0, unlockedSkillNodeIds: ['rex_offense_1', 'rex_control_1'] });
    const updated = resetSkillTree(char, REX_TREE);
    expect(updated.skillPoints).toBe(2);
    expect(updated.unlockedSkillNodeIds).toEqual([]);
  });

  it('AC-3 / AC-7: leaves character.skills completely unchanged (same ids, same length)', () => {
    const char = makeCharacter({
      skillPoints: 0,
      unlockedSkillNodeIds: ['rex_offense_1', 'rex_control_1'],
      skills: [SKILLS.burst_shot, SKILLS.acid_splash],
    });
    const updated = resetSkillTree(char, REX_TREE);
    expect(updated.skills).toHaveLength(2);
    expect(updated.skills.map(s => s.id)).toEqual(['burst_shot', 'acid_splash']);
  });

  it('AC-7: a skill mapped to a currently-unlocked node stays present after reset', () => {
    const char = makeCharacter({
      skillPoints: 0,
      unlockedSkillNodeIds: ['rex_offense_1'],
      skills: [SKILLS.burst_shot],
    });
    const updated = resetSkillTree(char, REX_TREE);
    expect(updated.skills.some(s => s.id === 'burst_shot')).toBe(true);
  });

  it('does not mutate the original character (immutable update)', () => {
    const char = makeCharacter({ skillPoints: 0, unlockedSkillNodeIds: ['rex_offense_1'] });
    resetSkillTree(char, REX_TREE);
    expect(char.skillPoints).toBe(0);
    expect(char.unlockedSkillNodeIds).toEqual(['rex_offense_1']);
  });

  it('adds refund on top of any pre-existing unspent skillPoints', () => {
    const char = makeCharacter({ skillPoints: 4, unlockedSkillNodeIds: ['rex_support_1'] });
    const updated = resetSkillTree(char, REX_TREE);
    expect(updated.skillPoints).toBe(5);
  });
});

describe('canRespec', () => {
  it('AC-6: returns false when there are no unlocked nodes, even with the item owned', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: [] });
    const inventory: InventoryEntry[] = [{ itemId: RESPEC_ITEM_ID, quantity: 1 }];
    expect(canRespec(char, inventory, RESPEC_ITEM_ID)).toBe(false);
  });

  it('AC-6: returns false when nodes are unlocked but the item is not owned', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: ['rex_offense_1'] });
    expect(canRespec(char, [], RESPEC_ITEM_ID)).toBe(false);
  });

  it('AC-6: returns true when both conditions hold', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: ['rex_offense_1'] });
    const inventory: InventoryEntry[] = [{ itemId: RESPEC_ITEM_ID, quantity: 1 }];
    expect(canRespec(char, inventory, RESPEC_ITEM_ID)).toBe(true);
  });

  it('returns false when inventory has a 0-quantity entry for the item', () => {
    const char = makeCharacter({ unlockedSkillNodeIds: ['rex_offense_1'] });
    const inventory: InventoryEntry[] = [{ itemId: RESPEC_ITEM_ID, quantity: 0 }];
    expect(canRespec(char, inventory, RESPEC_ITEM_ID)).toBe(false);
  });
});

describe('respecCharacter', () => {
  it('AC-4: consumes the last respec item from inventory (removed entirely) and matches resetSkillTree output', () => {
    const char = makeCharacter({ skillPoints: 0, unlockedSkillNodeIds: ['rex_offense_1', 'rex_control_1'] });
    const inventory: InventoryEntry[] = [{ itemId: RESPEC_ITEM_ID, quantity: 1 }];
    const result = respecCharacter(char, REX_TREE, inventory, RESPEC_ITEM_ID);

    expect(result.inventory.find(e => e.itemId === RESPEC_ITEM_ID)).toBeUndefined();
    expect(result.character).toEqual(resetSkillTree(char, REX_TREE));
  });

  it('AC-5: decrements quantity without removing the entry when more than 1 is owned', () => {
    const char = makeCharacter({ skillPoints: 0, unlockedSkillNodeIds: ['rex_offense_1'] });
    const inventory: InventoryEntry[] = [{ itemId: RESPEC_ITEM_ID, quantity: 3 }];
    const result = respecCharacter(char, REX_TREE, inventory, RESPEC_ITEM_ID);

    expect(result.inventory).toEqual([{ itemId: RESPEC_ITEM_ID, quantity: 2 }]);
  });

  it('the cost is flat per reset action regardless of how many nodes were unlocked', () => {
    const char = makeCharacter({ skillPoints: 0, unlockedSkillNodeIds: ['rex_offense_1', 'rex_control_1', 'rex_support_1'] });
    const inventory: InventoryEntry[] = [{ itemId: RESPEC_ITEM_ID, quantity: 5 }];
    const result = respecCharacter(char, REX_TREE, inventory, RESPEC_ITEM_ID);

    expect(result.inventory).toEqual([{ itemId: RESPEC_ITEM_ID, quantity: 4 }]);
  });

  it('does not mutate the original character or inventory', () => {
    const char = makeCharacter({ skillPoints: 0, unlockedSkillNodeIds: ['rex_offense_1'] });
    const inventory: InventoryEntry[] = [{ itemId: RESPEC_ITEM_ID, quantity: 2 }];
    respecCharacter(char, REX_TREE, inventory, RESPEC_ITEM_ID);
    expect(char.unlockedSkillNodeIds).toEqual(['rex_offense_1']);
    expect(inventory).toEqual([{ itemId: RESPEC_ITEM_ID, quantity: 2 }]);
  });
});
