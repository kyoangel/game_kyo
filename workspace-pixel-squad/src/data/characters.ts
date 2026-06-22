import type { CharacterTemplate } from '../types';

export const PLAYER_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'protagonist',
    name: '倖存者',
    isProtagonist: true,
    baseStats: { hp: 100, atk: 25, def: 10, spd: 15 },
    skillIds: ['burst_shot'],
    statGrowth: { hp: 0, atk: 0, def: 0, spd: 0 },
  },
  {
    id: 'rex',
    name: 'Rex',
    isProtagonist: false,
    baseStats: { hp: 150, atk: 15, def: 25, spd: 8 },
    skillIds: ['shield_bash'],
    statGrowth: { hp: 12, atk: 2, def: 4, spd: 1 },
  },
  {
    id: 'nyx',
    name: 'Nyx',
    isProtagonist: false,
    baseStats: { hp: 70, atk: 30, def: 8, spd: 22 },
    skillIds: ['swift_strike'],
    statGrowth: { hp: 5, atk: 5, def: 1, spd: 3 },
  },
];
