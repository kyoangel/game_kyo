import { describe, it, expect } from 'vitest';
import { EQUIPMENT_ITEMS } from '../../src/data/equipmentItems';

describe('EQUIPMENT_ITEMS data', () => {
  it('is a non-empty array', () => {
    expect(EQUIPMENT_ITEMS.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = EQUIPMENT_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item has slot "weapon" or "armor"', () => {
    EQUIPMENT_ITEMS.forEach(item => {
      expect(['weapon', 'armor']).toContain(item.slot);
    });
  });

  it('every item has a positive price', () => {
    EQUIPMENT_ITEMS.forEach(item => {
      expect(item.price).toBeGreaterThan(0);
    });
  });

  it('every item has a non-empty statBonus limited to atk/def/spd', () => {
    EQUIPMENT_ITEMS.forEach(item => {
      const keys = Object.keys(item.statBonus);
      expect(keys.length).toBeGreaterThan(0);
      keys.forEach(k => expect(['atk', 'def', 'spd']).toContain(k));
    });
  });

  it('contains at least one weapon and one armor item', () => {
    expect(EQUIPMENT_ITEMS.some(i => i.slot === 'weapon')).toBe(true);
    expect(EQUIPMENT_ITEMS.some(i => i.slot === 'armor')).toBe(true);
  });

  it('no item grants an hp bonus', () => {
    EQUIPMENT_ITEMS.forEach(item => {
      expect((item.statBonus as Record<string, number | undefined>).hp).toBeUndefined();
    });
  });
});
