import type { ShopItem } from '../types';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'scroll_burst_shot', type: 'skill_scroll', name: '爆發射擊卷軸', price: 40, description: '教導一名角色「爆發射擊」', skillId: 'burst_shot' },
  { id: 'scroll_shield_bash', type: 'skill_scroll', name: '盾擊卷軸', price: 35, description: '教導一名角色「盾擊」', skillId: 'shield_bash' },
  { id: 'scroll_swift_strike', type: 'skill_scroll', name: '迅捷突刺卷軸', price: 38, description: '教導一名角色「迅捷突刺」', skillId: 'swift_strike' },
  { id: 'scroll_field_medic', type: 'skill_scroll', name: '戰地醫療卷軸', price: 60, description: '教導一名角色「戰地醫療」', skillId: 'field_medic' },
  { id: 'scroll_combat_stim', type: 'skill_scroll', name: '戰鬥興奮劑卷軸', price: 55, description: '教導一名角色「戰鬥興奮劑」', skillId: 'combat_stim' },
  { id: 'scroll_iron_will', type: 'skill_scroll', name: '鋼鐵意志卷軸', price: 55, description: '教導一名角色「鋼鐵意志」', skillId: 'iron_will' },
  { id: 'supply_medkit_s', type: 'supply', name: '小型醫療包', price: 25, description: '恢復 50 HP', healAmount: 50 },
  { id: 'supply_medkit_l', type: 'supply', name: '大型醫療包', price: 70, description: '恢復 150 HP', healAmount: 150 },
];
