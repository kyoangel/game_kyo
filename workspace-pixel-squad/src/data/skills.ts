import type { Skill } from '../types';

export const SKILLS: Record<string, Skill> = {
  burst_shot: {
    id: 'burst_shot',
    name: '爆發射擊',
    type: 'attack',
    multiplier: 1.5,
    description: 'ATK × 1.5 的傷害',
  },
  shield_bash: {
    id: 'shield_bash',
    name: '盾擊',
    type: 'attack',
    multiplier: 1.2,
    description: 'ATK × 1.2 的傷害',
  },
  swift_strike: {
    id: 'swift_strike',
    name: '迅捷突刺',
    type: 'attack',
    multiplier: 1.3,
    description: 'ATK × 1.3 的傷害',
  },
};
