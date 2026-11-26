export type WeaponId = 'wood' | 'iron' | 'crimson' | 'frost' | 'thunder' | 'void' | 'excalibur';
export type ArmorId = 'tunic' | 'leather' | 'steel' | 'dragon' | 'frostRobe' | 'shadowCloak' | 'aegis';
export type ShieldId = 'buckler' | 'kite' | 'mirror' | 'aegisShield';

export type WeaponShape = 'short' | 'long' | 'greatsword' | 'katana' | 'axe' | 'scythe' | 'excalibur';
export type ArmorHelm = 'hair' | 'hood' | 'visor' | 'horns' | 'crownIce' | 'shadow' | 'kingCrown';
export type WeaponPassive = 'swiftStride' | 'bounty' | 'critBurst' | 'frostSlow' | 'chainLightning' | 'lifesteal' | 'heroic';
export type ArmorPassive = 'traveler' | 'swift' | 'fortress' | 'berserk' | 'chrono' | 'phantom' | 'barrier';
export type ShieldPassive = 'lightweight' | 'bulwark' | 'reflect' | 'guardian';

export const MAX_POLISH_LV = 5;

export const WEAPON_POLISH_COSTS = [18, 38, 66, 104, 152] as const;
export const ARMOR_POLISH_COSTS = [15, 34, 58, 92, 136] as const;

export const ENDGAME_WEAPON_COST = 680;
export const ENDGAME_ARMOR_COST = 680;
export const ENDGAME_SHIELD_COST = 380;

/** Standardized endgame stats reached by ANY ascended gear (1H vs 2H balanced for shield trade-off). */
export const ASCENDED_WEAPON_1H = { baseAtk: 68, polishAtkPerLv: 22 } as const;
export const ASCENDED_WEAPON_2H = { baseAtk: 84, polishAtkPerLv: 26 } as const;
export const ASCENDED_ARMOR = { baseDef: 44, baseHp: 260, polishDefPerLv: 15 } as const;
export const ASCENDED_SHIELD = { defBonus: 28, hpBonus: 110 } as const;

export interface WeaponSpec {
  id: WeaponId;
  shape: WeaponShape;
  hands: 1 | 2;
  passive: WeaponPassive;
  unlockCost: number; // Crystals in Camp
  baseAtk: number;
  polishAtkPerLv: number;
  critBonus: number; // 0..1
  bladeColor: string;
  edgeColor: string;
  hiltColor: string;
}

export interface ArmorSpec {
  id: ArmorId;
  helm: ArmorHelm;
  passive: ArmorPassive;
  unlockCost: number; // Crystals in Camp
  baseDef: number;
  baseHp: number;
  polishDefPerLv: number;
  evaBonus: number; // 0..1
  critBonus: number; // 0..1
  tunicColor: string;
  tunicDark: string;
  capeColor: string;
  capeDark: string;
  helmColor: string;
  helmShade: string;
}

export interface ShieldSpec {
  id: ShieldId;
  passive: ShieldPassive;
  unlockCost: number;
  defBonus: number;
  hpBonus: number;
  evaBonus: number;
  critBonus: number;
  mainColor: string;
  rimColor: string;
}

/**
 * Horizontal endgame design with Ascension:
 * - Every weapon/armor/shield has a distinct gameplay passive.
 * - Any owned gear can be Ascended for (ENDGAME_COST - unlockCost) crystals so total investment is identical
 *   and late-game ATK/DEF/HP are equalized — choosing gear becomes purely about playstyle & passives!
 */
export const WEAPON_CATALOG: readonly WeaponSpec[] = [
  { id: 'wood', shape: 'short', hands: 1, passive: 'swiftStride', unlockCost: 0, baseAtk: 0, polishAtkPerLv: 4, critBonus: 0, bladeColor: '#d97706', edgeColor: '#92400e', hiltColor: '#fef08a' },
  { id: 'iron', shape: 'long', hands: 1, passive: 'bounty', unlockCost: 35, baseAtk: 8, polishAtkPerLv: 6, critBonus: 0.04, bladeColor: '#f8fafc', edgeColor: '#94a3b8', hiltColor: '#facc15' },
  { id: 'crimson', shape: 'greatsword', hands: 2, passive: 'critBurst', unlockCost: 95, baseAtk: 24, polishAtkPerLv: 11, critBonus: 0.22, bladeColor: '#fb923c', edgeColor: '#dc2626', hiltColor: '#fde047' },
  { id: 'frost', shape: 'katana', hands: 1, passive: 'frostSlow', unlockCost: 190, baseAtk: 34, polishAtkPerLv: 13, critBonus: 0.08, bladeColor: '#bae6fd', edgeColor: '#0284c7', hiltColor: '#e0f2fe' },
  { id: 'thunder', shape: 'axe', hands: 2, passive: 'chainLightning', unlockCost: 320, baseAtk: 56, polishAtkPerLv: 18, critBonus: 0.10, bladeColor: '#fde047', edgeColor: '#ca8a04', hiltColor: '#38bdf8' },
  { id: 'void', shape: 'scythe', hands: 2, passive: 'lifesteal', unlockCost: 480, baseAtk: 70, polishAtkPerLv: 22, critBonus: 0.12, bladeColor: '#d8b4fe', edgeColor: '#7e22ce', hiltColor: '#f43f5e' },
  { id: 'excalibur', shape: 'excalibur', hands: 1, passive: 'heroic', unlockCost: ENDGAME_WEAPON_COST, baseAtk: ASCENDED_WEAPON_1H.baseAtk, polishAtkPerLv: ASCENDED_WEAPON_1H.polishAtkPerLv, critBonus: 0.12, bladeColor: '#fef08a', edgeColor: '#eab308', hiltColor: '#38bdf8' },
];

