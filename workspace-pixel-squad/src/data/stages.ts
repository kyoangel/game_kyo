import type { Stage } from '../types';

export const STAGES: Stage[] = [
  // ── Chapter 1: 廢城遺跡 ──────────────────────────────────────────────────
  {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [{ id: 'mutant', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [] }],
    expReward: 40, currencyReward: 20,
  },
  {
    id: '1-2', chapterId: 'ch1', name: '地下水道', stageIndex: 1,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'rex',
    enemies: [
      { id: 'mutant_a', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [] },
      { id: 'mutant_b', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [] },
    ],
    expReward: 60, currencyReward: 30,
  },
  {
    id: '1-3', chapterId: 'ch1', name: '廢棄醫院', stageIndex: 2,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'wolf_a', name: '野狼突變種', baseStats: { hp: 75, atk: 18, def: 6, spd: 12 }, skillIds: [] },
      { id: 'wolf_b', name: '野狼突變種', baseStats: { hp: 75, atk: 18, def: 6, spd: 12 }, skillIds: [] },
    ],
    expReward: 80, currencyReward: 40,
  },
  {
    id: '1-4', chapterId: 'ch1', name: '工廠廢墟', stageIndex: 3,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'nyx',
    enemies: [
      { id: 'raider', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_sniper', name: '掠奪者狙擊手', baseStats: { hp: 65, atk: 24, def: 5, spd: 16 }, skillIds: [] },
    ],
    expReward: 90, currencyReward: 45,
  },
  {
    id: '1-5', chapterId: 'ch1', name: '[BOSS] 鐵拳 Vega', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'vega',
    enemies: [{ id: 'vega', name: 'Vega', baseStats: { hp: 200, atk: 35, def: 15, spd: 14 }, skillIds: [] }],
    expReward: 120, currencyReward: 80,
  },

  // ── Chapter 2: 破敗工廠 ──────────────────────────────────────────────────
  {
    id: '2-1', chapterId: 'ch2', name: '機械墓場', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'waste_dog', name: '廢土狗', baseStats: { hp: 40, atk: 12, def: 3, spd: 18 }, skillIds: [] },
    ],
    expReward: 100, currencyReward: 50,
  },
  {
    id: '2-2', chapterId: 'ch2', name: '鐵皮貧民窟', stageIndex: 1,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'ash',
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_c', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
    ],
    expReward: 110, currencyReward: 55,
  },
  {
    id: '2-3', chapterId: 'ch2', name: '地下賭場', stageIndex: 2,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_cap', name: '掠奪者隊長', baseStats: { hp: 130, atk: 28, def: 16, spd: 11 }, skillIds: [] },
    ],
    expReward: 130, currencyReward: 65,
  },
  {
    id: '2-4', chapterId: 'ch2', name: '工廠心臟', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'mech_a', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_b', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'soldier', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
    ],
    expReward: 150, currencyReward: 75,
  },
  {
    id: '2-5', chapterId: 'ch2', name: '[BOSS] 影鴉 Crow', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'crow',
    enemies: [{ id: 'crow', name: 'Crow', baseStats: { hp: 220, atk: 38, def: 12, spd: 22 }, skillIds: [] }],
    expReward: 180, currencyReward: 120,
  },

  // ── Chapter 3: 輻射荒原 ──────────────────────────────────────────────────
  {
    id: '3-1', chapterId: 'ch3', name: '輻射邊境', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'beast_a', name: '變異獸', baseStats: { hp: 95, atk: 26, def: 10, spd: 14 }, skillIds: [] },
      { id: 'beast_b', name: '變異獸', baseStats: { hp: 95, atk: 26, def: 10, spd: 14 }, skillIds: [] },
      { id: 'beast_c', name: '變異獸', baseStats: { hp: 95, atk: 26, def: 10, spd: 14 }, skillIds: [] },
    ],
    expReward: 160, currencyReward: 80,
  },
  {
    id: '3-2', chapterId: 'ch3', name: '廢棄研究站', stageIndex: 1,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'soldier_a', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'soldier_b', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'franken', name: '科學怪人', baseStats: { hp: 140, atk: 30, def: 18, spd: 8 }, skillIds: [] },
    ],
    expReward: 180, currencyReward: 90,
  },
  {
    id: '3-3', chapterId: 'ch3', name: '地雷陣', stageIndex: 2,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'mira',
    enemies: [
      { id: 'soldier_a', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'soldier_b', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'soldier_c', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'bomber', name: '爆破兵', baseStats: { hp: 80, atk: 32, def: 8, spd: 13 }, skillIds: [] },
    ],
    expReward: 200, currencyReward: 100,
  },
  {
    id: '3-4', chapterId: 'ch3', name: '指揮塔', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_a', name: '精英廢土兵', baseStats: { hp: 120, atk: 28, def: 18, spd: 12 }, skillIds: [] },
      { id: 'elite_b', name: '精英廢土兵', baseStats: { hp: 120, atk: 28, def: 18, spd: 12 }, skillIds: [] },
      { id: 'sniper', name: '廢土狙擊手', baseStats: { hp: 90, atk: 36, def: 10, spd: 20 }, skillIds: [] },
    ],
    expReward: 220, currencyReward: 110,
  },
  {
    id: '3-5', chapterId: 'ch3', name: '[BOSS] 廢土聖女 Zora', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'zora',
    enemies: [{ id: 'zora', name: 'Zora', baseStats: { hp: 260, atk: 32, def: 25, spd: 16 }, skillIds: [] }],
    expReward: 260, currencyReward: 160,
  },

  // ── Chapter 4: 機械廢都 ──────────────────────────────────────────────────
  {
    id: '4-1', chapterId: 'ch4', name: '金屬廢墟', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'mech_a', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_b', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'em_spider', name: '電磁蜘蛛', baseStats: { hp: 70, atk: 20, def: 14, spd: 20 }, skillIds: [] },
    ],
    expReward: 240, currencyReward: 120,
  },
  {
    id: '4-2', chapterId: 'ch4', name: '鑄造廠', stageIndex: 1,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'rook',
    enemies: [
      { id: 'mech_a', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_b', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_c', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'forge_bot', name: '鑄造機器人', baseStats: { hp: 160, atk: 28, def: 25, spd: 7 }, skillIds: [] },
    ],
    expReward: 260, currencyReward: 130,
  },
  {
    id: '4-3', chapterId: 'ch4', name: '數據中心', stageIndex: 2,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'em_guard_a', name: '電磁守衛', baseStats: { hp: 130, atk: 32, def: 22, spd: 14 }, skillIds: [] },
      { id: 'em_guard_b', name: '電磁守衛', baseStats: { hp: 130, atk: 32, def: 22, spd: 14 }, skillIds: [] },
      { id: 'mech_soldier', name: '機械兵', baseStats: { hp: 100, atk: 26, def: 18, spd: 12 }, skillIds: [] },
    ],
    expReward: 280, currencyReward: 140,
  },
  {
    id: '4-4', chapterId: 'ch4', name: '核心艙', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_mech_a', name: '精英機械兵', baseStats: { hp: 150, atk: 34, def: 24, spd: 14 }, skillIds: [] },
      { id: 'elite_mech_b', name: '精英機械兵', baseStats: { hp: 150, atk: 34, def: 24, spd: 14 }, skillIds: [] },
      { id: 'elite_mech_c', name: '精英機械兵', baseStats: { hp: 150, atk: 34, def: 24, spd: 14 }, skillIds: [] },
    ],
    expReward: 300, currencyReward: 150,
  },
  {
    id: '4-5', chapterId: 'ch4', name: '[BOSS] 鐵壁 Dex', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'dex',
    enemies: [{ id: 'dex', name: 'Dex', baseStats: { hp: 400, atk: 40, def: 35, spd: 10 }, skillIds: [] }],
    expReward: 340, currencyReward: 200,
  },

  // ── Chapter 5: 亡靈禁地 ──────────────────────────────────────────────────
  {
    id: '5-1', chapterId: 'ch5', name: '禁忌邊境', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_a', name: '精英廢土兵', baseStats: { hp: 140, atk: 32, def: 20, spd: 14 }, skillIds: [] },
      { id: 'elite_b', name: '精英廢土兵', baseStats: { hp: 140, atk: 32, def: 20, spd: 14 }, skillIds: [] },
      { id: 'elite_c', name: '精英廢土兵', baseStats: { hp: 140, atk: 32, def: 20, spd: 14 }, skillIds: [] },
    ],
    expReward: 320, currencyReward: 160,
  },
  {
    id: '5-2', chapterId: 'ch5', name: '古代遺跡', stageIndex: 1,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'ruin_guard_a', name: '遺跡守衛', baseStats: { hp: 160, atk: 30, def: 28, spd: 10 }, skillIds: [] },
      { id: 'ruin_guard_b', name: '遺跡守衛', baseStats: { hp: 160, atk: 30, def: 28, spd: 10 }, skillIds: [] },
      { id: 'gargoyle', name: '石像怪', baseStats: { hp: 220, atk: 35, def: 30, spd: 6 }, skillIds: [] },
    ],
    expReward: 360, currencyReward: 180,
  },
  {
    id: '5-3', chapterId: 'ch5', name: '暗影神殿', stageIndex: 2,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'echo',
    enemies: [
      { id: 'shadow_a', name: '暗影刺客', baseStats: { hp: 100, atk: 40, def: 12, spd: 24 }, skillIds: [] },
      { id: 'shadow_b', name: '暗影刺客', baseStats: { hp: 100, atk: 40, def: 12, spd: 24 }, skillIds: [] },
      { id: 'shadow_c', name: '暗影刺客', baseStats: { hp: 100, atk: 40, def: 12, spd: 24 }, skillIds: [] },
    ],
    expReward: 380, currencyReward: 190,
  },
  {
    id: '5-4', chapterId: 'ch5', name: '絕頂天台', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_guard_a', name: '精英守衛', baseStats: { hp: 180, atk: 36, def: 26, spd: 14 }, skillIds: [] },
      { id: 'elite_guard_b', name: '精英守衛', baseStats: { hp: 180, atk: 36, def: 26, spd: 14 }, skillIds: [] },
      { id: 'top_samurai', name: '頂尖武士', baseStats: { hp: 200, atk: 42, def: 28, spd: 18 }, skillIds: [] },
    ],
    expReward: 420, currencyReward: 210,
  },
  {
    id: '5-5', chapterId: 'ch5', name: '[BOSS] AAAA', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'aaaa',
    enemies: [{ id: 'aaaa', name: 'AAAA', baseStats: { hp: 600, atk: 50, def: 40, spd: 20 }, skillIds: [] }],
    expReward: 500, currencyReward: 300,
  },

  // ── Side Quests ──────────────────────────────────────────────────────────
  {
    id: 'SQ-1', chapterId: 'sq', name: '廢土競技場', stageIndex: 0,
    isBoss: false, isSideQuest: true, unlockAfterStageId: '1-5',
    enemies: [
      { id: 'arena_a', name: '競技場鬥士', baseStats: { hp: 90, atk: 22, def: 10, spd: 14 }, skillIds: [] },
      { id: 'arena_b', name: '競技場鬥士', baseStats: { hp: 90, atk: 22, def: 10, spd: 14 }, skillIds: [] },
      { id: 'arena_c', name: '競技場鬥士', baseStats: { hp: 90, atk: 22, def: 10, spd: 14 }, skillIds: [] },
      { id: 'arena_champ', name: '競技場冠軍', baseStats: { hp: 150, atk: 30, def: 15, spd: 12 }, skillIds: [] },
    ],
    expReward: 160, currencyReward: 200,
  },
  {
    id: 'SQ-2', chapterId: 'sq', name: '黑市突襲', stageIndex: 0,
    isBoss: false, isSideQuest: true, unlockAfterStageId: '2-3',
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'market_boss', name: '黑市老大', baseStats: { hp: 170, atk: 32, def: 18, spd: 13 }, skillIds: [] },
    ],
    expReward: 220, currencyReward: 280,
  },
  {
    id: 'SQ-3', chapterId: 'sq', name: '古代遺跡探索', stageIndex: 0,
    isBoss: false, isSideQuest: true, unlockAfterStageId: '3-5',
    enemies: [
      { id: 'ancient_a', name: '古代守護者', baseStats: { hp: 200, atk: 34, def: 30, spd: 8 }, skillIds: [] },
      { id: 'ancient_b', name: '古代守護者', baseStats: { hp: 200, atk: 34, def: 30, spd: 8 }, skillIds: [] },
      { id: 'ruin_deity', name: '遺跡主神', baseStats: { hp: 300, atk: 38, def: 35, spd: 10 }, skillIds: [] },
    ],
    expReward: 360, currencyReward: 350,
  },
];
