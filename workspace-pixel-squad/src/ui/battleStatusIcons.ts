import type { Character, StatusEffectType } from '../types';

export interface StatusIconEntry {
  type: StatusEffectType;
  turnsRemaining: number;
  icon: string;
  color: string;
}

const STATUS_ICONS: Record<StatusEffectType, { icon: string; color: string }> = {
  poison: { icon: '☠', color: '#4ade80' },
  burn: { icon: '🔥', color: '#f97316' },
  freeze: { icon: '❄', color: '#67e8f9' },
  stun: { icon: '⚡', color: '#fbbf24' },
};

export function getStatusIconData(char: Character): StatusIconEntry[] {
  return char.activeStatusEffects.map(effect => ({
    type: effect.type,
    turnsRemaining: effect.turnsRemaining,
    icon: STATUS_ICONS[effect.type].icon,
    color: STATUS_ICONS[effect.type].color,
  }));
}
