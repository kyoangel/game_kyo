export interface BaseHubButton {
  key: string;
  label: string;
  color: number;
  targetScene: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const BUTTON_WIDTH = 78;
const BUTTON_HEIGHT = 40;
const BUTTON_Y = 600;
const BUTTON_XS = [47, 133, 219, 305];

export function computeBaseHubButtons(): BaseHubButton[] {
  const defs: Array<Pick<BaseHubButton, 'key' | 'label' | 'color' | 'targetScene'>> = [
    { key: 'shop', label: '商店', color: 0x7c3aed, targetScene: 'ShopScene' },
    { key: 'equipment', label: '裝備', color: 0xb45309, targetScene: 'EquipmentScene' },
    { key: 'skillTree', label: '技能樹', color: 0x0891b2, targetScene: 'SkillTreeScene' },
    { key: 'worldMap', label: '世界地圖', color: 0x1d4ed8, targetScene: 'WorldMapScene' },
  ];
  return defs.map((def, i) => ({
    ...def,
    x: BUTTON_XS[i],
    y: BUTTON_Y,
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
  }));
}
