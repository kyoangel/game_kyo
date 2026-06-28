import { Colors } from './theme';
import type { ShopItem } from '../types';

export const SHAKE_AMPLITUDE_PX = 4;
export const SHAKE_DURATION_MS = 200;
export const SHAKE_FLASH_COLOR = Colors.TEXT_RED;

export interface ShopPurchaseFeedback {
  canAfford: boolean;
  shake: boolean;
}

export function getShopPurchaseFeedback(currency: number, item: ShopItem): ShopPurchaseFeedback {
  const canAfford = currency >= item.price;
  return { canAfford, shake: !canAfford };
}
