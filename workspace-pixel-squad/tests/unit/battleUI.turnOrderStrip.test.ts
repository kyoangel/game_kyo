/**
 * AC-6: Battle — turn order strip
 * The strip shows the next 5 combatants in turn order.
 * The current combatant is marked as active; the rest are inactive.
 * Enemies are flagged isPlayer=false so the strip can tint them differently.
 */
import { describe, it, expect } from 'vitest';
import { buildTurnOrderStrip } from '../../src/ui/turnOrderStrip';
import type { Character } from '../../src/types';

function makeChar(id: string, spd: number, isPlayer: boolean): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: {},
  };
}

describe('buildTurnOrderStrip', () => {
  it('returns at most 5 entries', () => {
    const chars = [
      makeChar('a', 20, true),
      makeChar('b', 18, false),
      makeChar('c', 16, true),
      makeChar('d', 14, false),
      makeChar('e', 12, true),
      makeChar('f', 10, false),
    ];
    const strip = buildTurnOrderStrip(chars, 0);
    expect(strip.length).toBeLessThanOrEqual(5);
  });

  it('marks the combatant at currentIndex as active', () => {
    const chars = [makeChar('a', 20, true), makeChar('b', 18, false)];
    const strip = buildTurnOrderStrip(chars, 0);
    expect(strip[0].isActive).toBe(true);
  });

  it('non-current combatants are not active', () => {
    const chars = [makeChar('a', 20, true), makeChar('b', 18, false), makeChar('c', 16, true)];
    const strip = buildTurnOrderStrip(chars, 0);
    expect(strip.slice(1).every(e => !e.isActive)).toBe(true);
  });

  it('each entry exposes characterId', () => {
    const chars = [makeChar('hero', 20, true)];
    const strip = buildTurnOrderStrip(chars, 0);
    expect(strip[0].characterId).toBe('hero');
  });

  it('each entry exposes isPlayer flag for tinting', () => {
    const chars = [makeChar('hero', 20, true), makeChar('mob', 18, false)];
    const strip = buildTurnOrderStrip(chars, 0);
    expect(strip[0].isPlayer).toBe(true);
    expect(strip[1].isPlayer).toBe(false);
  });

  it('wraps around to the beginning of the sorted order after the last combatant', () => {
    const chars = [makeChar('a', 20, true), makeChar('b', 18, false), makeChar('c', 16, true)];
    // currentIndex = 2, so the "next" should wrap: c(active), then a, b
    const strip = buildTurnOrderStrip(chars, 2);
    expect(strip[0].characterId).toBe('c');
    expect(strip[1].characterId).toBe('a');
  });

  it('returns fewer than 5 entries when there are fewer than 5 combatants', () => {
    const chars = [makeChar('a', 20, true), makeChar('b', 18, false)];
    const strip = buildTurnOrderStrip(chars, 0);
    expect(strip).toHaveLength(2);
  });
});
