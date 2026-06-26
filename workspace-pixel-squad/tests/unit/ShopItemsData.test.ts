import { describe, it, expect } from 'vitest';
import { SHOP_ITEMS } from '../../src/data/shopItems';
import { SKILLS } from '../../src/data/skills';

describe('SHOP_ITEMS', () => {
  it('contains exactly 8 items', () => {
    expect(SHOP_ITEMS).toHaveLength(8);
  });

  it('contains 6 skill_scroll items, one per non-exclusive catalog skill', () => {
    const scrolls = SHOP_ITEMS.filter(i => i.type === 'skill_scroll');
    expect(scrolls).toHaveLength(6);
    const skillIds = scrolls.map(s => s.skillId).sort();
    const purchasableSkillIds = Object.keys(SKILLS).filter(id => id !== 'overdrive').sort();
    expect(skillIds).toEqual(purchasableSkillIds);
  });

  it('contains 2 supply items with healAmount set', () => {
    const supplies = SHOP_ITEMS.filter(i => i.type === 'supply');
    expect(supplies).toHaveLength(2);
    supplies.forEach(s => expect(typeof s.healAmount).toBe('number'));
  });

  it('has unique ids', () => {
    const ids = SHOP_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prices the small medkit at 25 with healAmount 50', () => {
    const item = SHOP_ITEMS.find(i => i.id === 'supply_medkit_s')!;
    expect(item.price).toBe(25);
    expect(item.healAmount).toBe(50);
  });

  it('prices the large medkit at 70 with healAmount 150', () => {
    const item = SHOP_ITEMS.find(i => i.id === 'supply_medkit_l')!;
    expect(item.price).toBe(70);
    expect(item.healAmount).toBe(150);
  });

  it('prices the field_medic scroll at 60', () => {
    const item = SHOP_ITEMS.find(i => i.id === 'scroll_field_medic')!;
    expect(item.price).toBe(60);
    expect(item.skillId).toBe('field_medic');
  });
});
