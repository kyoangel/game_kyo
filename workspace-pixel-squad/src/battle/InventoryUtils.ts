export interface QuantityEntry { itemId: string; quantity: number; }

export function addOneToInventory<T extends QuantityEntry>(inventory: T[], itemId: string): T[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx >= 0) {
    const updated = [...inventory];
    updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
    return updated;
  }
  return [...inventory, { itemId, quantity: 1 } as T];
}

export function removeOneFromInventory<T extends QuantityEntry>(inventory: T[], itemId: string): T[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx < 0) return inventory; // defensive no-op, should not happen via UI
  const newQuantity = inventory[idx].quantity - 1;
  if (newQuantity <= 0) return inventory.filter((_, i) => i !== idx);
  const updated = [...inventory];
  updated[idx] = { ...updated[idx], quantity: newQuantity };
  return updated;
}
