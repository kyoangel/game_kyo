import { describe, expect, it } from 'vitest';
import {
  ARMOR_CATALOG,
  armorAscendCost,
  effectiveArmorStats,
  effectiveShieldStats,
  effectiveWeaponStats,
  ENDGAME_ARMOR_COST,
  ENDGAME_SHIELD_COST,
  ENDGAME_WEAPON_COST,
  MAX_POLISH_LV,
  SHIELD_CATALOG,
  shieldAscendCost,
  WEAPON_CATALOG,
  weaponAscendCost,
} from './gear.ts';
import {
  activeShieldFor,
  ascendArmor,
  ascendShield,
  ascendWeapon,
  buyOrEquipArmor,
  buyOrEquipShield,
  buyOrEquipWeapon,
  buyUpgrade,
  computeCrystalReward,
  computeScore,
  defaultMeta,
  recordStageClear,
  resolveHeroAppearance,
  sanitizeMeta,
  selectArmorSkin,
  selectStageLoop,
  selectWeaponSkin,
  togglePreRunBoost,
  unlockArmorSkin,
  unlockWeaponSkin,
  UPGRADES,
  upgradeCost,
} from './meta.ts';
import {
  bossBonusDamageMult,
  buyBattleElixir,
  buyInnHeal,
  canEasilyBeatBoss,
  createHeroStats,
  grantRewards,
  makeEnemy,
  polishArmor,
  polishWeapon,
  resolveBossDashHit,
  resolveBumpClash,
  totalAtk,
  totalDef,
} from './systems.ts';

describe('chrono-rush meta progression, gear & skins', () => {
  it('sanitizes corrupt save data safely', () => {
    const clean = sanitizeMeta({ crystals: -50, loop: 0, ranks: { atk: 99, spd: 'bad' }, equippedWeapon: 'invalid' });
    expect(clean.crystals).toBe(0);
    expect(clean.loop).toBe(1);
    expect(clean.ranks.atk).toBe(10);
    expect(clean.ranks.spd).toBe(0);
    expect(clean.equippedWeapon).toBe('wood');
    expect(clean.equippedArmor).toBe('tunic');
  });

  it('buys upgrades when crystals are sufficient and rejects when broke', () => {
    const spec = UPGRADES[0];
    const cost = upgradeCost(spec, 0);
    const poor = defaultMeta();
    expect(buyUpgrade(poor, 'atk')).toBeNull();

    const rich = { ...poor, crystals: cost + 5 };
    const next = buyUpgrade(rich, 'atk');
    expect(next).not.toBeNull();
    expect(next!.ranks.atk).toBe(1);
    expect(next!.crystals).toBe(5);
  });

  it('unlocks and equips gear in camp, and transmogs skins only after unlocking', () => {
    let meta = { ...defaultMeta(), crystals: 100 };
    // Before skin unlock: looks match equipped gear
    expect(resolveHeroAppearance(meta)).toEqual({ weaponLook: 'wood', armorLook: 'tunic', shieldLook: null });
    // Cannot select locked skin
    expect(selectWeaponSkin(meta, 'wood')).toBeNull();

    // Buy & equip iron sword and leather armor
    meta = buyOrEquipWeapon(meta, 'iron')!;
    meta = buyOrEquipArmor(meta, 'leather')!;
    expect(meta.equippedWeapon).toBe('iron');
    expect(meta.equippedArmor).toBe('leather');
    expect(resolveHeroAppearance(meta)).toEqual({ weaponLook: 'iron', armorLook: 'leather', shieldLook: null });

    // Unlock wood & tunic skins via LV MAX polish, then transmog onto iron/leather!
    meta = unlockWeaponSkin(meta, 'wood').meta;
    meta = unlockArmorSkin(meta, 'tunic').meta;
    meta = selectWeaponSkin(meta, 'wood')!;
    meta = selectArmorSkin(meta, 'tunic')!;
    expect(resolveHeroAppearance(meta)).toEqual({ weaponLook: 'wood', armorLook: 'tunic', shieldLook: null });
  });

  it('activates shields only with 1-handed weapons and locks them with 2-handed weapons', () => {
    let meta = { ...defaultMeta(), crystals: 300 };
    meta = buyOrEquipShield(meta, 'buckler')!;
    expect(activeShieldFor(meta)).toBe('buckler');
    const hero1H = createHeroStats(meta);
    expect(hero1H.shieldId).toBe('buckler');

    // Switch to 2H Sunfire Claymore -> shield becomes inactive!
    meta = buyOrEquipWeapon(meta, 'crimson')!;
    expect(activeShieldFor(meta)).toBeNull();
    const hero2H = createHeroStats(meta);
    expect(hero2H.shieldId).toBeNull();
    expect(hero2H.critChance).toBeGreaterThan(hero1H.critChance);
  });

  it('toggles pre-run boosts only after Hard Mode (Loop 26) and records S/A/B medals without losing frontier progress', () => {
    let meta = { ...defaultMeta(), crystals: 200 };
    // Locked before Loop 26
    expect(togglePreRunBoost(meta, 'chronoDust')).toBeNull();

    // Unlocked at Loop 26 (Hard Mode)
    meta = { ...meta, maxUnlockedLoop: 26, loop: 26 };
    meta = togglePreRunBoost(meta, 'chronoDust')!;
    expect(meta.crystals).toBe(140);
    // Toggle OFF refunds full 60 crystals!
    meta = togglePreRunBoost(meta, 'chronoDust')!;
    expect(meta.crystals).toBe(200);
    expect(meta.activeBoosts).toEqual([]);

    meta = togglePreRunBoost(meta, 'chronoDust')!;
    meta = togglePreRunBoost(meta, 'slayerOil')!;
    const hero = createHeroStats(meta);
    expect(hero.runDurationSec).toBe(38);
    expect(hero.shrineBossBonus).toBeCloseTo(0.35, 5);

    // Clear Loop 1 with 14s left -> S medal, unlocks Loop 2
    let fresh = defaultMeta();
    fresh = recordStageClear(fresh, 1, 14.2);
    expect(fresh.maxUnlockedLoop).toBe(2);
    expect(fresh.loop).toBe(2);
    expect(fresh.stageRecords['1']).toEqual({ medal: 'S', bestTimeLeft: 14.2 });

    // Select Loop 1 to replay and clear with worse time -> keeps S medal and maxUnlockedLoop=2
    fresh = selectStageLoop(fresh, 1)!;
    expect(fresh.loop).toBe(1);
    fresh = recordStageClear(fresh, 1, 4.0);
    expect(fresh.maxUnlockedLoop).toBe(2);
    expect(fresh.stageRecords['1'].medal).toBe('S');
    expect(fresh.stageRecords['1'].bestTimeLeft).toBe(14.2);
  });

  it('scales crystal rewards with greed charm and boss clear', () => {
    const base = computeCrystalReward({ level: 5, kills: 10, bossHpRatio: 0, bossSlain: true, loop: 1 }, defaultMeta().ranks);
    const boosted = computeCrystalReward(
      { level: 5, kills: 10, bossHpRatio: 0, bossSlain: true, loop: 1 },
      { ...defaultMeta().ranks, gold: 4 },
    );
    expect(boosted).toBeGreaterThan(base * 1.4);
    expect(computeScore({ level: 5, kills: 10, bossHpRatio: 0, bossSlain: true, loop: 1, timeLeft: 4 })).toBeGreaterThan(2000);
  });
});

