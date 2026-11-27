/**
 * Modular feature toggles (Two-Way Door).
 * Flip any flag to `false` to cleanly disable that mechanic & its UI without breaking the rest of the game.
 */
export const FEATURES = {
  preRunBoosts: true,
  shieldsAnd2H: true,
  critAndEvasion: true,
  bossCombo: true,
  mapPois: true,
  chapterSelect: true,
} as const;

export type SpeedrunMedal = 'S' | 'A' | 'B';

export function medalForTimeLeft(timeLeft: number): SpeedrunMedal {
  if (timeLeft >= 12) return 'S';
  if (timeLeft >= 6) return 'A';
  return 'B';
}

export function medalRank(m: SpeedrunMedal | undefined): number {
  return m === 'S' ? 3 : m === 'A' ? 2 : m === 'B' ? 1 : 0;
}

/**
 * Centralized, reversible balance configuration (Two-Way Door).
 * Tune any curve here and run `npx vitest run games/chrono-rush` to verify Loop 1..15 remains fair & beatable.
 */
export const BALANCE = {
  baseRunSeconds: 30,
  reviveBonusSeconds: 10,
  timeUpgradeSecPerRank: 3, // Chrono Hourglass: +3s per rank (max 5 -> 45s)

  // Skin Mastery bonus: rewards collecting LV 5 polished skins without breaking late-game math
  weaponSkinAtkPct: 0.04, // +4% ATK per unlocked weapon skin (max 7 -> +28%)
  armorSkinDefHpPct: 0.04, // +4% DEF & Max HP per unlocked armor skin (max 7 -> +28%)

  // Boss Arena Combo: consecutive hits without taking fireball damage
  bossComboStep: 0.2, // +20% damage per streak hit
  bossComboMaxMult: 2.0, // cap at 2.0x (Excalibur heroic raises to 2.5x)

  // Piercing damage floors so DEF helps greatly, yet Boss hits & fireballs always stay dangerous
  bossMeleeMinAtkRatio: 0.2,
  bossFireballMinAtkRatio: 0.22,
  mobMinAtkRatio: 0.15,

  // Progressive Loop 1..50+ Boss curve (0 DEF so hero ATK = transparent damage; HP & ATK accelerate in Cycle 2+)
  bossHp: (loop: number): number => Math.round(360 + (loop - 1) * 260 + Math.pow(Math.max(0, loop - 1), 1.65) * 42),
  bossAtk: (loop: number): number => Math.round(36 + (loop - 1) * 18 + Math.pow(Math.max(0, loop - 1), 1.35) * 3.5),
  bossDef: (_loop: number): number => 0,

  // Overworld mob scaling (smooth early-mid curve so Loop 1..8 stay snappy, accelerating in Loop 10+)
  mobStatScale: (loop: number): number => 1 + (loop - 1) * 0.25 + Math.pow(Math.max(0, loop - 1), 1.55) * 0.032,
  mobRewardScale: (loop: number): number => 1 + (loop - 1) * 0.28,

  // Crystal economy (sqrt curve prevents runaway inflation at Loop 15+)
  crystalPerLevel: 1.0,
  crystalPerKill: 0.6,
  crystalBossDamageMax: 14,
  crystalBossClear: (loop: number): number => 16 + Math.round(Math.sqrt(Math.max(1, loop)) * 16),
  greedBonusPerRank: 0.12,
} as const;

export type DefeatTipKey =
  | 'tip.buyArmor'
  | 'tip.buyWeapon'
  | 'tip.buySpeed'
  | 'tip.buyTime'
  | 'tip.unlockSkins'
  | 'tip.polishGear'
  | 'tip.dodgeCombo';

export interface DefeatDiagnosisInput {
  reason: 'victory' | 'timeUp' | 'defeated';
  bossHpRatio: number;
  weaponPolishLv: number;
  armorPolishLv: number;
  ownedWeaponsCount: number;
  ownedArmorsCount: number;
  unlockedSkinsCount: number;
  atkRank: number;
  defRank: number;
  spdRank: number;
  timeRank: number;
}

/** Suggests the single most helpful upgrade or tactic based on how the run ended. */
export function diagnoseDefeat(input: DefeatDiagnosisInput): DefeatTipKey | null {
  if (input.reason === 'victory') return null;

  if (input.reason === 'defeated') {
    if (input.armorPolishLv < 3) return 'tip.polishGear';
    if (input.defRank < 6 || input.ownedArmorsCount < 3) return 'tip.buyArmor';
    if (input.unlockedSkinsCount < 4) return 'tip.unlockSkins';
    return 'tip.dodgeCombo';
  }

  // reason === 'timeUp'
  if (input.bossHpRatio >= 0.99) {
    // Didn't reach or barely touched the Boss
    return input.spdRank <= input.timeRank ? 'tip.buySpeed' : 'tip.buyTime';
  }
  if (input.weaponPolishLv < 3) return 'tip.polishGear';
  if (input.atkRank < 6 || input.ownedWeaponsCount < 3) return 'tip.buyWeapon';
  if (input.timeRank < 3) return 'tip.buyTime';
  if (input.unlockedSkinsCount < 4) return 'tip.unlockSkins';
  return 'tip.dodgeCombo';
}
