import type { Character, Skill, SkillTreeNode } from '../types';
import { PLAYER_TEMPLATES } from '../data/characters';
import { SKILLS } from '../data/skills';
import { MAX_SKILLS_PER_CHARACTER } from './ShopSystem';

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
