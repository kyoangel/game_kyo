import type { Character, EquipmentInventoryEntry, EquipmentItem, EquipmentSlot } from '../types';
import { EQUIPMENT_ITEMS } from '../data/equipmentItems';

export function findEquipmentById(itemId: string): EquipmentItem | undefined {
  return EQUIPMENT_ITEMS.find(i => i.id === itemId);
}

export function addEquipmentToInventory(inventory: EquipmentInventoryEntry[], itemId: string): EquipmentInventoryEntry[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx >= 0) {
    const updated = [...inventory];
    updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
    return updated;
  }
  return [...inventory, { itemId, quantity: 1 }];
}

function removeOneFromInventory(inventory: EquipmentInventoryEntry[], itemId: string): EquipmentInventoryEntry[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx < 0) return inventory; // defensive no-op, should not happen via UI
  const newQuantity = inventory[idx].quantity - 1;
  if (newQuantity <= 0) return inventory.filter((_, i) => i !== idx);
  const updated = [...inventory];
  updated[idx] = { ...updated[idx], quantity: newQuantity };
  return updated;
}

/** Equips `item` into its slot on `character`, swapping out any previously-equipped item back into inventory. */
export function equipItem(
  character: Character,
  item: EquipmentItem,
  inventory: EquipmentInventoryEntry[]
): { character: Character; inventory: EquipmentInventoryEntry[] } {
  const previous = character.equipment[item.slot];
  let updatedInventory = removeOneFromInventory(inventory, item.id);
  if (previous) updatedInventory = addEquipmentToInventory(updatedInventory, previous.id);
  const character2: Character = { ...character, equipment: { ...character.equipment, [item.slot]: item } };
  return { character: character2, inventory: updatedInventory };
}

/** Unequips whatever is in `slot` on `character`, returning it to inventory. No-op if the slot is already empty. */
export function unequipItem(
  character: Character,
  slot: EquipmentSlot,
  inventory: EquipmentInventoryEntry[]
): { character: Character; inventory: EquipmentInventoryEntry[] } {
  const current = character.equipment[slot];
  if (!current) return { character, inventory };
  const updatedInventory = addEquipmentToInventory(inventory, current.id);
  const character2: Character = { ...character, equipment: { ...character.equipment, [slot]: undefined } };
  return { character: character2, inventory: updatedInventory };
}
