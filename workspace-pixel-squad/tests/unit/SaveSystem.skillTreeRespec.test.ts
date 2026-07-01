import { describe, it, expect, beforeEach } from 'vitest';
import { saveSlot, loadSlot } from '../../src/save/SaveSystem';
import { newGame } from '../../src/save/GameState';
import { applyExp } from '../../src/battle/ExpSystem';
import { getSkillTree, unlockNode, respecCharacter } from '../../src/battle/SkillTree';
import { RESPEC_ITEM_ID } from '../../src/data/shopItems';
import { addToInventory } from '../../src/battle/ShopSystem';
import type { Character, GameState } from '../../src/types';

// Spec: specs/pixel-squad-skill-tree-respec.md, rule 6 / AC-9
//
// Builds the fixture via real feature functions (applyExp -> unlockNode ->
// respecCharacter) rather than hand-authored object literals, so this test
// cannot pass trivially before the feature exists.

type CharacterWithSkillTree = Character & {
  skillPoints?: number;
  unlockedSkillNodeIds?: string[];
};

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  length: 0,
  key: () => null,
} as unknown as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

describe('AC-9: post-respec skillPoints / unlockedSkillNodeIds / inventory survive saveSlot -> loadSlot', () => {
  it('round-trips a character and inventory unchanged after a respec', () => {
    const initial = newGame(0);
    const protagonist = initial.pool[0] as CharacterWithSkillTree;

    const leveledUp = applyExp(protagonist, 50) as CharacterWithSkillTree; // rule 2 of skill-tree spec: +1 skillPoints
    const tree = getSkillTree(leveledUp.templateId);
    expect(tree, 'protagonist must have a skill tree').toBeDefined();
    const offenseTier1 = tree!.find(n => n.branch === 'offense' && n.tier === 1)!;

    const unlocked = unlockNode(leveledUp, offenseTier1) as CharacterWithSkillTree;
    const inventoryWithItem = addToInventory(initial.inventory, RESPEC_ITEM_ID);

    const respecResult = respecCharacter(unlocked, tree!, inventoryWithItem, RESPEC_ITEM_ID);
    expect(respecResult.character.skillPoints).toBe(1); // refunded the 1 point spent on tier 1
    expect(respecResult.character.unlockedSkillNodeIds).toEqual([]);
    expect(respecResult.inventory.find(e => e.itemId === RESPEC_ITEM_ID)).toBeUndefined();

    const state: GameState = {
      ...initial,
      pool: [respecResult.character],
      squad: [respecResult.character],
      inventory: respecResult.inventory,
    };
    saveSlot(state);
    const loaded = loadSlot(0) as unknown as { squad: CharacterWithSkillTree[]; inventory: { itemId: string; quantity: number }[] } | null;

    expect(loaded?.squad[0].skillPoints).toBe(1);
    expect(loaded?.squad[0].unlockedSkillNodeIds).toEqual([]);
    expect(loaded?.inventory.find(e => e.itemId === RESPEC_ITEM_ID)).toBeUndefined();
  });
});
