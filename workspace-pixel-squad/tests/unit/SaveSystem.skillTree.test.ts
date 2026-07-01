import { describe, it, expect, beforeEach } from 'vitest';
import { saveSlot, loadSlot } from '../../src/save/SaveSystem';
import { newGame } from '../../src/save/GameState';
import { applyExp } from '../../src/battle/ExpSystem';
import { getSkillTree, unlockNode } from '../../src/battle/SkillTree';
import type { Character, GameState } from '../../src/types';

// Spec: specs/pixel-squad-skill-tree.md, rule 7 / AC-9
//
// Uses the real feature functions (applyExp granting a skillPoint, then
// unlockNode spending it) to build the fixture, rather than hand-authoring
// skillPoints/unlockedSkillNodeIds on a plain object literal — otherwise
// this test would pass trivially today, since saveSlot/loadSlot already
// round-trips arbitrary JSON regardless of whether the feature exists.

type CharacterWithSkillTree = Character & {
  skillPoints?: number;
  unlockedSkillNodeIds?: string[];
};

// Mock localStorage for Node environment, matching SaveSystem.test.ts's setup.
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

describe('AC-9: skillPoints / unlockedSkillNodeIds survive saveSlot -> loadSlot', () => {
  it('round-trips a character with spent skill points and an unlocked node unchanged', () => {
    const initial = newGame(0);
    const protagonist = initial.pool[0] as CharacterWithSkillTree;

    const leveledUp = applyExp(protagonist, 50) as CharacterWithSkillTree; // rule 2: +1 skillPoints
    const tree = getSkillTree(leveledUp.templateId);
    expect(tree, 'protagonist must have a skill tree').toBeDefined();
    const offenseTier1 = tree!.find(n => n.branch === 'offense' && n.tier === 1)!;
    expect(offenseTier1).toBeDefined();

    const unlocked = unlockNode(leveledUp, offenseTier1) as CharacterWithSkillTree;
    expect(unlocked.skillPoints).toBe(0);
    expect(unlocked.unlockedSkillNodeIds).toEqual([offenseTier1.id]);

    const state: GameState = { ...initial, pool: [unlocked], squad: [unlocked] };
    saveSlot(state);
    const loaded = loadSlot(0) as unknown as { squad: CharacterWithSkillTree[] } | null;

    expect(loaded?.squad[0].skillPoints).toBe(0);
    expect(loaded?.squad[0].unlockedSkillNodeIds).toEqual([offenseTier1.id]);
  });
});
