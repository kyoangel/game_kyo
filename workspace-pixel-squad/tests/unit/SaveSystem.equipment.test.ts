import { describe, it, expect, beforeEach } from 'vitest';
import { saveSlot, loadSlot } from '../../src/save/SaveSystem';
import { newGame } from '../../src/save/GameState';
import { addEquipmentToInventory, equipItem } from '../../src/battle/EquipmentSystem';
import { EQUIPMENT_ITEMS } from '../../src/data/equipmentItems';

// Mock localStorage for Node environment, matching SaveSystem.test.ts's setup.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  length: 0,
  key: () => null,
} as unknown as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

describe('equipment persistence through saveSlot/loadSlot', () => {
  it('round-trips equipmentInventory and an equipped character unchanged', () => {
    const initial = newGame(0);
    const weapon = EQUIPMENT_ITEMS.find(i => i.slot === 'weapon')!;
    const inventoryWithWeapon = addEquipmentToInventory([], weapon.id);
    const { character, inventory } = equipItem(initial.pool[0], weapon, inventoryWithWeapon);

    const state = {
      ...initial,
      equipmentInventory: inventory,
      pool: [character],
      squad: [character],
    };

    saveSlot(state);
    const loaded = loadSlot(0);

    expect(loaded?.equipmentInventory).toEqual(state.equipmentInventory);
    expect(loaded?.squad[0].equipment.weapon?.id).toBe(weapon.id);
  });
});
