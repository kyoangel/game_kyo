import type { Character, InventoryEntry, Skill, SkillTreeNode } from '../types';
import { PLAYER_TEMPLATES } from '../data/characters';
import { SKILLS } from '../data/skills';
import { MAX_SKILLS_PER_CHARACTER } from './ShopSystem';
import { removeOneFromInventory } from './InventoryUtils';

export function getSkillTree(templateId: string): SkillTreeNode[] | undefined {
  return PLAYER_TEMPLATES.find(t => t.id === templateId)?.skillTree;
}

export function isNodeUnlocked(character: Character, nodeId: string): boolean {
  return (character.unlockedSkillNodeIds ?? []).includes(nodeId);
}

function tierOnePrereqMet(character: Character, node: SkillTreeNode, tree: SkillTreeNode[]): boolean {
  if (node.tier === 1) return true;
  const tierOne = tree.find(n => n.branch === node.branch && n.tier === 1);
  return !!tierOne && isNodeUnlocked(character, tierOne.id);
}

export function canUnlockNode(character: Character, node: SkillTreeNode, tree: SkillTreeNode[]): boolean {
  if (isNodeUnlocked(character, node.id)) return false;
  if (!tierOnePrereqMet(character, node, tree)) return false;
  if ((character.skillPoints ?? 0) < node.cost) return false;
  const alreadyKnown = character.skills.some(s => s.id === node.skillId);
  if (!alreadyKnown && character.skills.length >= MAX_SKILLS_PER_CHARACTER) return false;
  return true;
}

export function unlockNode(character: Character, node: SkillTreeNode): Character {
  const skill: Skill = SKILLS[node.skillId];
  const alreadyKnown = character.skills.some(s => s.id === node.skillId);
  return {
    ...character,
    skillPoints: (character.skillPoints ?? 0) - node.cost,
    unlockedSkillNodeIds: [...(character.unlockedSkillNodeIds ?? []), node.id],
    skills: alreadyKnown ? character.skills : [...character.skills, skill],
  };
}

export function calculateRespecRefund(character: Character, tree: SkillTreeNode[]): number {
  const unlockedIds = character.unlockedSkillNodeIds ?? [];
  return tree
    .filter(n => unlockedIds.includes(n.id))
    .reduce((sum, n) => sum + n.cost, 0);
}

export function resetSkillTree(character: Character, tree: SkillTreeNode[]): Character {
  const refund = calculateRespecRefund(character, tree);
  return {
    ...character,
    skillPoints: (character.skillPoints ?? 0) + refund,
    unlockedSkillNodeIds: [],
  };
}

export function canRespec(character: Character, inventory: InventoryEntry[], itemId: string): boolean {
  const hasUnlocked = (character.unlockedSkillNodeIds ?? []).length > 0;
  const owned = inventory.find(e => e.itemId === itemId)?.quantity ?? 0;
  return hasUnlocked && owned > 0;
}

export function respecCharacter(
  character: Character,
  tree: SkillTreeNode[],
  inventory: InventoryEntry[],
  itemId: string
): { character: Character; inventory: InventoryEntry[] } {
  return {
    character: resetSkillTree(character, tree),
    inventory: removeOneFromInventory(inventory, itemId),
  };
}