export const ARMOR_CATALOG: readonly ArmorSpec[] = [
  { id: 'tunic', helm: 'hair', passive: 'traveler', unlockCost: 0, baseDef: 0, baseHp: 0, polishDefPerLv: 2, evaBonus: 0, critBonus: 0, tunicColor: '#2563eb', tunicDark: '#1d4ed8', capeColor: '#ef4444', capeDark: '#b91c1c', helmColor: '#ffd94a', helmShade: '#d99a1e' },
  { id: 'leather', helm: 'hood', passive: 'swift', unlockCost: 35, baseDef: 4, baseHp: 24, polishDefPerLv: 3, evaBonus: 0.08, critBonus: 0.03, tunicColor: '#16a34a', tunicDark: '#15803d', capeColor: '#b45309', capeDark: '#78350f', helmColor: '#15803d', helmShade: '#14532d' },
  { id: 'steel', helm: 'visor', passive: 'fortress', unlockCost: 95, baseDef: 12, baseHp: 60, polishDefPerLv: 5, evaBonus: 0, critBonus: 0, tunicColor: '#94a3b8', tunicDark: '#475569', capeColor: '#2563eb', capeDark: '#1e3a8a', helmColor: '#cbd5e1', helmShade: '#64748b' },
  { id: 'dragon', helm: 'horns', passive: 'berserk', unlockCost: 190, baseDef: 18, baseHp: 100, polishDefPerLv: 7, evaBonus: 0.04, critBonus: 0.12, tunicColor: '#991b1b', tunicDark: '#450a0a', capeColor: '#f59e0b', capeDark: '#b45309', helmColor: '#dc2626', helmShade: '#7f1d1d' },
  { id: 'frostRobe', helm: 'crownIce', passive: 'chrono', unlockCost: 320, baseDef: 26, baseHp: 150, polishDefPerLv: 10, evaBonus: 0.08, critBonus: 0.04, tunicColor: '#0284c7', tunicDark: '#075985', capeColor: '#bae6fd', capeDark: '#38bdf8', helmColor: '#7dd3fc', helmShade: '#0369a1' },
  { id: 'shadowCloak', helm: 'shadow', passive: 'phantom', unlockCost: 480, baseDef: 32, baseHp: 195, polishDefPerLv: 12, evaBonus: 0.20, critBonus: 0.08, tunicColor: '#312e81', tunicDark: '#1e1b4b', capeColor: '#6d28d9', capeDark: '#4c1d95', helmColor: '#1e1b4b', helmShade: '#09050f' },
  { id: 'aegis', helm: 'kingCrown', passive: 'barrier', unlockCost: ENDGAME_ARMOR_COST, baseDef: ASCENDED_ARMOR.baseDef, baseHp: ASCENDED_ARMOR.baseHp, polishDefPerLv: ASCENDED_ARMOR.polishDefPerLv, evaBonus: 0.06, critBonus: 0.04, tunicColor: '#f8fafc', tunicDark: '#cbd5e1', capeColor: '#7c3aed', capeDark: '#4c1d95', helmColor: '#facc15', helmShade: '#ca8a04' },
];

export const SHIELD_CATALOG: readonly ShieldSpec[] = [
  { id: 'buckler', passive: 'lightweight', unlockCost: 30, defBonus: 5, hpBonus: 18, evaBonus: 0.10, critBonus: 0, mainColor: '#b45309', rimColor: '#fde047' },
  { id: 'kite', passive: 'bulwark', unlockCost: 90, defBonus: 13, hpBonus: 48, evaBonus: 0.02, critBonus: 0, mainColor: '#94a3b8', rimColor: '#38bdf8' },
  { id: 'mirror', passive: 'reflect', unlockCost: 210, defBonus: 18, hpBonus: 72, evaBonus: 0.08, critBonus: 0.12, mainColor: '#bae6fd', rimColor: '#a78bfa' },
  { id: 'aegisShield', passive: 'guardian', unlockCost: ENDGAME_SHIELD_COST, defBonus: ASCENDED_SHIELD.defBonus, hpBonus: ASCENDED_SHIELD.hpBonus, evaBonus: 0.08, critBonus: 0.04, mainColor: '#facc15', rimColor: '#ffffff' },
];

