import { describe, it, expect } from 'vitest';
import { addOneToInventory, removeOneFromInventory } from '../../src/battle/InventoryUtils';

// Spec: specs/pixel-squad-skill-tree-respec.md
// New file `battle/InventoryUtils.ts` extracting the generic add/remove-one
// logic previously duplicated in ShopSystem.ts and EquipmentSystem.ts.

interface Entry { itemId: string; quantity: number; }

describe('addOneToInventory', () => {
  it('appends a new entry with quantity 1 for an item not yet present', () => {
    const result = addOneToInventory<Entry>([], 'item_respec_module');
    expect(result).toEqual([{ itemId: 'item_respec_module', quantity: 1 }]);
  });

  it('increments quantity for an item already present', () => {
    const inventory: Entry[] = [{ itemId: 'item_respec_module', quantity: 1 }];
    const result = addOneToInventory(inventory, 'item_respec_module');
    expect(result).toEqual([{ itemId: 'item_respec_module', quantity: 2 }]);
  });

  it('does not mutate the original inventory array', () => {
    const inventory: Entry[] = [{ itemId: 'item_respec_module', quantity: 1 }];
    addOneToInventory(inventory, 'item_respec_module');
    expect(inventory[0].quantity).toBe(1);
  });

  it('keeps separate entries for different item ids', () => {
    const inventory: Entry[] = [{ itemId: 'a', quantity: 1 }];
    const result = addOneToInventory(inventory, 'b');
    expect(result).toEqual([
      { itemId: 'a', quantity: 1 },
      { itemId: 'b', quantity: 1 },
    ]);
  });
});

describe('removeOneFromInventory', () => {
  it('decrements the matching entry quantity by 1', () => {
    const inventory: Entry[] = [{ itemId: 'item_respec_module', quantity: 3 }];
    const result = removeOneFromInventory(inventory, 'item_respec_module');
    expect(result).toEqual([{ itemId: 'item_respec_module', quantity: 2 }]);
  });

  it('removes the entry entirely when quantity reaches 0', () => {
    const inventory: Entry[] = [{ itemId: 'item_respec_module', quantity: 1 }];
    const result = removeOneFromInventory(inventory, 'item_respec_module');
    expect(result).toEqual([]);
  });

  it('is a no-op (returns an equal array) when the item is absent', () => {
    const inventory: Entry[] = [{ itemId: 'other_item', quantity: 2 }];
    const result = removeOneFromInventory(inventory, 'item_respec_module');
    expect(result).toEqual(inventory);
  });

  it('does not mutate the original inventory array', () => {
    const inventory: Entry[] = [{ itemId: 'item_respec_module', quantity: 2 }];
    removeOneFromInventory(inventory, 'item_respec_module');
    expect(inventory[0].quantity).toBe(2);
  });

  it('leaves other entries untouched', () => {
    const inventory: Entry[] = [
      { itemId: 'item_respec_module', quantity: 1 },
      { itemId: 'other_item', quantity: 5 },
    ];
    const result = removeOneFromInventory(inventory, 'item_respec_module');
    expect(result).toEqual([{ itemId: 'other_item', quantity: 5 }]);
  });
});
