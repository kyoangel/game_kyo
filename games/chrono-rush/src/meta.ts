import { BALANCE, FEATURES, medalForTimeLeft, medalRank, type DefeatTipKey, type SpeedrunMedal } from './balance.ts';
import { getBoostSpec, isBoostId, type BoostId } from './boosts.ts';
import {
  ARMOR_CATALOG,
  armorAscendCost,
  getArmorSpec,
  getShieldSpec,
  getWeaponSpec,
  isArmorId,
  isShieldId,
  isWeaponId,
  SHIELD_CATALOG,
  shieldAscendCost,
  WEAPON_CATALOG,
  weaponAscendCost,
  type ArmorId,
  type ShieldId,
  type WeaponId,
} from './gear.ts';

export const HARD_MODE_LOOP = 26;

export type HeroCharacter = 'hero' | 'goddess';

export type UpgradeId = 'atk' | 'def' | 'spd' | 'xp' | 'gold' | 'startLv' | 'time' | 'crit' | 'eva';

export interface UpgradeSpec {
  id: UpgradeId;
  maxRank: number;
  baseCost: number;
  costStep: number;
  color: number;
}

export const UPGRADES: readonly UpgradeSpec[] = [
  { id: 'atk', maxRank: 10, baseCost: 16, costStep: 14, color: 0xf43f5e },
  { id: 'def', maxRank: 10, baseCost: 16, costStep: 14, color: 0x38bdf8 },
  { id: 'spd', maxRank: 8, baseCost: 22, costStep: 18, color: 0x34d399 },
  { id: 'xp', maxRank: 8, baseCost: 24, costStep: 20, color: 0xa78bfa },
  { id: 'gold', maxRank: 8, baseCost: 28, costStep: 24, color: 0xfacc15 },
  { id: 'startLv', maxRank: 5, baseCost: 55, costStep: 60, color: 0xfb923c },
  { id: 'time', maxRank: 5, baseCost: 65, costStep: 75, color: 0x22d3ee },
  { id: 'crit', maxRank: 8, baseCost: 24, costStep: 22, color: 0xf59e0b },
  { id: 'eva', maxRank: 8, baseCost: 24, costStep: 22, color: 0x2dd4bf },
];

export type CampRanks = Record<UpgradeId, number>;

export interface StageRecord {
  medal: SpeedrunMedal;
  bestTimeLeft: number;
}

export interface MetaSave {
  crystals: number;
  loop: number; // Currently selected stage loop (1..maxUnlockedLoop)
  maxUnlockedLoop: number;
  totalClears: number;
  ranks: CampRanks;
  ownedWeapons: WeaponId[];
  ownedArmors: ArmorId[];
  ownedShields: ShieldId[];
  ascendedWeapons: WeaponId[];
  ascendedArmors: ArmorId[];
  ascendedShields: ShieldId[];
  equippedWeapon: WeaponId;
  equippedArmor: ArmorId;
  equippedShield: ShieldId | null;
  unlockedWeaponSkins: WeaponId[];
  unlockedArmorSkins: ArmorId[];
  equippedWeaponSkin: WeaponId | null;
  equippedArmorSkin: ArmorId | null;
  heroCharacter: HeroCharacter;
  activeBoosts: BoostId[];
  stageRecords: Record<string, StageRecord>;
}

export function defaultRanks(): CampRanks {
  return { atk: 0, def: 0, spd: 0, xp: 0, gold: 0, startLv: 0, time: 0, crit: 0, eva: 0 };
}

export function defaultMeta(): MetaSave {
  return {
    crystals: 0,
    loop: 1,
    maxUnlockedLoop: 1,
    totalClears: 0,
    ranks: defaultRanks(),
    ownedWeapons: ['wood'],
    ownedArmors: ['tunic'],
    ownedShields: [],
    ascendedWeapons: [],
    ascendedArmors: [],
    ascendedShields: [],
    equippedWeapon: 'wood',
    equippedArmor: 'tunic',
    equippedShield: null,
    unlockedWeaponSkins: [],
    unlockedArmorSkins: [],
    equippedWeaponSkin: null,
    equippedArmorSkin: null,
    heroCharacter: 'hero',
    activeBoosts: [],
    stageRecords: {},
  };
}

