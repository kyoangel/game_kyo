import { BALANCE, FEATURES } from './balance.ts';
import {
  armorPolishCost,
  effectiveArmorStats,
  effectiveShieldStats,
  effectiveWeaponStats,
  elixirCost,
  getArmorSpec,
  getShieldSpec,
  getWeaponSpec,
  goldPriceScale,
  innHealCost,
  MAX_POLISH_LV,
  weaponPolishCost,
  type ArmorId,
  type ArmorPassive,
  type ShieldId,
  type ShieldPassive,
  type WeaponId,
  type WeaponPassive,
} from './gear.ts';
import { activeShieldFor, isBoostsUnlocked, type MetaSave } from './meta.ts';

export const RUN_DURATION_SEC = BALANCE.baseRunSeconds;
export const REVIVE_BONUS_SEC = BALANCE.reviveBonusSeconds;

export interface HeroStats {
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
  weaponId: WeaponId;
  armorId: ArmorId;
  shieldId: ShieldId | null;
  weaponAscended: boolean;
  armorAscended: boolean;
  weaponPassive: WeaponPassive;
  armorPassive: ArmorPassive;
  shieldPassive: ShieldPassive | null;
  weaponPolishLv: number;
  armorPolishLv: number;
  elixirStacks: number;
  shrineBossBonus: number; // e.g. 0.25 from Power Shrine POI + armor berserk
  damageReduction: number; // 0..0.45 from fortress/bulwark passives
  bossBarrierHits: number; // free hit shield in boss arena (Aegis King)
  weaponSkinMult: number;
  armorSkinMult: number;
  critChance: number; // 0..0.85
  evaChance: number; // 0..0.65
  runDurationSec: number;
  moveSpeed: number;
  dashCooldownMs: number;
  xpMult: number;
  goldMult: number;
}

export interface EnemySpec {
  id: 'slime' | 'goblin' | 'skeleton' | 'demonLord';
  zone: 1 | 2 | 3 | 4;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
  isBoss?: boolean;
}

export function xpNeededForLevel(level: number): number {
  return Math.round(12 + (level - 1) * 9 + Math.pow(level - 1, 1.35) * 3);
}

