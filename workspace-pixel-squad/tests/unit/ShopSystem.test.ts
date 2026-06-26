import { describe, it, expect } from 'vitest';
import {
  MAX_SKILLS_PER_CHARACTER,
  canAfford,
  isEligibleForScroll,
  hasAnyEligibleCharacter,
  teachSkill,
  addToInventory,
  canUseSupply,
  useSupply,
} from '../../src/battle/ShopSystem';
import { SKILLS } from '../../src/data/skills';
import type { Character, InventoryEntry } from '../../src/types';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    templateId: 'rook',
    name: '岩石',
    isProtagonist: false,
    isPlayer: true,
    level: 1,
    exp: 0,
    expToNext: 50,
    stats: { hp: 80, maxHp: 100, atk: 10, def: 5, spd: 8 },
    skills: [],
    statPoints: 0,
    archetype: '坦克',
    alive: true,
    defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

describe('MAX_SKILLS_PER_CHARACTER', () => {
  it('is 3', () => {
    expect(MAX_SKILLS_PER_CHARACTER).toBe(3);
  });
});

describe('canAfford', () => {
  it('returns true when currency is greater than price', () => {
    expect(canAfford(100, 40)).toBe(true);
  });

  it('returns true when currency equals price', () => {
    expect(canAfford(40, 40)).toBe(true);
  });

  it('returns false when currency is less than price', () => {
    expect(canAfford(39, 40)).toBe(false);
  });
});

describe('isEligibleForScroll', () => {
  it('returns true for a character with no skills', () => {
    const char = makeCharacter({ skills: [] });
    expect(isEligibleForScroll(char, 'burst_shot')).toBe(true);
  });

  it('returns false when the character already knows the skill', () => {
    const char = makeCharacter({ skills: [SKILLS.burst_shot] });
    expect(isEligibleForScroll(char, 'burst_shot')).toBe(false);
  });

  it('returns false when the character is at MAX_SKILLS_PER_CHARACTER', () => {
    const char = makeCharacter({
      skills: [SKILLS.burst_shot, SKILLS.shield_bash, SKILLS.swift_strike],
    });
    expect(isEligibleForScroll(char, 'field_medic')).toBe(false);
  });

  it('returns true when below cap and skill not already known', () => {
    const char = makeCharacter({ skills: [SKILLS.burst_shot, SKILLS.shield_bash] });
    expect(isEligibleForScroll(char, 'swift_strike')).toBe(true);
  });
});

describe('hasAnyEligibleCharacter', () => {
  it('returns true when at least one pool member is eligible', () => {
    const pool = [
      makeCharacter({ id: 'a', skills: [SKILLS.burst_shot, SKILLS.shield_bash, SKILLS.swift_strike] }),
      makeCharacter({ id: 'b', skills: [] }),
    ];
    expect(hasAnyEligibleCharacter(pool, 'field_medic')).toBe(true);
  });

  it('returns false when every pool member is at cap', () => {
    const pool = [
      makeCharacter({ id: 'a', skills: [SKILLS.burst_shot, SKILLS.shield_bash, SKILLS.swift_strike] }),
      makeCharacter({ id: 'b', skills: [SKILLS.burst_shot, SKILLS.shield_bash, SKILLS.field_medic] }),
    ];
    expect(hasAnyEligibleCharacter(pool, 'iron_will')).toBe(false);
  });

  it('returns false when every pool member already knows the skill', () => {
    const pool = [
      makeCharacter({ id: 'a', skills: [SKILLS.burst_shot] }),
      makeCharacter({ id: 'b', skills: [SKILLS.burst_shot] }),
    ];
    expect(hasAnyEligibleCharacter(pool, 'burst_shot')).toBe(false);
  });

  it('returns false for an empty pool', () => {
    expect(hasAnyEligibleCharacter([], 'burst_shot')).toBe(false);
  });
});

