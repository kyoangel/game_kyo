import { describe, it, expect } from 'vitest';
import { chooseTarget } from '../../src/battle/AI';
import type { Character } from '../../src/types';

function makeChar(id: string, hp: number, atk = 10, alive = true): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp: 100, atk, def: 5, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive, defending: false, activeBuffs: [],
  };
}

describe('chooseTarget', () => {
  it('default (no aiType) returns an alive character', () => {
    const chars = [makeChar('a', 80), makeChar('b', 30), makeChar('c', 50)];
    const result = chooseTarget(chars);
    expect(result).not.toBeNull();
    expect(result!.alive).toBe(true);
  });

  it('default skips dead characters', () => {
    const chars = [makeChar('dead', 10, 10, false), makeChar('alive', 60)];
    expect(chooseTarget(chars)?.id).toBe('alive');
  });

  it('returns null when all are dead', () => {
    const chars = [makeChar('a', 10, 10, false)];
    expect(chooseTarget(chars)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(chooseTarget([])).toBeNull();
  });

  it('lowest-hp aiType returns the alive character with least HP', () => {
    const chars = [makeChar('a', 80), makeChar('b', 30), makeChar('c', 50)];
    expect(chooseTarget(chars, 'lowest-hp')?.id).toBe('b');
  });

  it('lowest-hp skips dead characters', () => {
    const chars = [makeChar('dead', 5, 10, false), makeChar('alive', 60)];
    expect(chooseTarget(chars, 'lowest-hp')?.id).toBe('alive');
  });

  it('highest-atk aiType returns the alive character with most ATK', () => {
    const chars = [makeChar('a', 50, 20), makeChar('b', 50, 35), makeChar('c', 50, 10)];
    expect(chooseTarget(chars, 'highest-atk')?.id).toBe('b');
  });
});