function uniqueWeapons(raw: unknown, fallback: WeaponId[]): WeaponId[] {
  if (!Array.isArray(raw)) return [...fallback];
  const set = new Set<WeaponId>(fallback);
  for (const x of raw) if (isWeaponId(x)) set.add(x);
  return [...set];
}

function uniqueArmors(raw: unknown, fallback: ArmorId[]): ArmorId[] {
  if (!Array.isArray(raw)) return [...fallback];
  const set = new Set<ArmorId>(fallback);
  for (const x of raw) if (isArmorId(x)) set.add(x);
  return [...set];
}

function uniqueShields(raw: unknown): ShieldId[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<ShieldId>();
  for (const x of raw) if (isShieldId(x)) set.add(x);
  return [...set];
}

function uniqueBoosts(raw: unknown): BoostId[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<BoostId>();
  for (const x of raw) if (isBoostId(x)) set.add(x);
  return [...set];
}

function sanitizeRecords(raw: unknown): Record<string, StageRecord> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, StageRecord> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const rec = v as Record<string, unknown>;
    const medal = rec.medal === 'S' || rec.medal === 'A' || rec.medal === 'B' ? rec.medal : null;
    const bestTimeLeft = typeof rec.bestTimeLeft === 'number' && Number.isFinite(rec.bestTimeLeft) ? Math.max(0, rec.bestTimeLeft) : 0;
    if (medal) out[k] = { medal, bestTimeLeft: Math.round(bestTimeLeft * 10) / 10 };
  }
  return out;
}

export function sanitizeMeta(raw: unknown): MetaSave {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const crystals = typeof obj.crystals === 'number' && Number.isFinite(obj.crystals) ? Math.max(0, Math.floor(obj.crystals)) : 0;
  const rawLoop = typeof obj.loop === 'number' && Number.isFinite(obj.loop) ? Math.max(1, Math.floor(obj.loop)) : 1;
  const rawMax =
    typeof obj.maxUnlockedLoop === 'number' && Number.isFinite(obj.maxUnlockedLoop)
      ? Math.max(rawLoop, Math.floor(obj.maxUnlockedLoop))
      : rawLoop;
  const loop = Math.min(rawLoop, rawMax);
  const maxUnlockedLoop = rawMax;
  const totalClears = typeof obj.totalClears === 'number' && Number.isFinite(obj.totalClears) ? Math.max(0, Math.floor(obj.totalClears)) : 0;
  const rawRanks = obj.ranks && typeof obj.ranks === 'object' ? (obj.ranks as Record<string, unknown>) : {};
  const ranks = defaultRanks();
  for (const spec of UPGRADES) {
    const v = rawRanks[spec.id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      ranks[spec.id] = Math.max(0, Math.min(spec.maxRank, Math.floor(v)));
    }
  }

  const ownedWeapons = uniqueWeapons(obj.ownedWeapons, ['wood']);
  const ownedArmors = uniqueArmors(obj.ownedArmors, ['tunic']);
  const ownedShields = uniqueShields(obj.ownedShields);
  const ascendedWeapons = uniqueWeapons(obj.ascendedWeapons, []).filter((id) => ownedWeapons.includes(id));
  const ascendedArmors = uniqueArmors(obj.ascendedArmors, []).filter((id) => ownedArmors.includes(id));
  const ascendedShields = uniqueShields(obj.ascendedShields).filter((id) => ownedShields.includes(id));
  const equippedWeapon = isWeaponId(obj.equippedWeapon) && ownedWeapons.includes(obj.equippedWeapon) ? obj.equippedWeapon : 'wood';
  const equippedArmor = isArmorId(obj.equippedArmor) && ownedArmors.includes(obj.equippedArmor) ? obj.equippedArmor : 'tunic';
  const equippedShield = isShieldId(obj.equippedShield) && ownedShields.includes(obj.equippedShield) ? obj.equippedShield : null;

  const unlockedWeaponSkins = uniqueWeapons(obj.unlockedWeaponSkins, []);
  const unlockedArmorSkins = uniqueArmors(obj.unlockedArmorSkins, []);
  const equippedWeaponSkin =
    isWeaponId(obj.equippedWeaponSkin) && unlockedWeaponSkins.includes(obj.equippedWeaponSkin) ? obj.equippedWeaponSkin : null;
  const equippedArmorSkin =
    isArmorId(obj.equippedArmorSkin) && unlockedArmorSkins.includes(obj.equippedArmorSkin) ? obj.equippedArmorSkin : null;

  const heroCharacter: HeroCharacter =
    obj.heroCharacter === 'goddess' && maxUnlockedLoop >= HARD_MODE_LOOP ? 'goddess' : 'hero';

  return {
    crystals,
    loop,
    maxUnlockedLoop,
    totalClears,
    ranks,
    ownedWeapons,
    ownedArmors,
    ownedShields,
    ascendedWeapons,
    ascendedArmors,
    ascendedShields,
    equippedWeapon,
    equippedArmor,
    equippedShield,
    unlockedWeaponSkins,
    unlockedArmorSkins,
    equippedWeaponSkin,
    equippedArmorSkin,
    heroCharacter,
    activeBoosts: uniqueBoosts(obj.activeBoosts),
    stageRecords: sanitizeRecords(obj.stageRecords),
  };
}

