import { describe, it, expect } from 'vitest';
import { findItemById } from '../../src/battle/ShopSystem';
import { SHOP_ITEMS } from '../../src/data/shopItems';
import { EXCLUSIVE_ITEMS } from '../../src/data/exclusiveItems';

describe('findItemById', () => {
  it('resolves an item from SHOP_ITEMS', () => {
    const item = findItemById('supply_medkit_s');
    expect(item).toEqual(SHOP_ITEMS.find(i => i.id === 'supply_medkit_s'));
  });

  it('resolves an item from EXCLUSIVE_ITEMS', () => {
    const item = findItemById('scroll_overdrive');
    expect(item).toEqual(EXCLUSIVE_ITEMS.find(i => i.id === 'scroll_overdrive'));
  });

  it('returns undefined for an unknown itemId', () => {
    expect(findItemById('does_not_exist')).toBeUndefined();
  });
});
