import type { Stage } from '../types';

export const STAGES: Stage[] = [
  {
    id: 'stage_1',
    name: '廢城入口',
    enemies: [
      {
        id: 'mutant',
        name: '變種人',
        baseStats: { hp: 60, atk: 15, def: 5, spd: 8 },
        skillIds: [],
      },
    ],
    expReward: 40,
  },
  {
    id: 'stage_2',
    name: '破敗工廠',
    enemies: [
      {
        id: 'raider',
        name: '掠奪者',
        baseStats: { hp: 80, atk: 20, def: 8, spd: 12 },
        skillIds: [],
      },
      {
        id: 'raider_captain',
        name: '掠奪者隊長',
        baseStats: { hp: 110, atk: 26, def: 14, spd: 10 },
        skillIds: [],
      },
    ],
    expReward: 80,
  },
  {
    id: 'stage_3',
    name: '廢土指揮所',
    enemies: [
      {
        id: 'soldier_a',
        name: '廢土兵',
        baseStats: { hp: 90, atk: 22, def: 15, spd: 10 },
        skillIds: [],
      },
      {
        id: 'soldier_b',
        name: '廢土兵',
        baseStats: { hp: 90, atk: 22, def: 15, spd: 10 },
        skillIds: [],
      },
      {
        id: 'commander',
        name: '廢土指揮官',
        baseStats: { hp: 180, atk: 35, def: 20, spd: 14 },
        skillIds: [],
      },
    ],
    expReward: 130,
  },
];
