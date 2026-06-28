import type { Character } from '../types';

export interface TurnOrderStripEntry {
  characterId: string;
  isPlayer: boolean;
  isActive: boolean;
}

export function buildTurnOrderStrip(chars: Character[], currentIndex: number): TurnOrderStripEntry[] {
  const count = Math.min(chars.length, 5);
  const result: TurnOrderStripEntry[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (currentIndex + i) % chars.length;
    const char = chars[idx];
    result.push({
      characterId: char.id,
      isPlayer: char.isPlayer,
      isActive: i === 0,
    });
  }
  return result;
}