export function upgradeCost(spec: UpgradeSpec, currentRank: number): number {
  return Math.round(spec.baseCost + currentRank * spec.costStep + currentRank * currentRank * 3);
}

export function buyUpgrade(meta: MetaSave, id: UpgradeId): MetaSave | null {
  const spec = UPGRADES.find((u) => u.id === id);
  if (!spec) return null;
  const rank = meta.ranks[id];
  if (rank >= spec.maxRank) return null;
  const cost = upgradeCost(spec, rank);
  if (meta.crystals < cost) return null;
  return {
    ...meta,
    crystals: meta.crystals - cost,
    ranks: { ...meta.ranks, [id]: rank + 1 },
  };
}

export function buyOrEquipWeapon(meta: MetaSave, id: WeaponId): MetaSave | null {
  if (meta.ownedWeapons.includes(id)) {
    if (meta.equippedWeapon === id) return null;
    return { ...meta, equippedWeapon: id };
  }
  const spec = getWeaponSpec(id);
  if (meta.crystals < spec.unlockCost) return null;
  return {
    ...meta,
    crystals: meta.crystals - spec.unlockCost,
    ownedWeapons: [...meta.ownedWeapons, id],
    equippedWeapon: id,
  };
}

export function buyOrEquipArmor(meta: MetaSave, id: ArmorId): MetaSave | null {
  if (meta.ownedArmors.includes(id)) {
    if (meta.equippedArmor === id) return null;
    return { ...meta, equippedArmor: id };
  }
  const spec = getArmorSpec(id);
  if (meta.crystals < spec.unlockCost) return null;
  return {
    ...meta,
    crystals: meta.crystals - spec.unlockCost,
    ownedArmors: [...meta.ownedArmors, id],
    equippedArmor: id,
  };
}

export function unlockWeaponSkin(meta: MetaSave, id: WeaponId): { meta: MetaSave; newlyUnlocked: boolean } {
  if (meta.unlockedWeaponSkins.includes(id)) return { meta, newlyUnlocked: false };
  return {
    meta: { ...meta, unlockedWeaponSkins: [...meta.unlockedWeaponSkins, id] },
    newlyUnlocked: true,
  };
}

export function unlockArmorSkin(meta: MetaSave, id: ArmorId): { meta: MetaSave; newlyUnlocked: boolean } {
  if (meta.unlockedArmorSkins.includes(id)) return { meta, newlyUnlocked: false };
  return {
    meta: { ...meta, unlockedArmorSkins: [...meta.unlockedArmorSkins, id] },
    newlyUnlocked: true,
  };
}

export function selectWeaponSkin(meta: MetaSave, id: WeaponId | null): MetaSave | null {
  if (id === null) {
    if (meta.equippedWeaponSkin === null) return null;
    return { ...meta, equippedWeaponSkin: null };
  }
  if (!meta.unlockedWeaponSkins.includes(id) || meta.equippedWeaponSkin === id) return null;
  return { ...meta, equippedWeaponSkin: id };
}

export function selectArmorSkin(meta: MetaSave, id: ArmorId | null): MetaSave | null {
  if (id === null) {
    if (meta.equippedArmorSkin === null) return null;
    return { ...meta, equippedArmorSkin: null };
  }
  if (!meta.unlockedArmorSkins.includes(id) || meta.equippedArmorSkin === id) return null;
  return { ...meta, equippedArmorSkin: id };
}

