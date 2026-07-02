import type { ChallengePhrase } from '../types';

export const CHALLENGE_PHRASES: ChallengePhrase[] = [
  {
    id: 'phrase_vega_speedrun',
    name: '鐵拳極速戰',
    description: '在 5 回合內擊敗鐵拳 Vega。',
    unlockStageId: '1-5',
    constraint: { type: 'turnLimit', turnLimit: 5 },
    reward: { currencyBonus: 280 },
  },
  {
    id: 'phrase_crow_speedrun',
    name: '影鴉獵殺令',
    description: '在 8 回合內擊敗影鴉 Crow。',
    unlockStageId: '2-5',
    constraint: { type: 'turnLimit', turnLimit: 8 },
    reward: { currencyBonus: 260 },
  },
  {
    id: 'phrase_zora_purist',
    name: '聖女純武鬥',
    description: '只能使用普通攻擊與防禦擊敗廢土聖女 Zora，禁止使用技能。',
    unlockStageId: '3-5',
    constraint: { type: 'physicalOnly' },
    reward: { currencyBonus: 320 },
  },
  {
    id: 'phrase_dex_purist',
    name: '鐵壁徒手挑戰',
    description: '只能使用普通攻擊與防禦擊敗鐵壁 Dex，禁止使用技能。',
    unlockStageId: '4-5',
    constraint: { type: 'physicalOnly' },
    reward: { currencyBonus: 400 },
  },
];
