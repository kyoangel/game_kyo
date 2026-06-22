import { describe, it, expect } from 'vitest';
import { chooseTarget } from '../../src/battle/AI';
import type { Character } from '../../src/types';

function makeChar(id: string, hp: number, alive = true): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp: 100, atk: 10, def: 5, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive, defending: false,
  };
}

describe('chooseTarget', () => {
  it('targets the alive character with the lowest HP', () => {
    const chars = [makeChar('a', 80), makeChar('b', 30), makeChar('c', 50)];
    expect(chooseTarget(chars)?.id).toBe('b');
  });

  it('skips dead characters', () => {
    const chars = [makeChar('dead', 10, false), makeChar('alive', 60)];
    expect(chooseTarget(chars)?.id).toBe('alive');
  });

  it('returns null when all are dead', () => {
    const chars = [makeChar('a', 10, false)];
    expect(chooseTarget(chars)).toBeNull();
  });

  it('returns the only alive character when there is one', () => {
    expect(chooseTarget([makeChar('solo', 100)])?.id).toBe('solo');
  });
});