/**
 * Appearance rule:
 * - Before unlocking skins (or when skin is set to null), hero looks like their equipped weapon & armor.
 * - Once a skin is unlocked by polishing that gear to LV MAX in a village, player can transmog it onto any gear!
 */
export function buyOrEquipShield(meta: MetaSave, id: ShieldId | null): MetaSave | null {
  if (id === null) {
    if (meta.equippedShield === null) return null;
    return { ...meta, equippedShield: null };
  }
  if (meta.ownedShields.includes(id)) {
    if (meta.equippedShield === id) return null;
    return { ...meta, equippedShield: id };
  }
  const spec = getShieldSpec(id);
  if (!spec || meta.crystals < spec.unlockCost) return null;
  return {
    ...meta,
    crystals: meta.crystals - spec.unlockCost,
    ownedShields: [...meta.ownedShields, id],
    equippedShield: id,
  };
}

export function isBoostsUnlocked(meta: MetaSave): boolean {
  return meta.maxUnlockedLoop >= HARD_MODE_LOOP;
}

export function canAscendWeapons(meta: MetaSave): boolean {
  return meta.ownedWeapons.length >= WEAPON_CATALOG.length;
}

export function canAscendArmors(meta: MetaSave): boolean {
  return meta.ownedArmors.length >= ARMOR_CATALOG.length;
}

export function canAscendShields(meta: MetaSave): boolean {
  return meta.ownedShields.length >= SHIELD_CATALOG.length;
}

export function ascendWeapon(meta: MetaSave, id: WeaponId): MetaSave | null {
  if (!canAscendWeapons(meta) || !meta.ownedWeapons.includes(id) || meta.ascendedWeapons.includes(id)) return null;
  const cost = weaponAscendCost(id);
  if (cost <= 0 || meta.crystals < cost) return null;
  return {
    ...meta,
    crystals: meta.crystals - cost,
    ascendedWeapons: [...meta.ascendedWeapons, id],
  };
}

export function ascendArmor(meta: MetaSave, id: ArmorId): MetaSave | null {
  if (!canAscendArmors(meta) || !meta.ownedArmors.includes(id) || meta.ascendedArmors.includes(id)) return null;
  const cost = armorAscendCost(id);
  if (cost <= 0 || meta.crystals < cost) return null;
  return {
    ...meta,
    crystals: meta.crystals - cost,
    ascendedArmors: [...meta.ascendedArmors, id],
  };
}

export function ascendShield(meta: MetaSave, id: ShieldId): MetaSave | null {
  if (!canAscendShields(meta) || !meta.ownedShields.includes(id) || meta.ascendedShields.includes(id)) return null;
  const cost = shieldAscendCost(id);
  if (cost <= 0 || meta.crystals < cost) return null;
  return {
    ...meta,
    crystals: meta.crystals - cost,
    ascendedShields: [...meta.ascendedShields, id],
  };
}

/** Active shield only applies when FEATURES.shieldsAnd2H is on and equipping a 1-Handed weapon! */
export function activeShieldFor(meta: MetaSave): ShieldId | null {
  if (!FEATURES.shieldsAnd2H) return null;
  return getWeaponSpec(meta.equippedWeapon).hands === 1 ? meta.equippedShield : null;
}

/** Toggle a Pre-Run Boost ON (deduct crystals) or OFF (refund full crystal cost). Unlocked at Hard Mode (Loop 26+). */
export function togglePreRunBoost(meta: MetaSave, id: BoostId): MetaSave | null {
  if (!FEATURES.preRunBoosts || !isBoostsUnlocked(meta)) return null;
  const spec = getBoostSpec(id);
  if (meta.activeBoosts.includes(id)) {
    return {
      ...meta,
      crystals: meta.crystals + spec.cost,
      activeBoosts: meta.activeBoosts.filter((b) => b !== id),
    };
  }
  if (meta.crystals < spec.cost) return null;
  return {
    ...meta,
    crystals: meta.crystals - spec.cost,
    activeBoosts: [...meta.activeBoosts, id],
  };
}

