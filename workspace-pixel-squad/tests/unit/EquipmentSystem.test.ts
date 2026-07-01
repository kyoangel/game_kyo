import { describe, it, expect } from 'vitest';
import {
  findEquipmentById,
  addEquipmentToInventory,
  equipItem,
  unequipItem,
} from '../../src/battle/EquipmentSystem';
import { EQUIPMENT_ITEMS } from '../../src/data/equipmentItems';
import type { Character, EquipmentInventoryEntry, EquipmentItem } from '../../src/types';

const weaponPipe: EquipmentItem = {
  id: 'weapon_pipe', slot: 'weapon', name: '鋼管', price: 30, description: 'ATK+6', statBonus: { atk: 6 },
};
const weaponKnife: EquipmentItem = {
  id: 'weapon_combat_knife', slot: 'weapon', name: '戰鬥匕首', price: 45, description: 'ATK+8, SPD+2',
  statBonus: { atk: 8, spd: 2 },
};
const armorVest: EquipmentItem = {
  id: 'armor_scrap_vest', slot: 'armor', name: '廢料背心', price: 30, description: 'DEF+6', statBonus: { def: 6 },
};

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1', templateId: 'rook', name: '岩石', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 80, maxHp: 100, atk: 10, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {},
    equipment: {},
    ...overrides,
  } as Character;
}

describe('findEquipmentById', () => {
  it('finds an item by id', () => {
    expect(findEquipmentById(EQUIPMENT_ITEMS[0].id)).toEqual(EQUIPMENT_ITEMS[0]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findEquipmentById('nonexistent_item')).toBeUndefined();
  });
});

describe('addEquipmentToInventory', () => {
  it('appends a new entry with quantity 1 for an item not yet present', () => {
    const result = addEquipmentToInventory([], 'weapon_pipe');
    expect(result).toEqual([{ itemId: 'weapon_pipe', quantity: 1 }]);
  });

  it('increments quantity for an item already present', () => {
    const inventory: EquipmentInventoryEntry[] = [{ itemId: 'weapon_pipe', quantity: 1 }];
    const result = addEquipmentToInventory(inventory, 'weapon_pipe');
    expect(result).toEqual([{ itemId: 'weapon_pipe', quantity: 2 }]);
  });

  it('does not mutate the original inventory array', () => {
    const inventory: EquipmentInventoryEntry[] = [{ itemId: 'weapon_pipe', quantity: 1 }];
    addEquipmentToInventory(inventory, 'weapon_pipe');
    expect(inventory[0].quantity).toBe(1);
  });

  it('keeps separate entries for different item ids', () => {
    const inventory: EquipmentInventoryEntry[] = [{ itemId: 'weapon_pipe', quantity: 1 }];
    const result = addEquipmentToInventory(inventory, 'armor_scrap_vest');
    expect(result).toEqual([
      { itemId: 'weapon_pipe', quantity: 1 },
      { itemId: 'armor_scrap_vest', quantity: 1 },
    ]);
  });
});

describe('equipItem', () => {
  it('equips into an empty slot and consumes one unit from inventory', () => {
    const character = makeCharacter();
    const inventory: EquipmentInventoryEntry[] = [{ itemId: 'weapon_pipe', quantity: 1 }];
    const result = equipItem(character, weaponPipe, inventory);
    expect(result.character.equipment.weapon?.id).toBe('weapon_pipe');
    expect(result.inventory).toEqual([]);
  });

  it('swaps: returns the previously-equipped item to inventory before consuming the new one', () => {
    const character = makeCharacter({ equipment: { weapon: weaponPipe } });
    const inventory: EquipmentInventoryEntry[] = [{ itemId: 'weapon_combat_knife', quantity: 1 }];
    const result = equipItem(character, weaponKnife, inventory);
    expect(result.character.equipment.weapon?.id).toBe('weapon_combat_knife');
    expect(result.inventory).toEqual([{ itemId: 'weapon_pipe', quantity: 1 }]);
  });

  it('does not mutate the original character or inventory', () => {
    const character = makeCharacter();
    const inventory: EquipmentInventoryEntry[] = [{ itemId: 'weapon_pipe', quantity: 1 }];
    equipItem(character, weaponPipe, inventory);
    expect(character.equipment.weapon).toBeUndefined();
    expect(inventory).toEqual([{ itemId: 'weapon_pipe', quantity: 1 }]);
  });

  it('equipping into the armor slot does not disturb an already-equipped weapon', () => {
    const character = makeCharacter({ equipment: { weapon: weaponPipe } });
    const inventory: EquipmentInventoryEntry[] = [{ itemId: 'armor_scrap_vest', quantity: 1 }];
    const result = equipItem(character, armorVest, inventory);
    expect(result.character.equipment.weapon?.id).toBe('weapon_pipe');
    expect(result.character.equipment.armor?.id).toBe('armor_scrap_vest');
  });
});

describe('unequipItem', () => {
  it('returns the equipped item to inventory and clears the slot', () => {
    const character = makeCharacter({ equipment: { armor: armorVest } });
    const result = unequipItem(character, 'armor', []);
    expect(result.character.equipment.armor).toBeUndefined();
    expect(result.inventory).toEqual([{ itemId: 'armor_scrap_vest', quantity: 1 }]);
  });

  it('is a no-op when the slot is already empty', () => {
    const character = makeCharacter();
    const inventory: EquipmentInventoryEntry[] = [];
    const result = unequipItem(character, 'weapon', inventory);
    expect(result.character).toBe(character);
    expect(result.inventory).toBe(inventory);
  });

  it('does not mutate the original character', () => {
    const character = makeCharacter({ equipment: { armor: armorVest } });
    unequipItem(character, 'armor', []);
    expect(character.equipment.armor).toEqual(armorVest);
  });
});

describe('buying equipment (shared inventory logic backing the shop UI)', () => {
  it('buying an item the party does not own yet adds one entry at quantity 1 and deducts price from currency', () => {
    let equipmentInventory: EquipmentInventoryEntry[] = [];
    let currency = 100;
    const item = EQUIPMENT_ITEMS[0];
    currency -= item.price;
    equipmentInventory = addEquipmentToInventory(equipmentInventory, item.id);
    expect(currency).toBe(100 - item.price);
    expect(equipmentInventory).toEqual([{ itemId: item.id, quantity: 1 }]);
  });

  it('buying the same item twice increments quantity to 2 instead of duplicating the entry', () => {
    let equipmentInventory: EquipmentInventoryEntry[] = [{ itemId: EQUIPMENT_ITEMS[0].id, quantity: 1 }];
    equipmentInventory = addEquipmentToInventory(equipmentInventory, EQUIPMENT_ITEMS[0].id);
    expect(equipmentInventory).toEqual([{ itemId: EQUIPMENT_ITEMS[0].id, quantity: 2 }]);
  });
});
