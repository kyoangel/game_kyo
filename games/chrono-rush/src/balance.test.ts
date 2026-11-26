import { describe, expect, it } from 'vitest';
import { diagnoseDefeat } from './balance.ts';
import { getChapterForLoop, getCycleForLoop, getLoopForCycleCell, resolveObstacleCollision } from './chapters.ts';
import { ARMOR_CATALOG, MAX_POLISH_LV, WEAPON_CATALOG } from './gear.ts';
import { computeCrystalReward, defaultMeta, type MetaSave } from './meta.ts';
import { bossFireballDamage, createHeroStats, grantRewards, makeEnemy, resolveBossDashHit } from './systems.ts';

function simulateBossFight(meta: MetaSave, loop: number, targetLevel: number, polishLv: number) {
  const hero = createHeroStats(meta);
  while (hero.level < targetLevel) {
    grantRewards(hero, hero.xpToNext, 0);
  }
  hero.hp = hero.maxHp;
  hero.weaponPolishLv = polishLv;
  hero.armorPolishLv = polishLv;

  const boss = makeEnemy('demonLord', loop);
  let bossHp = boss.hp;
  let hits = 0;
  let survived = true;
  while (bossHp > 0 && hits < 25) {
    const res = resolveBossDashHit(hero, bossHp, boss, true, hits, () => 0.99);
    bossHp = res.remainingBossHp;
    hero.hp = Math.max(0, hero.hp - res.dmgToHero);
    hits += 1;
    if (!res.heroSurvived) {
      survived = false;
      break;
    }
  }
  return { defeated: bossHp <= 0, survived, hits, hpLeft: hero.hp, bossHp: boss.hp };
}

