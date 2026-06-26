import type { ShopItem } from '../types';

export const EXCLUSIVE_ITEMS: ShopItem[] = [
  {
    id: 'scroll_overdrive',
    type: 'skill_scroll',
    name: '超載卷軸',
    price: 0,
    description: '教導一名角色「超載」（限定）',
    skillId: 'overdrive',
  },
  {
    id: 'supply_nano_kit',
    type: 'supply',
    name: '奈米醫療包',
    price: 0,
    description: '恢復 999 HP（限定）',
    healAmount: 999,
  },
];
