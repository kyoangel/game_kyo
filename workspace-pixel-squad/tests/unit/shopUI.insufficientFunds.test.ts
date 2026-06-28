/**
 * AC-9: Shop — insufficient funds feedback
 * Tapping 購買 without enough currency must:
 *   - NOT complete the purchase (currency unchanged, item not granted)
 *   - Return a 'shake' feedback signal so the UI can animate the price text
 * When the player CAN afford the item the purchase proceeds normally.
 */
import { describe, it, expect } from 'vitest';
import { getShopPurchaseFeedback } from '../../src/ui/shopFeedback';
import type { ShopItem } from '../../src/types';

function makeItem(price: number): ShopItem {
  return { id: 'item_1', name: 'Potion', type: 'supply', price, description: 'Heals 30 HP', healAmount: 30 };
}

describe('getShopPurchaseFeedback', () => {
  it('returns canAfford=false when currency < item price', () => {
    const result = getShopPurchaseFeedback(50, makeItem(100));
    expect(result.canAfford).toBe(false);
  });

  it('returns canAfford=true when currency === item price (exact)', () => {
    const result = getShopPurchaseFeedback(100, makeItem(100));
    expect(result.canAfford).toBe(true);
  });

  it('returns canAfford=true when currency > item price', () => {
    const result = getShopPurchaseFeedback(200, makeItem(100));
    expect(result.canAfford).toBe(true);
  });

  it('returns shake=true when player cannot afford item', () => {
    const result = getShopPurchaseFeedback(10, makeItem(100));
    expect(result.shake).toBe(true);
  });

  it('returns shake=false when player can afford item', () => {
    const result = getShopPurchaseFeedback(100, makeItem(100));
    expect(result.shake).toBe(false);
  });

  it('shake animation uses ±4px horizontal offset', async () => {
    const { SHAKE_AMPLITUDE_PX } = await import('../../src/ui/shopFeedback');
    expect(SHAKE_AMPLITUDE_PX).toBe(4);
  });

  it('shake animation lasts 200ms', async () => {
    const { SHAKE_DURATION_MS } = await import('../../src/ui/shopFeedback');
    expect(SHAKE_DURATION_MS).toBe(200);
  });

  it('price flashes TEXT_RED color during shake', async () => {
    const { SHAKE_FLASH_COLOR } = await import('../../src/ui/shopFeedback');
    expect(SHAKE_FLASH_COLOR).toBe(0xfc8181);
  });
});