export function createHeroStats(meta: MetaSave): HeroStats {
  const { ranks, equippedWeapon, equippedArmor, unlockedWeaponSkins, unlockedArmorSkins } = meta;
  const boosts = FEATURES.preRunBoosts && isBoostsUnlocked(meta) ? meta.activeBoosts : [];
  const hasSpeedPact = boosts.includes('speedPact');
  const hasChronoDust = boosts.includes('chronoDust');
  const hasSlayerOil = boosts.includes('slayerOil');
  const hasGoldPouch = boosts.includes('goldPouch');

  const weapon = getWeaponSpec(equippedWeapon);
  const armor = getArmorSpec(equippedArmor);
  const shieldId = activeShieldFor(meta);
  const shield = getShieldSpec(shieldId);

  const weaponAscended = meta.ascendedWeapons.includes(equippedWeapon);
  const armorAscended = meta.ascendedArmors.includes(equippedArmor);
  const shieldAscended = shieldId ? meta.ascendedShields.includes(shieldId) : false;

  const wStats = effectiveWeaponStats(equippedWeapon, weaponAscended);
  const aStats = effectiveArmorStats(equippedArmor, armorAscended);
  const sStats = effectiveShieldStats(shieldId, shieldAscended);

  const weaponSkinMult = 1 + unlockedWeaponSkins.length * BALANCE.weaponSkinAtkPct;
  const armorSkinMult = 1 + unlockedArmorSkins.length * BALANCE.armorSkinDefHpPct;
  const startLv = 1 + ranks.startLv;

  const rawMaxHp = 55 + (startLv - 1) * 14 + ranks.def * 15 + aStats.baseHp + sStats.hpBonus;
  const guardianHpMult = shield?.passive === 'guardian' ? 1.15 : 1;
  const maxHp = Math.round(rawMaxHp * armorSkinMult * guardianHpMult);
  const atk = 11 + (startLv - 1) * 4 + ranks.atk * 3 + wStats.baseAtk;
  const def = 3 + (startLv - 1) * 2 + ranks.def * 2 + aStats.baseDef + sStats.defBonus;

  const critChance = FEATURES.critAndEvasion
    ? Math.min(0.85, 0.05 + ranks.crit * 0.04 + weapon.critBonus + armor.critBonus + (shield?.critBonus ?? 0))
    : 0;
  const evaChance = FEATURES.critAndEvasion
    ? Math.min(0.65, 0.04 + ranks.eva * 0.03 + armor.evaBonus + (shield?.evaBonus ?? 0))
    : 0;

  let speedMult = (1 + ranks.spd * 0.1) * (hasSpeedPact ? 1.2 : 1);
  let dashCdMult = hasSpeedPact ? 0.75 : 1;
  if (weapon.passive === 'swiftStride') {
    speedMult *= 1.15;
    dashCdMult *= 0.85;
  }
  if (armor.passive === 'traveler') speedMult *= 1.1;
  if (armor.passive === 'swift') {
    speedMult *= 1.16;
    dashCdMult *= 0.85;
  }
  if (shield?.passive === 'lightweight') speedMult *= 1.1;

  const baseSpeed = 310 * speedMult;
  const baseDashCd = (1150 / (1 + ranks.spd * 0.1)) * dashCdMult;

  const damageReduction = Math.min(
    0.45,
    (armor.passive === 'fortress' ? 0.18 : 0) + (shield?.passive === 'bulwark' ? 0.12 : 0),
  );
  const shrineBossBonus = (hasSlayerOil ? 0.35 : 0) + (armor.passive === 'berserk' ? 0.15 : 0);
  const bonusTimeSec = armor.passive === 'chrono' ? 5 : 0;
  const xpMult = 1 + ranks.xp * 0.2 + (weapon.passive === 'bounty' ? 0.25 : 0);
  const goldMult = 1 + ranks.gold * BALANCE.greedBonusPerRank + (weapon.passive === 'bounty' ? 0.25 : 0) + (armor.passive === 'traveler' ? 0.15 : 0);

  return {
    level: startLv,
    xp: 0,
    xpToNext: xpNeededForLevel(startLv),
    hp: maxHp,
    maxHp,
    atk,
    def,
    gold: hasGoldPouch ? Math.round(90 * goldPriceScale(meta.loop)) : 0,
    weaponId: equippedWeapon,
    armorId: equippedArmor,
    shieldId,
    weaponAscended,
    armorAscended,
    weaponPassive: weapon.passive,
    armorPassive: armor.passive,
    shieldPassive: shield?.passive ?? null,
    weaponPolishLv: 0,
    armorPolishLv: 0,
    elixirStacks: 0,
    shrineBossBonus,
    damageReduction,
    bossBarrierHits: armor.passive === 'barrier' ? 1 : 0,
    weaponSkinMult,
    armorSkinMult,
    critChance,
    evaChance,
    runDurationSec: BALANCE.baseRunSeconds + ranks.time * BALANCE.timeUpgradeSecPerRank + (hasChronoDust ? 8 : 0) + bonusTimeSec,
    moveSpeed: Math.round(baseSpeed),
    dashCooldownMs: Math.max(360, Math.round(baseDashCd)),
    xpMult,
    goldMult,
  };
}

export function totalAtk(hero: HeroStats): number {
  const wStats = effectiveWeaponStats(hero.weaponId, hero.weaponAscended);
  return Math.round((hero.atk + hero.weaponPolishLv * wStats.polishAtkPerLv) * hero.weaponSkinMult);
}

export function totalDef(hero: HeroStats): number {
  const aStats = effectiveArmorStats(hero.armorId, hero.armorAscended);
  return Math.round((hero.def + hero.armorPolishLv * aStats.polishDefPerLv) * hero.armorSkinMult);
}

export function makeEnemy(id: EnemySpec['id'], loop: number): EnemySpec {
  const scale = BALANCE.mobStatScale(loop);
  const rew = BALANCE.mobRewardScale(loop);
  switch (id) {
    case 'slime':
      return {
        id,
        zone: 1,
        hp: Math.round(16 * scale),
        atk: Math.round(7 * scale),
        def: 0,
        xp: Math.round(10 * rew),
        gold: Math.round(9 * rew),
      };
    case 'goblin':
      return {
        id,
        zone: 2,
        hp: Math.round(48 * scale),
        atk: Math.round(16 * scale),
        def: 0,
        xp: Math.round(28 * rew),
        gold: Math.round(24 * rew),
      };
    case 'skeleton':
      return {
        id,
        zone: 3,
        hp: Math.round(115 * scale),
        atk: Math.round(32 * scale),
        def: 0,
        xp: Math.round(68 * rew),
        gold: Math.round(58 * rew),
      };
    case 'demonLord':
      return {
        id,
        zone: 4,
        hp: BALANCE.bossHp(loop),
        atk: BALANCE.bossAtk(loop),
        def: BALANCE.bossDef(loop),
        xp: 0,
        gold: 0,
        isBoss: true,
      };
  }
}

