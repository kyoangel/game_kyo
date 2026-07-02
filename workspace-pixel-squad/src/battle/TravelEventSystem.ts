import type { ShopItem, InventoryEntry } from '../types';
import { SHOP_ITEMS } from '../data/shopItems';
import { canAfford } from './ShopSystem';
import { addOneToInventory, removeOneFromInventory } from './InventoryUtils';

export const TRAVEL_EVENT_TYPES = ['supply_drop', 'ambush', 'merchant'] as const;
export type TravelEventType = (typeof TRAVEL_EVENT_TYPES)[number];

export type AmbushOutcome = 'win' | 'loss';

export interface Resources {
  currency: number;
  food: number;
  medicine: number;
}

export interface JourneyLogEntry {
  type: TravelEventType;
  description: string;
  seed?: number;
}

const TRAVEL_EVENT_DESCRIPTIONS: Record<TravelEventType, string> = {
  supply_drop: '旅途中遭遇補給空投',
  ambush: '旅途中遭遇伏擊',
  merchant: '旅途中遇到往來商旅',
};

const MERCHANT_INVENTORY_SIZE = 4;

/** Deterministic 32-bit hash of (seed, salt) — pure, no shared state. */
function mixSeed(seed: number, salt: number): number {
  let h = (seed | 0) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

function seededFloat(seed: number, salt: number): number {
  return mixSeed(seed, salt) / 4294967296;
}

function seededInt(seed: number, salt: number, min: number, max: number): number {
  return min + Math.floor(seededFloat(seed, salt) * (max - min + 1));
}

function cloneResources(resources: Resources): Resources {
  return { ...resources };
}

export function selectTravelEvent(seed: number): TravelEventType {
  const roll = seededFloat(seed, 0);
  if (roll < 1 / 3) return 'supply_drop';
  if (roll < 2 / 3) return 'ambush';
  return 'merchant';
}

export function beginTravelPhase(seed: number): { eventType: TravelEventType; log: JourneyLogEntry } {
  const eventType = selectTravelEvent(seed);
  return {
    eventType,
    log: { type: eventType, description: TRAVEL_EVENT_DESCRIPTIONS[eventType], seed },
  };
}

export function resolveSupplyDropEvent(
  resources: Resources,
  seed: number
): { resources: Resources; log: JourneyLogEntry } {
  const foodGain = seededInt(seed, 1, 1, 10);
  const medicineGain = seededInt(seed, 2, 1, 10);
  const currencyBonus = seededInt(seed, 3, 0, 5);

  const updated = cloneResources(resources);
  updated.food += foodGain;
  updated.medicine += medicineGain;
  updated.currency += currencyBonus;

  const bonusText = currencyBonus > 0 ? `、額外獲得 ${currencyBonus} 廢土幣` : '';
  const description = `補給空投：獲得 ${foodGain} 份食物、${medicineGain} 份醫療品${bonusText}`;

  return { resources: updated, log: { type: 'supply_drop', description, seed } };
}

export function getAmbushDifficulty(chapter: number): number {
  return 10 + chapter * 5;
}

function ambushWinChancePercent(chapter: number): number {
  const difficulty = getAmbushDifficulty(chapter);
  return Math.max(10, Math.min(90, 70 - difficulty));
}

export function resolveAmbushEvent(
  resources: Resources,
  chapter: number,
  seed: number,
  retreat: boolean
): { resources: Resources; outcome: AmbushOutcome; log: JourneyLogEntry } {
  const updated = cloneResources(resources);

  if (retreat) {
    const retreatLoss = seededInt(seed, 20, 1, 5);
    updated.currency = Math.max(0, updated.currency - retreatLoss);
    return {
      resources: updated,
      outcome: 'loss',
      log: { type: 'ambush', description: `伏擊事件結果：loss，選擇撤退並損失了 ${retreatLoss} 廢土幣`, seed },
    };
  }

  const combatRoll = seededInt(seed, 10, 0, 99);
  const winChance = ambushWinChancePercent(chapter);
  const outcome: AmbushOutcome = combatRoll < winChance ? 'win' : 'loss';

  if (outcome === 'win') {
    const loot = seededInt(seed, 21, 5, 15);
    updated.currency += loot;
    return {
      resources: updated,
      outcome,
      log: { type: 'ambush', description: `伏擊事件結果：win，擊退敵人並擄獲 ${loot} 廢土幣戰利品`, seed },
    };
  }

  const penalty = seededInt(seed, 22, 5, 15);
  updated.currency = Math.max(0, updated.currency - penalty);
  return {
    resources: updated,
    outcome,
    log: { type: 'ambush', description: `伏擊事件結果：loss，戰敗損失了 ${penalty} 廢土幣`, seed },
  };
}

function seededShuffle<T>(items: readonly T[], seed: number, salt: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = seededInt(seed, salt + i, 0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getMerchantInventory(seed: number): ShopItem[] {
  const shuffled = seededShuffle(SHOP_ITEMS, seed, 100);
  return shuffled.slice(0, Math.min(MERCHANT_INVENTORY_SIZE, SHOP_ITEMS.length));
}

export function resolveMerchantBuy(
  resources: Resources,
  inventory: InventoryEntry[],
  item: ShopItem
): { resources: Resources; inventory: InventoryEntry[]; log: JourneyLogEntry } | null {
  if (!canAfford(resources.currency, item.price)) return null;

  const updatedResources = cloneResources(resources);
  updatedResources.currency -= item.price;
  const updatedInventory = addOneToInventory(inventory, item.id);

  return {
    resources: updatedResources,
    inventory: updatedInventory,
    log: { type: 'merchant', description: `向商旅購買了 ${item.name}` },
  };
}

export function resolveMerchantSell(
  resources: Resources,
  inventory: InventoryEntry[],
  item: ShopItem,
  sellPrice: number
): { resources: Resources; inventory: InventoryEntry[]; log: JourneyLogEntry } | null {
  const owned = inventory.some(e => e.itemId === item.id && e.quantity > 0);
  if (!owned) return null;

  const updatedResources = cloneResources(resources);
  updatedResources.currency += sellPrice;
  const updatedInventory = removeOneFromInventory(inventory, item.id);

  return {
    resources: updatedResources,
    inventory: updatedInventory,
    log: { type: 'merchant', description: `向商旅賣出了 ${item.name}` },
  };
}

export function appendJourneyLog(log: JourneyLogEntry[], entry: JourneyLogEntry): JourneyLogEntry[] {
  return [...log, entry];
}
