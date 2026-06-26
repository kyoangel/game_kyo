import { describe, it, expect } from 'vitest';
import { EXCLUSIVE_ITEMS } from '../../src/data/exclusiveItems';
import { SHOP_ITEMS } from '../../src/data/shopItems';
import { SKILLS } from '../../src/data/skills';

describe('EXCLUSIVE_ITEMS data', () => {
  it('contains scroll_overdrive teaching the overdrive skill', () => {
    const item = EXCLUSIVE_ITEMS.find(i => i.id === 'scroll_overdrive');
    expect(item).toBeDefined();
    expect(item?.type).toBe('skill_scroll');
    expect(item?.skillId).toBe('overdrive');
  });

  it('contains supply_nano_kit with healAmount 999', () => {
    const item = EXCLUSIVE_ITEMS.find(i => i.id === 'supply_nano_kit');
    expect(item).toBeDefined();
    expect(item?.type).toBe('supply');
    expect(item?.healAmount).toBe(999);
  });

  it('exclusive items never appear in SHOP_ITEMS (not purchasable)', () => {
    const shopIds = new Set(SHOP_ITEMS.map(i => i.id));
    EXCLUSIVE_ITEMS.forEach(item => {
      expect(shopIds.has(item.id), `${item.id} should not be purchasable in SHOP_ITEMS`).toBe(false);
    });
  });

  it('has unique ids', () => {
    const ids = EXCLUSIVE_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('SKILLS.overdrive', () => {
  it('is defined as a self-targeted ATK buff for 2 turns', () => {
    const skill = SKILLS.overdrive;
    expect(skill).toBeDefined();
    expect(skill.type).toBe('buff');
    expect(skill.target).toBe('self');
    expect(skill.buffStat).toBe('atk');
    expect(skill.buffAmountPct).toBe(0.5);
    expect(skill.buffDuration).toBe(2);
  });
});
