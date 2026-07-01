import { describe, it, expect } from 'vitest';
import { SHOP_ITEMS, RESPEC_ITEM_ID } from '../../src/data/shopItems';
import { canAfford, addToInventory } from '../../src/battle/ShopSystem';
import type { InventoryEntry } from '../../src/types';

// Spec: specs/pixel-squad-skill-tree-respec.md

describe('SHOP_ITEMS respec entry (data)', () => {
  it('contains exactly one entry of type "respec"', () => {
    const respecItems = SHOP_ITEMS.filter(i => i.type === 'respec');
    expect(respecItems).toHaveLength(1);
  });

  it('its id matches the exported RESPEC_ITEM_ID constant', () => {
    const respecItem = SHOP_ITEMS.find(i => i.type === 'respec');
    expect(respecItem?.id).toBe(RESPEC_ITEM_ID);
  });

  it('has a positive price', () => {
    const respecItem = SHOP_ITEMS.find(i => i.type === 'respec');
    expect(respecItem?.price).toBeGreaterThan(0);
  });

  it('RESPEC_ITEM_ID is a non-empty string', () => {
    expect(typeof RESPEC_ITEM_ID).toBe('string');
    expect(RESPEC_ITEM_ID.length).toBeGreaterThan(0);
  });
});

describe('AC-1: buying the respec item follows the same direct-buy path as a supply item', () => {
  it('deducts price from currency and adds 1 to inventory for RESPEC_ITEM_ID', () => {
    const respecItem = SHOP_ITEMS.find(i => i.type === 'respec')!;
    let currency = 100;
    let inventory: InventoryEntry[] = [];

    expect(canAfford(currency, respecItem.price)).toBe(true);
    currency -= respecItem.price;
    inventory = addToInventory(inventory, respecItem.id);

    expect(currency).toBe(100 - respecItem.price);
    expect(inventory).toEqual([{ itemId: RESPEC_ITEM_ID, quantity: 1 }]);
  });

  it('buying it twice increments quantity to 2 instead of duplicating the entry', () => {
    const respecItem = SHOP_ITEMS.find(i => i.type === 'respec')!;
    let inventory: InventoryEntry[] = [];
    inventory = addToInventory(inventory, respecItem.id);
    inventory = addToInventory(inventory, respecItem.id);
    expect(inventory).toEqual([{ itemId: RESPEC_ITEM_ID, quantity: 2 }]);
  });

  it('cannot be bought when currency is insufficient', () => {
    const respecItem = SHOP_ITEMS.find(i => i.type === 'respec')!;
    expect(canAfford(respecItem.price - 1, respecItem.price)).toBe(false);
  });
});
