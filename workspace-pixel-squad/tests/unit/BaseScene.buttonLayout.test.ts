import { describe, it, expect } from 'vitest';
import { computeBaseHubButtons } from '../../src/scenes/BaseButtonLayout';

// Spec: specs/pixel-squad-skill-tree.md — "UI changes / scenes/BaseScene.ts — renderBaseMode"
//
// BaseScene extends Phaser.Scene and can't be instantiated in this project's
// Node vitest environment, so the button reflow is verified through a pure
// helper (per the spec's own test-plan guidance) instead of exercising the
// scene at runtime or matching against BaseScene.ts source text.

describe('computeBaseHubButtons — base hub bottom row reflow for the new skill-tree button', () => {
  it('returns exactly 4 buttons, in order: shop, equipment, skillTree, worldMap', () => {
    expect(computeBaseHubButtons().map(b => b.key)).toEqual(['shop', 'equipment', 'skillTree', 'worldMap']);
  });

  it('every button is 78px wide, sits at y=600, height unchanged at 40', () => {
    computeBaseHubButtons().forEach(b => {
      expect(b.width).toBe(78);
      expect(b.y).toBe(600);
      expect(b.height).toBe(40);
    });
  });

  it('x positions are 47 / 133 / 219 / 305 in button order', () => {
    expect(computeBaseHubButtons().map(b => b.x)).toEqual([47, 133, 219, 305]);
  });

  it('shop button: purple 0x7c3aed, label 商店, targets ShopScene', () => {
    const b = computeBaseHubButtons().find(b => b.key === 'shop')!;
    expect(b.color).toBe(0x7c3aed);
    expect(b.label).toBe('商店');
    expect(b.targetScene).toBe('ShopScene');
  });

  it('equipment button: orange 0xb45309, label 裝備, targets EquipmentScene', () => {
    const b = computeBaseHubButtons().find(b => b.key === 'equipment')!;
    expect(b.color).toBe(0xb45309);
    expect(b.label).toBe('裝備');
    expect(b.targetScene).toBe('EquipmentScene');
  });

  it('skillTree button: new teal 0x0891b2, label 技能樹, targets SkillTreeScene', () => {
    const b = computeBaseHubButtons().find(b => b.key === 'skillTree')!;
    expect(b.color).toBe(0x0891b2);
    expect(b.label).toBe('技能樹');
    expect(b.targetScene).toBe('SkillTreeScene');
  });

  it('worldMap button: blue 0x1d4ed8, label 世界地圖, targets WorldMapScene', () => {
    const b = computeBaseHubButtons().find(b => b.key === 'worldMap')!;
    expect(b.color).toBe(0x1d4ed8);
    expect(b.label).toBe('世界地圖');
    expect(b.targetScene).toBe('WorldMapScene');
  });
});
