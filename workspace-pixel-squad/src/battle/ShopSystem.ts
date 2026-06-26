import type { Character, InventoryEntry, ShopItem } from '../types';
import { SKILLS } from '../data/skills';
import { SHOP_ITEMS } from '../data/shopItems';
import { EXCLUSIVE_ITEMS } from '../data/exclusiveItems';

export const MAX_SKILLS_PER_CHARACTER = 3;

export function findItemById(itemId: string): ShopItem | undefined {
  return SHOP_ITEMS.find(i => i.id === itemId) ?? EXCLUSIVE_ITEMS.find(i => i.id === itemId);
}

export function canAfford(currency: number, price: number): boolean {
  return currency >= price;
}

export function isEligibleForScroll(character: Character, skillId: string): boolean {
  if (character.skills.length >= MAX_SKILLS_PER_CHARACTER) return false;
  return !character.skills.some(s => s.id === skillId);
}

export function hasAnyEligibleCharacter(pool: Character[], skillId: string): boolean {
  return pool.some(c => isEligibleForScroll(c, skillId));
}

export function teachSkill(character: Character, skillId: string): Character {
  const skill = SKILLS[skillId];
  return { ...character, skills: [...character.skills, skill] };
}

export function addToInventory(inventory: InventoryEntry[], itemId: string): InventoryEntry[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx >= 0) {
    const updated = [...inventory];
    updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
    return updated;
  }
  return [...inventory, { itemId, quantity: 1 }];
}

export function canUseSupply(target: Character): boolean {
  return target.alive && target.stats.hp < target.stats.maxHp;
}

export function useSupply(
  inventory: InventoryEntry[],
  itemId: string,
  healAmount: number,
  target: Character
): { character: Character; inventory: InventoryEntry[] } {
  const character: Character = {
    ...target,
    stats: { ...target.stats, hp: Math.min(target.stats.maxHp, target.stats.hp + healAmount) },
  };

  const idx = inventory.findIndex(e => e.itemId === itemId);
  let updatedInventory: InventoryEntry[];
  if (idx >= 0) {
    const newQuantity = inventory[idx].quantity - 1;
    if (newQuantity <= 0) {
      updatedInventory = inventory.filter((_, i) => i !== idx);
    } else {
      updatedInventory = [...inventory];
      updatedInventory[idx] = { ...updatedInventory[idx], quantity: newQuantity };
    }
  } else {
    updatedInventory = [...inventory];
  }

  return { character, inventory: updatedInventory };
}