export interface ClashResult {
  heroSurvived: boolean;
  enemyDefeated: boolean;
  heroDamageTaken: number;
  enemyDamageDealt: number;
  remainingEnemyHp: number;
  oneShot: boolean;
  critTriggered: boolean;
  evaded: boolean;
  lifestealHealed: number;
}

/**
 * Single transparent 1-hit bump exchange:
 * - Hero deals exact ATK (or crit-multiplied ATK) directly against enemy HP (mobs have 0 DEF).
 * - If enemy dies in 1 hit -> clean one-shot with 0 counter-damage and no knockback.
 * - If enemy survives -> enemy drops to exact remaining HP and counter-attacks once.
 */
export function resolveBumpClash(
  hero: HeroStats,
  enemyHp: number,
  enemy: EnemySpec,
  rng: () => number = Math.random,
): ClashResult {
  const hAtk = totalAtk(hero);
  const hDef = totalDef(hero);
  const lowHpBoost = hero.weaponPassive === 'lifesteal' && hero.hp <= hero.maxHp * 0.5 ? 1.25 : 1;
  const baseDmgToEnemy = Math.max(1, Math.round((hAtk - enemy.def) * lowHpBoost));
  const critTriggered = rng() < hero.critChance;
  const critMult = hero.weaponPassive === 'critBurst' ? 1.85 : 1.5;
  const dmgToEnemy = critTriggered ? Math.round(baseDmgToEnemy * critMult) : baseDmgToEnemy;

  const dealt = Math.min(enemyHp, dmgToEnemy);
  const remainingEnemyHp = Math.max(0, enemyHp - dealt);
  const lifestealHealed = hero.weaponPassive === 'lifesteal' ? Math.max(2, Math.round(dealt * 0.12)) : 0;

  // Clean one-shot: enemy dies immediately without counter-attacking
  if (!enemy.isBoss && remainingEnemyHp <= 0) {
    return {
      heroSurvived: true,
      enemyDefeated: true,
      heroDamageTaken: 0,
      enemyDamageDealt: dealt,
      remainingEnemyHp: 0,
      oneShot: true,
      critTriggered,
      evaded: false,
      lifestealHealed,
    };
  }

  // Surviving enemy counter-attacks once
  const evaded = rng() < hero.evaChance;
  const minMobDmg = Math.max(1, Math.round(enemy.atk * BALANCE.mobMinAtkRatio));
  const rawCounter = Math.max(minMobDmg, enemy.atk - hDef);
  const reducedCounter = Math.max(1, Math.round(rawCounter * (1 - hero.damageReduction)));
  const heroDamageTaken = evaded ? 0 : Math.min(hero.hp, reducedCounter);
  const heroSurvived = hero.hp - heroDamageTaken > 0;

  return {
    heroSurvived,
    enemyDefeated: remainingEnemyHp <= 0,
    heroDamageTaken,
    enemyDamageDealt: dealt,
    remainingEnemyHp,
    oneShot: false,
    critTriggered,
    evaded,
    lifestealHealed: heroSurvived ? lifestealHealed : 0,
  };
}

export function grantRewards(hero: HeroStats, baseXp: number, baseGold: number): { levelsGained: number; xpGained: number; goldGained: number } {
  const xpGained = Math.max(1, Math.round(baseXp * hero.xpMult));
  const goldGained = Math.max(1, Math.round(baseGold * hero.goldMult));
  hero.xp += xpGained;
  hero.gold += goldGained;

  let levelsGained = 0;
  while (hero.xp >= hero.xpToNext) {
    hero.xp -= hero.xpToNext;
    hero.level += 1;
    levelsGained += 1;
    hero.maxHp += 14;
    hero.atk += 4;
    hero.def += 2;
    hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.35));
    hero.xpToNext = xpNeededForLevel(hero.level);
  }
  return { levelsGained, xpGained, goldGained };
}

export function polishWeapon(hero: HeroStats, loop = 1): { ok: boolean; hitMax: boolean } {
  const cost = weaponPolishCost(hero.weaponPolishLv, loop);
  if (cost === null || hero.gold < cost) return { ok: false, hitMax: false };
  hero.gold -= cost;
  hero.weaponPolishLv += 1;
  return { ok: true, hitMax: hero.weaponPolishLv >= MAX_POLISH_LV };
}

export function polishArmor(hero: HeroStats, loop = 1): { ok: boolean; hitMax: boolean } {
  const cost = armorPolishCost(hero.armorPolishLv, loop);
  if (cost === null || hero.gold < cost) return { ok: false, hitMax: false };
  hero.gold -= cost;
  hero.armorPolishLv += 1;
  return { ok: true, hitMax: hero.armorPolishLv >= MAX_POLISH_LV };
}

