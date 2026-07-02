import { describe, it, expect } from 'vitest';
import {
  getMerchantInventory,
  resolveMerchantBuy,
  resolveMerchantSell,
  appendJourneyLog,
  type Resources,
} from '../../src/battle/TravelEventSystem';
import { SHOP_ITEMS } from '../../src/data/shopItems';
import { canAfford } from '../../src/battle/ShopSystem';
import type { InventoryEntry } from '../../src/types';

// Spec: specs/pixel-squad-random-travel-events.md
// battle/TravelEventSystem.ts does not exist yet — every import above fails
// to resolve, which is the expected "not implemented" failure mode for this
// suite. Covers Event Type 3 (Merchant Encounter): integration with the
// existing ShopSystem, and the acceptance criterion that transactions
// correctly update `resources` and journey history.

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { currency: 100, food: 10, medicine: 5, ...overrides };
}

describe('getMerchantInventory — presents a limited selection drawn from the existing shop catalog', () => {
  it('returns only items that exist in SHOP_ITEMS', () => {
    const offered = getMerchantInventory(1);
    const validIds = new Set(SHOP_ITEMS.map(i => i.id));
    for (const item of offered) {
      expect(validIds.has(item.id)).toBe(true);
    }
  });

  it('returns a non-empty but limited subset, not the entire catalog', () => {
    const offered = getMerchantInventory(1);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.length).toBeLessThan(SHOP_ITEMS.length);
  });

  it('is deterministic — same seed produces the same selection every call', () => {
    const first = getMerchantInventory(10);
    const second = getMerchantInventory(10);
    expect(second).toEqual(first);
  });

  it('produces different selections for different seeds across a range', () => {
    const selections = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      selections.add(getMerchantInventory(seed).map(i => i.id).join(','));
    }
    expect(selections.size).toBeGreaterThan(1);
  });
});

describe('resolveMerchantBuy — integrates with ShopSystem.canAfford for the purchase gate', () => {
  const item = SHOP_ITEMS.find(i => i.type === 'supply')!;

  it('succeeds and matches canAfford when the player has enough currency', () => {
    const resources = makeResources({ currency: item.price });
    const inventory: InventoryEntry[] = [];
    const result = resolveMerchantBuy(resources, inventory, item);
    expect(canAfford(resources.currency, item.price)).toBe(true);
    expect(result).not.toBeNull();
  });

  it('is rejected (returns null) and matches canAfford when the player cannot afford it', () => {
    const resources = makeResources({ currency: item.price - 1 });
    const inventory: InventoryEntry[] = [];
    const result = resolveMerchantBuy(resources, inventory, item);
    expect(canAfford(resources.currency, item.price)).toBe(false);
    expect(result).toBeNull();
  });

  it('deducts the item price from currency on success', () => {
    const resources = makeResources({ currency: 100 });
    const result = resolveMerchantBuy(resources, [], item)!;
    expect(result.resources.currency).toBe(100 - item.price);
  });

  it('adds the purchased item to the inventory', () => {
    const resources = makeResources({ currency: 100 });
    const result = resolveMerchantBuy(resources, [], item)!;
    expect(result.inventory).toEqual([{ itemId: item.id, quantity: 1 }]);
  });

  it('does not mutate the input resources or inventory', () => {
    const resources = makeResources({ currency: 100 });
    const inventory: InventoryEntry[] = [];
    resolveMerchantBuy(resources, inventory, item);
    expect(resources.currency).toBe(100);
    expect(inventory).toEqual([]);
  });

  it('logs the purchase in the journey history', () => {
    const result = resolveMerchantBuy(makeResources({ currency: 100 }), [], item)!;
    expect(result.log.type).toBe('merchant');
    expect(result.log.description).toContain(item.name);
  });
});

describe('resolveMerchantSell — consumes resources/time and logs the transaction', () => {
  const item = SHOP_ITEMS.find(i => i.type === 'supply')!;
  const sellPrice = Math.floor(item.price / 2);

  it('returns null when the player does not own the item', () => {
    const result = resolveMerchantSell(makeResources(), [], item, sellPrice);
    expect(result).toBeNull();
  });

  it('increases currency by the sell price when the item is owned', () => {
    const resources = makeResources({ currency: 0 });
    const inventory: InventoryEntry[] = [{ itemId: item.id, quantity: 1 }];
    const result = resolveMerchantSell(resources, inventory, item, sellPrice)!;
    expect(result.resources.currency).toBe(sellPrice);
  });

  it('decrements the sold item quantity in inventory', () => {
    const inventory: InventoryEntry[] = [{ itemId: item.id, quantity: 2 }];
    const result = resolveMerchantSell(makeResources(), inventory, item, sellPrice)!;
    expect(result.inventory).toEqual([{ itemId: item.id, quantity: 1 }]);
  });

  it('removes the inventory entry entirely once quantity reaches 0', () => {
    const inventory: InventoryEntry[] = [{ itemId: item.id, quantity: 1 }];
    const result = resolveMerchantSell(makeResources(), inventory, item, sellPrice)!;
    expect(result.inventory).toEqual([]);
  });

  it('does not mutate the input resources or inventory', () => {
    const resources = makeResources({ currency: 0 });
    const inventory: InventoryEntry[] = [{ itemId: item.id, quantity: 1 }];
    resolveMerchantSell(resources, inventory, item, sellPrice);
    expect(resources.currency).toBe(0);
    expect(inventory).toEqual([{ itemId: item.id, quantity: 1 }]);
  });

  it('logs the sale in the journey history', () => {
    const inventory: InventoryEntry[] = [{ itemId: item.id, quantity: 1 }];
    const result = resolveMerchantSell(makeResources(), inventory, item, sellPrice)!;
    expect(result.log.type).toBe('merchant');
    expect(result.log.description).toContain(item.name);
  });
});

describe('appendJourneyLog — accumulates merchant/ambush/supply history without mutation', () => {
  it('appends a new entry to the end, preserving prior entries', () => {
    const existing = [{ type: 'supply_drop' as const, description: 'first', seed: 1 }];
    const entry = { type: 'merchant' as const, description: 'second', seed: 2 };
    expect(appendJourneyLog(existing, entry)).toEqual([...existing, entry]);
  });

  it('does not mutate the original log array', () => {
    const existing = [{ type: 'supply_drop' as const, description: 'first', seed: 1 }];
    const entry = { type: 'merchant' as const, description: 'second', seed: 2 };
    appendJourneyLog(existing, entry);
    expect(existing).toHaveLength(1);
  });
});