export function selectStageLoop(meta: MetaSave, targetLoop: number): MetaSave | null {
  if (!FEATURES.chapterSelect) return null;
  const clamped = Math.max(1, Math.min(meta.maxUnlockedLoop, Math.floor(targetLoop)));
  if (clamped === meta.loop) return null;
  return { ...meta, loop: clamped };
}

export function recordStageClear(meta: MetaSave, clearedLoop: number, timeLeft: number): MetaSave {
  const key = String(clearedLoop);
  const newMedal = medalForTimeLeft(timeLeft);
  const roundedTime = Math.round(Math.max(0, timeLeft) * 10) / 10;
  const prev = meta.stageRecords[key];
  const bestMedal = !prev || medalRank(newMedal) > medalRank(prev.medal) ? newMedal : prev.medal;
  const bestTimeLeft = !prev || roundedTime > prev.bestTimeLeft ? roundedTime : prev.bestTimeLeft;

  const isFrontier = clearedLoop >= meta.maxUnlockedLoop;
  const nextMax = isFrontier ? clearedLoop + 1 : meta.maxUnlockedLoop;
  const nextLoop = isFrontier ? clearedLoop + 1 : meta.loop;
  return {
    ...meta,
    loop: nextLoop,
    maxUnlockedLoop: nextMax,
    totalClears: meta.totalClears + 1,
    stageRecords: {
      ...meta.stageRecords,
      [key]: { medal: bestMedal, bestTimeLeft },
    },
  };
}

export function isGoddessHeroUnlocked(meta: MetaSave): boolean {
  return meta.maxUnlockedLoop >= HARD_MODE_LOOP;
}

export function activeHeroCharacter(meta: MetaSave): HeroCharacter {
  return meta.heroCharacter === 'goddess' && isGoddessHeroUnlocked(meta) ? 'goddess' : 'hero';
}

export function selectHeroCharacter(meta: MetaSave, character: HeroCharacter): MetaSave | null {
  if (character === 'goddess' && !isGoddessHeroUnlocked(meta)) return null;
  if (meta.heroCharacter === character) return null;
  return { ...meta, heroCharacter: character };
}

export function resolveHeroAppearance(meta: MetaSave): { weaponLook: WeaponId; armorLook: ArmorId; shieldLook: ShieldId | null } {
  const weaponLook =
    meta.equippedWeaponSkin && meta.unlockedWeaponSkins.includes(meta.equippedWeaponSkin)
      ? meta.equippedWeaponSkin
      : meta.equippedWeapon;
  const armorLook =
    meta.equippedArmorSkin && meta.unlockedArmorSkins.includes(meta.equippedArmorSkin)
      ? meta.equippedArmorSkin
      : meta.equippedArmor;
  return { weaponLook, armorLook, shieldLook: activeShieldFor(meta) };
}

export interface RunSummary {
  level: number;
  kills: number;
  bossHpRatio: number;
  bossSlain: boolean;
  loop: number;
  timeLeft: number;
  medal: SpeedrunMedal | null;
  crystalsEarned: number;
  skinsUnlocked: string[];
  defeatTip: DefeatTipKey | null;
  reason: 'victory' | 'timeUp' | 'defeated';
  fanfarePlayed?: boolean;
}

export function computeCrystalReward(
  params: { level: number; kills: number; bossHpRatio: number; bossSlain: boolean; loop: number },
  ranks: CampRanks,
): number {
  const greedMult = 1 + ranks.gold * BALANCE.greedBonusPerRank;
  const bossDamagePct = Math.max(0, Math.min(1, 1 - params.bossHpRatio));
  const clearBonus = params.bossSlain ? BALANCE.crystalBossClear(params.loop) : 0;
  const base =
    params.level * BALANCE.crystalPerLevel +
    params.kills * BALANCE.crystalPerKill +
    Math.round(bossDamagePct * BALANCE.crystalBossDamageMax) +
    clearBonus;
  return Math.max(5, Math.round(base * greedMult));
}

export function computeScore(params: { level: number; kills: number; bossHpRatio: number; bossSlain: boolean; loop: number; timeLeft: number }): number {
  const bossDamageScore = Math.round(Math.max(0, Math.min(1, 1 - params.bossHpRatio)) * 500);
  const victoryBonus = params.bossSlain ? 1500 * params.loop + Math.round(params.timeLeft * 50) : 0;
  return params.level * 100 + params.kills * 25 + bossDamageScore + victoryBonus;
}
