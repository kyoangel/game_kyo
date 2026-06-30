import type { BossConfig } from '../battle/BossAI';

export const BOSS_CONFIGS: Record<string, BossConfig> = {
  vega: {
    templateId: 'vega',
    phases: [
      { hpThreshold: 1.0, aiType: 'normal' },
      { hpThreshold: 0.5, aiType: 'aggressive', message: '「你逼我的！」', weaknessOverride: 'ice' },
      { hpThreshold: 0.2, aiType: 'berserk',    message: '「我不會倒下的！」' },
    ],
  },
  crow: {
    templateId: 'crow',
    phases: [
      { hpThreshold: 1.0, aiType: 'normal' },
      { hpThreshold: 0.6, aiType: 'defensive',  message: '「有趣，讓我認真一點。」', weaknessOverride: 'thunder' },
      { hpThreshold: 0.3, aiType: 'aggressive', message: '「夠了，遊戲結束。」' },
    ],
  },
  zora: {
    templateId: 'zora',
    phases: [
      { hpThreshold: 1.0, aiType: 'defensive' },
      { hpThreshold: 0.5, aiType: 'normal',     message: '「你比我想的更頑強。」', weaknessOverride: 'fire' },
      { hpThreshold: 0.25, aiType: 'aggressive', message: '「神明保佑我！」' },
    ],
  },
  dex: {
    templateId: 'dex',
    phases: [
      { hpThreshold: 1.0,  aiType: 'defensive' },
      { hpThreshold: 0.7,  aiType: 'normal',      message: '「不錯，繼續。」' },
      { hpThreshold: 0.4,  aiType: 'aggressive',  message: '「鎧甲脫了，真的開始了。」', weaknessOverride: 'toxin' },
      { hpThreshold: 0.15, aiType: 'berserk',     message: '「這就是最強的我！」' },
    ],
  },
  aaaa: {
    templateId: 'aaaa',
    phases: [
      { hpThreshold: 1.0, aiType: 'aggressive' },
      { hpThreshold: 0.6, aiType: 'berserk',      message: '「...」', weaknessOverride: 'ice' },
      { hpThreshold: 0.3, aiType: 'desperation',  message: '「...不可能...」' },
      { hpThreshold: 0.1, aiType: 'desperation',  message: '「我不會輸的...！」' },
    ],
  },
};
