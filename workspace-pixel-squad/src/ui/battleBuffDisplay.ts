import type { Character, ActiveBuff } from '../types';

export interface BuffIconEntry {
  stat: string;
  turnsRemaining: number;
  label: string;
}

const STAT_LABELS: Record<string, string> = {
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
};

export function getBuffIconData(char: Character): BuffIconEntry[] {
  return char.activeBuffs.slice(0, 4).map((buff: ActiveBuff) => ({
    stat: buff.stat,
    turnsRemaining: buff.turnsRemaining,
    label: STAT_LABELS[buff.stat] ?? buff.stat.toUpperCase(),
  }));
}
