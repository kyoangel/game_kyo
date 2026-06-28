import { describe, it, expect } from 'vitest';
import { SHOP_ITEMS } from '../../src/data/shopItems';

// AC-8: New elemental skill scrolls are purchasable in the shop

describe('AC-8: shop contains scrolls for all four new elemental skills', () => {
  it('shop has a scroll for cryo_round (冰凍彈)', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'cryo_round');
    expect(scroll).toBeDefined();
  });

  it('cryo_round scroll costs 45', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'cryo_round');
    expect(scroll?.price).toBe(45);
  });

  it('cryo_round scroll is type skill_scroll', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'cryo_round');
    expect(scroll?.type).toBe('skill_scroll');
  });

  it('shop has a scroll for acid_splash (酸液噴灑)', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'acid_splash');
    expect(scroll).toBeDefined();
  });

  it('acid_splash scroll costs 40', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'acid_splash');
    expect(scroll?.price).toBe(40);
  });

  it('shop has a scroll for fire_grenade (燃燒手榴彈)', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'fire_grenade');
    expect(scroll).toBeDefined();
  });

  it('fire_grenade scroll costs 55', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'fire_grenade');
    expect(scroll?.price).toBe(55);
  });

  it('shop has a scroll for emp_pulse (電磁衝擊)', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'emp_pulse');
    expect(scroll).toBeDefined();
  });

  it('emp_pulse scroll costs 50', () => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === 'emp_pulse');
    expect(scroll?.price).toBe(50);
  });

  it('at least two of the four new elemental skills are purchasable (AC-8 minimum)', () => {
    const newSkillIds = ['cryo_round', 'acid_splash', 'fire_grenade', 'emp_pulse'];
    const available = SHOP_ITEMS.filter(i => newSkillIds.includes(i.skillId ?? ''));
    expect(available.length).toBeGreaterThanOrEqual(2);
  });
});

describe('AC-8: new elemental scrolls have non-empty names and descriptions', () => {
  const NEW_SKILL_IDS = ['cryo_round', 'acid_splash', 'fire_grenade', 'emp_pulse'];

  it.each(NEW_SKILL_IDS)('%s scroll has a non-empty name', (skillId) => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === skillId);
    // Scroll won't exist yet → undefined → fails descriptively
    expect(scroll?.name).toBeTruthy();
  });

  it.each(NEW_SKILL_IDS)('%s scroll has a non-empty description', (skillId) => {
    const scroll = SHOP_ITEMS.find(i => i.skillId === skillId);
    expect(scroll?.description).toBeTruthy();
  });
});
