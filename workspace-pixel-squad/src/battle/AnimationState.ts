import type { Skill } from '../types';

export type AnimState = 'idle' | 'walk' | 'attack' | 'hit' | 'die' | 'skill';

export interface AnimRequest {
  state: AnimState;
  facing: 'left' | 'right';
  isCrit?: boolean;
  flashTint?: 'white' | 'green' | 'blue';
}

export const ANIM_STATES: AnimState[] = ['idle', 'walk', 'attack', 'hit', 'die', 'skill'];

export const WALK_CONFIG = {
  stepPx: 24,
  forwardDuration: 220,
  returnDuration: 220,
} as const;

export const ATTACK_CONFIG = {
  frameCount: 6,
  frameDuration: 60,
  totalDuration: 360,
} as const;

export const IDLE_CONFIG = {
  rect: {
    breathingScaleY: 1.03,
    breathingDuration: 1200,
    yoyo: true,
  },
} as const;

export const HIT_CONFIG = {
  tintColor: 0xff0000,
  flashAlpha: 0.6,
  flashDuration: 200,
  shakeAmplitude: 6,
  shakeOscillations: 3,
  shakeDuration: 220,
} as const;

export const CRIT_HIT_CONFIG = {
  tintColor: 0xff0000,
  flashAlpha: 0.85,
  flashDuration: 280,
  shakeOscillations: 4,
} as const;

export const DIE_CONFIG = {
  sprite: {
    frameCount: 6,
    frameDuration: 80,
    totalDuration: 480,
    settleAlpha: 0.3,
  },
  rect: {
    totalDuration: 480,
    settleAlpha: 0.2,
    rotationDeg: 8,
  },
} as const;

export const SKILL_CAST_CONFIG = {
  flashDuration: 250,
} as const;

export function deriveFacing(isPlayer: boolean): 'left' | 'right' {
  return isPlayer ? 'right' : 'left';
}

export function deriveFlashTint(skill: Skill): 'white' | 'green' | 'blue' {
  if (skill.type === 'heal') return 'blue';
  if (skill.type === 'buff') return 'green';
  return 'white';
}