export function buyBattleElixir(hero: HeroStats, loop = 1): boolean {
  const cost = elixirCost(hero.elixirStacks, loop);
  if (hero.gold < cost) return false;
  hero.gold -= cost;
  hero.elixirStacks += 1;
  return true;
}

export function bossBonusDamageMult(hero: HeroStats): number {
  return 1 + hero.elixirStacks * 0.15 + hero.shrineBossBonus;
}

export function bossComboMultiplier(combo: number, heroic = false): number {
  if (!FEATURES.bossCombo) return 1;
  const step = heroic ? 0.25 : BALANCE.bossComboStep;
  const maxMult = heroic ? 2.5 : BALANCE.bossComboMaxMult;
  return Math.min(maxMult, 1 + Math.max(0, combo) * step);
}

export function bossFireballDamage(hero: HeroStats, boss: EnemySpec): number {
  const floor = Math.max(2, Math.round(boss.atk * BALANCE.bossFireballMinAtkRatio));
  const raw = Math.max(floor, Math.round(boss.atk * 0.55 - totalDef(hero)));
  return Math.max(1, Math.round(raw * (1 - hero.damageReduction)));
}

export function resolveBossDashHit(
  hero: HeroStats,
  bossHp: number,
  boss: EnemySpec,
  dashing: boolean,
  combo = 0,
  rng: () => number = Math.random,
): {
  dmgToBoss: number;
  dmgToHero: number;
  remainingBossHp: number;
  bossDefeated: boolean;
  heroSurvived: boolean;
  critTriggered: boolean;
  evaded: boolean;
  lifestealHealed: number;
} {
  const lowHpBoost = hero.weaponPassive === 'lifesteal' && hero.hp <= hero.maxHp * 0.5 ? 1.25 : 1;
  const baseDmg = Math.max(2, Math.round((totalAtk(hero) - boss.def) * lowHpBoost));
  const critTriggered = rng() < hero.critChance;
  const critMult = critTriggered ? (hero.weaponPassive === 'critBurst' ? 1.85 : 1.5) : 1;
  const comboMult = bossComboMultiplier(combo, hero.weaponPassive === 'heroic');
  const mult = (dashing ? 1.5 : 1) * comboMult * critMult * bossBonusDamageMult(hero);
  const dmgToBoss = Math.min(bossHp, Math.round(baseDmg * mult));
  const remainingBossHp = Math.max(0, bossHp - dmgToBoss);
  const lifestealHealed = hero.weaponPassive === 'lifesteal' ? Math.max(3, Math.round(dmgToBoss * 0.1)) : 0;
  if (remainingBossHp <= 0) {
    return { dmgToBoss, dmgToHero: 0, remainingBossHp: 0, bossDefeated: true, heroSurvived: true, critTriggered, evaded: false, lifestealHealed };
  }
  const evaded = rng() < hero.evaChance;
  const minMelee = Math.max(1, Math.round(boss.atk * BALANCE.bossMeleeMinAtkRatio));
  const rawTaken = Math.max(minMelee, boss.atk - totalDef(hero));
  const afterDash = dashing ? Math.max(1, Math.round(rawTaken * 0.6)) : rawTaken;
  const dmgToHero = evaded ? 0 : Math.max(1, Math.round(afterDash * (1 - hero.damageReduction)));
  const heroSurvived = hero.hp - dmgToHero > 0;
  return { dmgToBoss, dmgToHero, remainingBossHp, bossDefeated: false, heroSurvived, critTriggered, evaded, lifestealHealed };
}

/** Returns true when hero's current ATK/DEF/HP can comfortably defeat the Demon Lord with dash-slashes. */
export function canEasilyBeatBoss(hero: HeroStats, bossHp: number, boss: EnemySpec): boolean {
  if (bossHp <= 0) return false;
  const hit = resolveBossDashHit(hero, bossHp, boss, true, 0, () => 0.99);
  const hitsToKill = Math.ceil(bossHp / Math.max(1, hit.dmgToBoss));
  const totalTaken = Math.max(0, hitsToKill - 1) * hit.dmgToHero;
  return (hitsToKill <= 6 && hero.hp > totalTaken + hero.maxHp * 0.25) || (hitsToKill <= 2 && hero.hp > totalTaken);
}

export function buyInnHeal(hero: HeroStats, loop = 1): boolean {
  if (hero.hp >= hero.maxHp) return false;
  const cost = innHealCost(hero.level, loop);
  if (hero.gold < cost) return false;
  hero.gold -= cost;
  hero.hp = hero.maxHp;
  return true;
}