export function getWeaponSpec(id: WeaponId): WeaponSpec {
  return WEAPON_CATALOG.find((w) => w.id === id) ?? WEAPON_CATALOG[0];
}

export function getArmorSpec(id: ArmorId): ArmorSpec {
  return ARMOR_CATALOG.find((a) => a.id === id) ?? ARMOR_CATALOG[0];
}

export function getShieldSpec(id: ShieldId | null): ShieldSpec | null {
  if (!id) return null;
  return SHIELD_CATALOG.find((s) => s.id === id) ?? null;
}

/** Crystal cost to ascend a weapon to endgame ATK (unlockCost + ascendCost === ENDGAME_WEAPON_COST). */
export function weaponAscendCost(id: WeaponId): number {
  return Math.max(0, ENDGAME_WEAPON_COST - getWeaponSpec(id).unlockCost);
}

/** Crystal cost to ascend an armor to endgame DEF/HP (unlockCost + ascendCost === ENDGAME_ARMOR_COST). */
export function armorAscendCost(id: ArmorId): number {
  return Math.max(0, ENDGAME_ARMOR_COST - getArmorSpec(id).unlockCost);
}

/** Crystal cost to ascend a shield to endgame DEF/HP (unlockCost + ascendCost === ENDGAME_SHIELD_COST). */
export function shieldAscendCost(id: ShieldId): number {
  const spec = getShieldSpec(id);
  return spec ? Math.max(0, ENDGAME_SHIELD_COST - spec.unlockCost) : 0;
}

/** Effective weapon stats taking Ascension into account. */
export function effectiveWeaponStats(id: WeaponId, ascended: boolean): { baseAtk: number; polishAtkPerLv: number } {
  const w = getWeaponSpec(id);
  if (!ascended && weaponAscendCost(id) > 0) return { baseAtk: w.baseAtk, polishAtkPerLv: w.polishAtkPerLv };
  return w.hands === 2 ? { ...ASCENDED_WEAPON_2H } : { ...ASCENDED_WEAPON_1H };
}

/** Effective armor stats taking Ascension into account. */
export function effectiveArmorStats(id: ArmorId, ascended: boolean): { baseDef: number; baseHp: number; polishDefPerLv: number } {
  const a = getArmorSpec(id);
  if (!ascended && armorAscendCost(id) > 0) return { baseDef: a.baseDef, baseHp: a.baseHp, polishDefPerLv: a.polishDefPerLv };
  return { ...ASCENDED_ARMOR };
}

/** Effective shield stats taking Ascension into account. */
export function effectiveShieldStats(id: ShieldId | null, ascended: boolean): { defBonus: number; hpBonus: number } {
  const s = getShieldSpec(id);
  if (!s) return { defBonus: 0, hpBonus: 0 };
  if (!ascended && shieldAscendCost(s.id) > 0) return { defBonus: s.defBonus, hpBonus: s.hpBonus };
  return { ...ASCENDED_SHIELD };
}

export function isWeaponId(v: unknown): v is WeaponId {
  return typeof v === 'string' && WEAPON_CATALOG.some((w) => w.id === v);
}

export function isArmorId(v: unknown): v is ArmorId {
  return typeof v === 'string' && ARMOR_CATALOG.some((a) => a.id === v);
}

export function isShieldId(v: unknown): v is ShieldId {
  return typeof v === 'string' && SHIELD_CATALOG.some((s) => s.id === v);
}

export function goldPriceScale(loop: number): number {
  return 1 + Math.max(0, loop - 1) * 0.25;
}

export function weaponPolishCost(currentLv: number, loop = 1): number | null {
  if (currentLv < 0 || currentLv >= MAX_POLISH_LV) return null;
  return Math.round(WEAPON_POLISH_COSTS[currentLv] * goldPriceScale(loop));
}

export function armorPolishCost(currentLv: number, loop = 1): number | null {
  if (currentLv < 0 || currentLv >= MAX_POLISH_LV) return null;
  return Math.round(ARMOR_POLISH_COSTS[currentLv] * goldPriceScale(loop));
}

export function innHealCost(heroLevel: number, loop = 1): number {
  return Math.round((10 + heroLevel * 3) * goldPriceScale(loop));
}

export function elixirCost(stacks: number, loop = 1): number {
  return Math.round((45 + stacks * 35) * goldPriceScale(loop));
}
