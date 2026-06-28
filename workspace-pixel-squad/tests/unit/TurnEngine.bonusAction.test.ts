import { describe, it, expect } from 'vitest';
import * as TurnEngine from '../../src/battle/TurnEngine';
import type { Character } from '../../src/types';

function makeChar(id: string, spd: number, isPlayer = true): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: {},
  } as Character;
}

// Helper: cast to any to access new fields not yet on the type
function withFlags(char: Character, flags: Record<string, unknown>): Character {
  return Object.assign({ ...char }, flags) as Character;
}

// AC-1 (queue side): insertBonusAction

describe('AC-1: insertBonusAction — exported from TurnEngine', () => {
  it('insertBonusAction is exported as a function', () => {
    expect(typeof (TurnEngine as any).insertBonusAction).toBe('function');
  });

  it('insertBonusAction prepends the character to the front of the queue', () => {
    const hero = makeChar('hero', 20);
    const enemy1 = makeChar('e1', 12, false);
    const enemy2 = makeChar('e2', 10, false);
    const queue: Character[] = [enemy1, enemy2];

    (TurnEngine as any).insertBonusAction(hero, queue);

    expect(queue[0].id).toBe('hero');
    expect(queue).toHaveLength(3);
  });

  it('insertBonusAction does not remove existing entries', () => {
    const hero = makeChar('hero', 20);
    const existing = [makeChar('a', 5, false), makeChar('b', 3, false)];
    const queue = [...existing];

    (TurnEngine as any).insertBonusAction(hero, queue);

    expect(queue.map(c => c.id)).toEqual(['hero', 'a', 'b']);
  });
});

// AC-3: Bonus action chain prevention

describe('AC-3: bonus action is not granted a second time per round', () => {
  it('applyWeaknessBonus is exported as a function', () => {
    expect(typeof (TurnEngine as any).applyWeaknessBonus).toBe('function');
  });

  it('grants bonus action when isWeaknessHit=true and bonusActionUsed=false and defender alive', () => {
    const attacker = withFlags(makeChar('hero', 15), { bonusActionUsed: false });
    const defender = withFlags(makeChar('enemy', 10, false), { stats: { hp: 50, maxHp: 100, atk: 10, def: 5, spd: 10 } });
    const queue: Character[] = [makeChar('other', 5, false)];

    (TurnEngine as any).applyWeaknessBonus(attacker, (defender as any).stats.hp, true, queue);

    expect((attacker as any).bonusActionUsed).toBe(true);
    expect(queue[0].id).toBe('hero');
  });

  it('does NOT grant bonus action when bonusActionUsed is already true', () => {
    const attacker = withFlags(makeChar('hero', 15), { bonusActionUsed: true });
    const queue: Character[] = [makeChar('other', 5, false)];
    const initialLength = queue.length;

    (TurnEngine as any).applyWeaknessBonus(attacker, 50, true, queue);

    // Queue must not grow — no second bonus action
    expect(queue).toHaveLength(initialLength);
  });

  it('bonusActionUsed is set to true after first bonus action grant (prevents second)', () => {
    const attacker = withFlags(makeChar('hero', 15), { bonusActionUsed: false });
    const queue: Character[] = [];

    (TurnEngine as any).applyWeaknessBonus(attacker, 50, true, queue);

    expect((attacker as any).bonusActionUsed).toBe(true);
  });
});

// AC-4: Round-scoped flags reset at round start

describe('AC-4: resetRoundFlags clears bonusActionUsed and knockedDown each round', () => {
  it('resetRoundFlags is exported as a function', () => {
    expect(typeof (TurnEngine as any).resetRoundFlags).toBe('function');
  });

  it('sets bonusActionUsed = false on every character', () => {
    const chars = [
      withFlags(makeChar('a', 10), { bonusActionUsed: true, knockedDown: false }),
      withFlags(makeChar('b', 8, false), { bonusActionUsed: true, knockedDown: true }),
    ] as any[];

    (TurnEngine as any).resetRoundFlags(chars);

    expect(chars[0].bonusActionUsed).toBe(false);
    expect(chars[1].bonusActionUsed).toBe(false);
  });

  it('sets knockedDown = false on every character', () => {
    const chars = [
      withFlags(makeChar('a', 10), { knockedDown: true }),
      withFlags(makeChar('b', 8, false), { knockedDown: true }),
    ] as any[];

    (TurnEngine as any).resetRoundFlags(chars);

    expect(chars[0].knockedDown).toBe(false);
    expect(chars[1].knockedDown).toBe(false);
  });

  it('works correctly when no flags are set (idempotent on already-reset state)', () => {
    const chars = [
      withFlags(makeChar('a', 10), { bonusActionUsed: false, knockedDown: false }),
    ] as any[];

    (TurnEngine as any).resetRoundFlags(chars);

    expect(chars[0].bonusActionUsed).toBe(false);
    expect(chars[0].knockedDown).toBe(false);
  });
});

// AC-9: Dead target grants no bonus action

describe('AC-9: no bonus action when weakness hit kills the target', () => {
  it('does not grant bonus action when defenderHp is 0 or below', () => {
    const attacker = withFlags(makeChar('hero', 15), { bonusActionUsed: false });
    const queue: Character[] = [makeChar('other', 5, false)];
    const initialLength = queue.length;

    // defenderHp = 0 (killed by the hit)
    (TurnEngine as any).applyWeaknessBonus(attacker, 0, true, queue);

    expect(queue).toHaveLength(initialLength);
    // bonusActionUsed must remain false since no bonus was granted
    expect((attacker as any).bonusActionUsed).toBe(false);
  });

  it('does not grant bonus action when defenderHp is negative (overkill)', () => {
    const attacker = withFlags(makeChar('hero', 15), { bonusActionUsed: false });
    const queue: Character[] = [];

    (TurnEngine as any).applyWeaknessBonus(attacker, -10, true, queue);

    expect(queue).toHaveLength(0);
  });

  it('grants bonus action normally when defender survives (hp > 0)', () => {
    const attacker = withFlags(makeChar('hero', 15), { bonusActionUsed: false });
    const queue: Character[] = [makeChar('other', 5, false)];

    (TurnEngine as any).applyWeaknessBonus(attacker, 1, true, queue);

    expect(queue[0].id).toBe('hero');
    expect((attacker as any).bonusActionUsed).toBe(true);
  });
});