describe('chrono-rush bump combat, blacksmith polish & paid inn heal', () => {
  it('one-shots weak slimes with zero damage taken', () => {
    const meta = { ...defaultMeta(), ranks: { ...defaultMeta().ranks, atk: 5 } };
    const hero = createHeroStats(meta);
    const slime = makeEnemy('slime', 1);
    const res = resolveBumpClash(hero, slime.hp, slime);
    expect(res.oneShot).toBe(true);
    expect(res.enemyDefeated).toBe(true);
    expect(res.heroDamageTaken).toBe(0);
  });

  it('levels up hero and increases stats', () => {
    const hero = createHeroStats(defaultMeta());
    const initAtk = hero.atk;
    const { levelsGained } = grantRewards(hero, 50, 30);
    expect(levelsGained).toBeGreaterThanOrEqual(2);
    expect(hero.atk).toBeGreaterThan(initAtk);
    // Traveler Tunic grants +15% Gold -> 30 * 1.15 = 35
    expect(hero.gold).toBe(35);
  });

  it('deals exact hero ATK damage per bump against 0-DEF mobs (no multi-hit instant kill)', () => {
    const meta = { ...defaultMeta(), ranks: { ...defaultMeta().ranks, atk: 7 } }; // 11 + 21 = 32 ATK
    const hero = createHeroStats(meta);
    hero.atk = 33;
    const goblin = { ...makeEnemy('goblin', 1), hp: 68 };
    expect(goblin.def).toBe(0);

    // Non-crit bump: 33 ATK deals exact 33 damage, leaving 35 HP
    const hit1 = resolveBumpClash(hero, goblin.hp, goblin, () => 0.99);
    expect(hit1.oneShot).toBe(false);
    expect(hit1.enemyDefeated).toBe(false);
    expect(hit1.enemyDamageDealt).toBe(33);
    expect(hit1.remainingEnemyHp).toBe(35);
  });

  it('ascends any owned gear to endgame stats only after all gear in that category is owned', () => {
    for (const w of WEAPON_CATALOG) {
      expect(w.unlockCost + weaponAscendCost(w.id)).toBe(ENDGAME_WEAPON_COST);
    }
    for (const a of ARMOR_CATALOG) {
      expect(a.unlockCost + armorAscendCost(a.id)).toBe(ENDGAME_ARMOR_COST);
    }
    for (const s of SHIELD_CATALOG) {
      expect(s.unlockCost + shieldAscendCost(s.id)).toBe(ENDGAME_SHIELD_COST);
    }

    // Locked before owning all gear in category
    let meta = { ...defaultMeta(), crystals: 3000 };
    expect(ascendWeapon(meta, 'wood')).toBeNull();
    expect(ascendArmor(meta, 'tunic')).toBeNull();

    // Unlocked once all weapons/armors/shields are owned
    meta = {
      ...meta,
      ownedWeapons: WEAPON_CATALOG.map((w) => w.id),
      ownedArmors: ARMOR_CATALOG.map((a) => a.id),
      ownedShields: SHIELD_CATALOG.map((s) => s.id),
    };
    meta = ascendWeapon(meta, 'wood')!;
    expect(meta.crystals).toBe(3000 - ENDGAME_WEAPON_COST);
    expect(effectiveWeaponStats('wood', true)).toEqual(effectiveWeaponStats('excalibur', false));

    meta = ascendArmor(meta, 'tunic')!;
    expect(effectiveArmorStats('tunic', true)).toEqual(effectiveArmorStats('aegis', false));

    meta = ascendShield(meta, 'buckler')!;
    expect(effectiveShieldStats('buckler', true)).toEqual(effectiveShieldStats('aegisShield', false));
  });

  it('polishes weapon and armor up to LV MAX and charges gold for inn heal', () => {
    const hero = createHeroStats(defaultMeta());
    hero.gold = 999;
    let hitMaxW = false;
    for (let i = 0; i < MAX_POLISH_LV; i++) {
      const r = polishWeapon(hero);
      expect(r.ok).toBe(true);
      hitMaxW = r.hitMax;
    }
    expect(hitMaxW).toBe(true);
    expect(polishWeapon(hero).ok).toBe(false);
    expect(totalAtk(hero)).toBeGreaterThan(hero.atk);

    let hitMaxA = false;
    for (let i = 0; i < MAX_POLISH_LV; i++) {
      const r = polishArmor(hero);
      expect(r.ok).toBe(true);
      hitMaxA = r.hitMax;
    }
    expect(hitMaxA).toBe(true);
    expect(totalDef(hero)).toBeGreaterThan(hero.def);

    // Paid inn heal: rejects at full HP, heals when damaged
    expect(buyInnHeal(hero)).toBe(false);
    hero.hp = 10;
    const beforeGold = hero.gold;
    expect(buyInnHeal(hero)).toBe(true);
    expect(hero.hp).toBe(hero.maxHp);
    expect(hero.gold).toBeLessThan(beforeGold);

    // Battle Elixir gold sink scales Boss DMG multiplier
    hero.gold = 500;
    expect(buyBattleElixir(hero, 1)).toBe(true);
    expect(buyBattleElixir(hero, 1)).toBe(true);
    expect(bossBonusDamageMult(hero)).toBeCloseTo(1.3, 5);
  });

  it('deals 1.5x crit damage and reduced counter-damage when dash-slashing the boss', () => {
    const hero = createHeroStats({ ...defaultMeta(), ranks: { ...defaultMeta().ranks, atk: 6, def: 4 } });
    const boss = makeEnemy('demonLord', 1);
    const normal = resolveBossDashHit(hero, boss.hp, boss, false, 0, () => 0.99);
    const dash = resolveBossDashHit(hero, boss.hp, boss, true, 0, () => 0.99);
    expect(dash.dmgToBoss).toBeGreaterThan(normal.dmgToBoss);
    expect(dash.dmgToHero).toBeLessThanOrEqual(normal.dmgToHero);

    // Deterministic crit + evasion check
    const lucky = resolveBossDashHit(hero, boss.hp, boss, true, 0, () => 0.0);
    expect(lucky.critTriggered).toBe(true);
    expect(lucky.evaded).toBe(true);
    expect(lucky.dmgToHero).toBe(0);
  });

  it('flags canEasilyBeatBoss false at level 1 and true when well-geared', () => {
    const boss = makeEnemy('demonLord', 1);
    const lv1 = createHeroStats(defaultMeta());
    expect(canEasilyBeatBoss(lv1, boss.hp, boss)).toBe(false);

    const geared = createHeroStats({
      ...defaultMeta(),
      equippedWeapon: 'excalibur',
      equippedArmor: 'dragon',
      ranks: { ...defaultMeta().ranks, atk: 5, def: 5, startLv: 5 },
    });
    expect(canEasilyBeatBoss(geared, boss.hp, boss)).toBe(true);
  });
});
