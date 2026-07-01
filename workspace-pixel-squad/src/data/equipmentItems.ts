import type { EquipmentItem } from '../types';

export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  { id: 'weapon_pipe', slot: 'weapon', name: '鋼管', price: 30, description: 'ATK+6', statBonus: { atk: 6 } },
  { id: 'weapon_combat_knife', slot: 'weapon', name: '戰鬥匕首', price: 45, description: 'ATK+8, SPD+2', statBonus: { atk: 8, spd: 2 } },
  { id: 'weapon_sniper_rig', slot: 'weapon', name: '狙擊改裝件', price: 65, description: 'ATK+14', statBonus: { atk: 14 } },
  { id: 'weapon_heavy_cannon', slot: 'weapon', name: '重型加農炮', price: 85, description: 'ATK+20, SPD-2', statBonus: { atk: 20, spd: -2 } },
  { id: 'armor_scrap_vest', slot: 'armor', name: '廢料背心', price: 30, description: 'DEF+6', statBonus: { def: 6 } },
  { id: 'armor_kevlar_plate', slot: 'armor', name: '凱夫拉護甲', price: 50, description: 'DEF+10', statBonus: { def: 10 } },
  { id: 'armor_light_mesh', slot: 'armor', name: '輕量網甲', price: 45, description: 'DEF+5, SPD+3', statBonus: { def: 5, spd: 3 } },
  { id: 'armor_titan_shell', slot: 'armor', name: '泰坦外殼', price: 90, description: 'DEF+16, SPD-3', statBonus: { def: 16, spd: -3 } },
];