describe('teachSkill', () => {
  it('appends the looked-up skill object to the character skills array', () => {
    const char = makeCharacter({ skills: [] });
    const updated = teachSkill(char, 'burst_shot');
    expect(updated.skills).toHaveLength(1);
    expect(updated.skills[0]).toEqual(SKILLS.burst_shot);
  });

  it('appends to the end, preserving existing skills and order', () => {
    const char = makeCharacter({ skills: [SKILLS.shield_bash] });
    const updated = teachSkill(char, 'swift_strike');
    expect(updated.skills).toEqual([SKILLS.shield_bash, SKILLS.swift_strike]);
  });

  it('does not mutate the original character', () => {
    const char = makeCharacter({ skills: [] });
    teachSkill(char, 'burst_shot');
    expect(char.skills).toHaveLength(0);
  });
});

describe('addToInventory', () => {
  it('appends a new entry with quantity 1 for an item not yet present', () => {
    const result = addToInventory([], 'supply_medkit_s');
    expect(result).toEqual([{ itemId: 'supply_medkit_s', quantity: 1 }]);
  });

  it('increments quantity for an item already in inventory', () => {
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_s', quantity: 2 }];
    const result = addToInventory(inventory, 'supply_medkit_s');
    expect(result).toEqual([{ itemId: 'supply_medkit_s', quantity: 3 }]);
  });

  it('does not mutate the original inventory array', () => {
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_s', quantity: 1 }];
    addToInventory(inventory, 'supply_medkit_s');
    expect(inventory[0].quantity).toBe(1);
  });

  it('keeps separate entries for different item ids', () => {
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_s', quantity: 1 }];
    const result = addToInventory(inventory, 'supply_medkit_l');
    expect(result).toEqual([
      { itemId: 'supply_medkit_s', quantity: 1 },
      { itemId: 'supply_medkit_l', quantity: 1 },
    ]);
  });
});

describe('canUseSupply', () => {
  it('returns true for an alive character below max HP', () => {
    const char = makeCharacter({ alive: true, stats: { hp: 50, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    expect(canUseSupply(char)).toBe(true);
  });

  it('returns false for a dead character', () => {
    const char = makeCharacter({ alive: false, stats: { hp: 0, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    expect(canUseSupply(char)).toBe(false);
  });

  it('returns false for a character already at max HP', () => {
    const char = makeCharacter({ alive: true, stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    expect(canUseSupply(char)).toBe(false);
  });
});

describe('useSupply', () => {
  it('heals the target by healAmount, clamped to maxHp', () => {
    const target = makeCharacter({ stats: { hp: 80, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_l', quantity: 1 }];
    const result = useSupply(inventory, 'supply_medkit_l', 150, target);
    expect(result.character.stats.hp).toBe(100);
  });

  it('heals by exactly healAmount when result stays under maxHp', () => {
    const target = makeCharacter({ stats: { hp: 30, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_s', quantity: 2 }];
    const result = useSupply(inventory, 'supply_medkit_s', 50, target);
    expect(result.character.stats.hp).toBe(80);
  });

  it('decrements the matching inventory entry quantity by 1', () => {
    const target = makeCharacter({ stats: { hp: 30, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_s', quantity: 2 }];
    const result = useSupply(inventory, 'supply_medkit_s', 50, target);
    expect(result.inventory).toEqual([{ itemId: 'supply_medkit_s', quantity: 1 }]);
  });

  it('removes the entry entirely when quantity reaches 0', () => {
    const target = makeCharacter({ stats: { hp: 30, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_s', quantity: 1 }];
    const result = useSupply(inventory, 'supply_medkit_s', 50, target);
    expect(result.inventory).toEqual([]);
  });

  it('does not mutate the original inventory or target character', () => {
    const target = makeCharacter({ stats: { hp: 30, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    const inventory: InventoryEntry[] = [{ itemId: 'supply_medkit_s', quantity: 2 }];
    useSupply(inventory, 'supply_medkit_s', 50, target);
    expect(inventory[0].quantity).toBe(2);
    expect(target.stats.hp).toBe(30);
  });

  it('leaves other inventory entries untouched', () => {
    const target = makeCharacter({ stats: { hp: 30, maxHp: 100, atk: 10, def: 5, spd: 8 } });
    const inventory: InventoryEntry[] = [
      { itemId: 'supply_medkit_s', quantity: 1 },
      { itemId: 'supply_medkit_l', quantity: 3 },
    ];
    const result = useSupply(inventory, 'supply_medkit_s', 50, target);
    expect(result.inventory).toEqual([{ itemId: 'supply_medkit_l', quantity: 3 }]);
  });
});