describe('chrono-rush 3 chapters (Loop 1..15) balance & structure', () => {
  const weapons = WEAPON_CATALOG.map((w) => w.id);
  const armors = ARMOR_CATALOG.map((a) => a.id);

  it('maps loops 1..25 into 5 distinct chapters and continues Roman numerals (VI..X) on cycle 2', () => {
    expect(getChapterForLoop(1)).toMatchObject({ chapter: { id: 'chrono-quest' }, roman: 'I', isFinale: false });
    expect(getChapterForLoop(5)).toMatchObject({ chapter: { id: 'chrono-quest' }, roman: 'V', isFinale: true });
    expect(getChapterForLoop(6)).toMatchObject({ chapter: { id: 'frost-chronicle' }, roman: 'I', isFinale: false });
    expect(getChapterForLoop(11)).toMatchObject({ chapter: { id: 'inferno-saga' }, roman: 'I', isFinale: false });
    expect(getChapterForLoop(16)).toMatchObject({ chapter: { id: 'cyber-neon' }, roman: 'I', isFinale: false });
    expect(getChapterForLoop(21)).toMatchObject({ chapter: { id: 'celestial-fall' }, roman: 'I', isFinale: false });
    expect(getChapterForLoop(25)).toMatchObject({ chapter: { id: 'celestial-fall' }, roman: 'V', isFinale: true });
    // Cycle 2 continues Roman numerals VI..X instead of repeating I..V!
    expect(getChapterForLoop(26)).toMatchObject({ chapter: { id: 'chrono-quest' }, chapterNumber: 6, roman: 'VI', isFinale: false });
    expect(getChapterForLoop(30)).toMatchObject({ chapter: { id: 'chrono-quest' }, chapterNumber: 6, roman: 'X', isFinale: true });
    expect(getChapterForLoop(50)).toMatchObject({ chapter: { id: 'celestial-fall' }, chapterNumber: 10, roman: 'X', isFinale: true });
    expect(getChapterForLoop(51)).toMatchObject({ chapter: { id: 'chrono-quest' }, chapterNumber: 11, roman: 'XI', isFinale: false });

    // Camp cycle paging helpers map seamlessly between loop numbers and (cycle, chapterOffset, ep) cells
    expect(getCycleForLoop(1)).toBe(0);
    expect(getCycleForLoop(25)).toBe(0);
    expect(getCycleForLoop(26)).toBe(1);
    expect(getCycleForLoop(50)).toBe(1);
    expect(getCycleForLoop(51)).toBe(2);
    expect(getLoopForCycleCell(0, 0, 1)).toBe(1);
    expect(getLoopForCycleCell(0, 4, 5)).toBe(25);
    expect(getLoopForCycleCell(1, 0, 1)).toBe(26);
    expect(getLoopForCycleCell(1, 4, 5)).toBe(50);
    expect(getLoopForCycleCell(2, 0, 1)).toBe(51);
  });

  it('pushes hero cleanly outside solid obstacles and canyon barriers', () => {
    const out = resolveObstacleCollision(110, 100, 18, [{ x: 100, y: 100, kind: 'tree-green', radius: 26 }]);
    expect(Math.hypot(out.x - 100, out.y - 100)).toBeGreaterThanOrEqual(43.9);

    const canyon = resolveObstacleCollision(650, 420, 18, [], [{ x: 560, y: 410, w: 800, h: 140, style: 'glacierCanyon' }]);
    expect(canyon.y).toBeLessThanOrEqual(410 - 18);
  });

  it('keeps Loop 1..15 cleanly beatable without unfair one-shots as player progresses', () => {
    for (let loop = 1; loop <= 15; loop++) {
      const tierIdx = Math.min(weapons.length - 1, Math.floor(((loop - 1) * weapons.length) / 15));
      const skinsCount = Math.min(weapons.length, Math.floor((loop * weapons.length) / 15));
      const meta: MetaSave = {
        ...defaultMeta(),
        loop,
        equippedWeapon: weapons[tierIdx],
        equippedArmor: armors[tierIdx],
        equippedShield: loop >= 3 ? 'kite' : null,
        ownedWeapons: weapons.slice(0, tierIdx + 1),
        ownedArmors: armors.slice(0, tierIdx + 1),
        ownedShields: loop >= 3 ? ['buckler', 'kite'] : [],
        unlockedWeaponSkins: weapons.slice(0, skinsCount),
        unlockedArmorSkins: armors.slice(0, skinsCount),
        ranks: {
          atk: Math.min(10, Math.ceil((loop * 10) / 15)),
          def: Math.min(10, Math.ceil((loop * 10) / 15)),
          spd: Math.min(8, Math.ceil((loop * 8) / 15)),
          xp: Math.min(8, Math.ceil((loop * 8) / 15)),
          gold: Math.min(8, Math.ceil((loop * 8) / 15)),
          startLv: Math.min(5, Math.floor((loop * 5) / 15)),
          time: Math.min(5, Math.floor((loop * 5) / 15)),
          crit: Math.min(8, Math.floor((loop * 8) / 15)),
          eva: Math.min(8, Math.floor((loop * 8) / 15)),
        },
      };

      const targetLv = 8 + loop;
      const polishLv = Math.min(MAX_POLISH_LV, 2 + Math.floor(loop / 3));
      const res = simulateBossFight(meta, loop, targetLv, polishLv);
      expect(res.defeated, `Loop ${loop} should be beatable`).toBe(true);
      expect(res.survived, `Loop ${loop} hero should survive boss counter-hits`).toBe(true);
      expect(res.hits, `Loop ${loop} should finish in <= 12 dash-slashes`).toBeLessThanOrEqual(12);
    }
  });

  it('keeps Loop 25 and Loop 50 genuinely dangerous even for a maxed-out endgame tank', () => {
    const maxedMeta: MetaSave = {
      ...defaultMeta(),
      loop: 25,
      equippedWeapon: 'excalibur',
      equippedArmor: 'aegis',
      equippedShield: 'aegisShield',
      ownedWeapons: weapons,
      ownedArmors: armors,
      ownedShields: ['buckler', 'kite', 'mirror', 'aegisShield'],
      unlockedWeaponSkins: weapons,
      unlockedArmorSkins: armors,
      ranks: { atk: 10, def: 10, spd: 8, xp: 8, gold: 8, startLv: 5, time: 5, crit: 8, eva: 8 },
    };
    const hero25 = createHeroStats(maxedMeta);
    hero25.weaponPolishLv = MAX_POLISH_LV;
    hero25.armorPolishLv = MAX_POLISH_LV;

    const boss25 = makeEnemy('demonLord', 25);
    const boss50 = makeEnemy('demonLord', 50);
    // Boss fireballs always deal meaningful piercing damage instead of 2-damage chip!
    expect(bossFireballDamage(hero25, boss25)).toBeGreaterThanOrEqual(120);
    expect(bossFireballDamage(hero25, boss50)).toBeGreaterThanOrEqual(300);
    // Loop 50 Boss HP is substantial enough to require combos/buffs/dodging
    expect(boss50.hp).toBeGreaterThanOrEqual(35000);
  });

  it('keeps crystal income paced with sqrt curve even at Loop 15 with maxed Greed Charm', () => {
    const loop7 = computeCrystalReward(
      { level: 18, kills: 15, bossHpRatio: 0, bossSlain: true, loop: 7 },
      { ...defaultMeta().ranks, gold: 2 },
    );
    expect(loop7).toBeGreaterThanOrEqual(80);
    expect(loop7).toBeLessThanOrEqual(160);

    const loop15MaxGreed = computeCrystalReward(
      { level: 26, kills: 20, bossHpRatio: 0, bossSlain: true, loop: 15 },
      { ...defaultMeta().ranks, gold: 8 },
    );
    expect(loop15MaxGreed).toBeLessThanOrEqual(280);
  });

  it('provides specific actionable coaching hints on defeat or timeout', () => {
    expect(
      diagnoseDefeat({
        reason: 'defeated',
        bossHpRatio: 0.4,
        weaponPolishLv: 4,
        armorPolishLv: 4,
        ownedWeaponsCount: 3,
        ownedArmorsCount: 1,
        unlockedSkinsCount: 2,
        atkRank: 5,
        defRank: 2,
        spdRank: 2,
        timeRank: 1,
      }),
    ).toBe('tip.buyArmor');

    expect(
      diagnoseDefeat({
        reason: 'victory',
        bossHpRatio: 0,
        weaponPolishLv: 5,
        armorPolishLv: 5,
        ownedWeaponsCount: 7,
        ownedArmorsCount: 7,
        unlockedSkinsCount: 14,
        atkRank: 10,
        defRank: 10,
        spdRank: 8,
        timeRank: 5,
      }),
    ).toBeNull();
  });
});
