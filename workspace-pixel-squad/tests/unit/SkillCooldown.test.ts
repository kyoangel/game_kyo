import { describe, it, expect } from 'vitest';
import { isSkillReady, triggerCooldown, tickCooldowns } from '../../src/battle/SkillCooldown';
import type { Character, Skill } from '../../src/types';

// Until the Character type gains skillCooldowns, we extend locally for test fixtures.
type CharWithCD = Character & { skillCooldowns: Record<string, number> };

function makeChar(overrides: Partial<CharWithCD> = {}): CharWithCD {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [],
    skillCooldowns: {},
    ...overrides,
  };
}

const burstShot: Skill & { cooldown: number } = {
  id: 'burst_shot', name: '爆發射擊', type: 'attack', target: 'enemy',
  multiplier: 1.5, description: '', cooldown: 3,
};

const noCD: Skill = {
  id: 'swift_strike', name: '迅捷突刺', type: 'attack', target: 'enemy',
  multiplier: 1.3, description: '',
};

const overdrive: Skill & { cooldown: number } = {
  id: 'overdrive', name: '超載', type: 'buff', target: 'self',
  multiplier: 0, buffStat: 'atk', buffAmountPct: 0.5, buffDuration: 2,
  description: '', cooldown: 4,
};

// ---------- isSkillReady ----------

describe('isSkillReady', () => {
  it('returns true when the skill has no cooldown field at all', () => {
    const char = makeChar({ skillCooldowns: {} });
    expect(isSkillReady(char as unknown as Character, noCD)).toBe(true);
  });

  it('returns true when skill.cooldown is 0 (unlimited-use)', () => {
    const zeroCDSkill = { ...burstShot, cooldown: 0 };
    const char = makeChar({ skillCooldowns: {} });
    expect(isSkillReady(char as unknown as Character, zeroCDSkill)).toBe(true);
  });

  it('returns true when skillCooldowns has no entry for the skill', () => {
    const char = makeChar({ skillCooldowns: {} });
    expect(isSkillReady(char as unknown as Character, burstShot)).toBe(true);
  });

  it('returns true when the counter for the skill is exactly 0', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 0 } });
    expect(isSkillReady(char as unknown as Character, burstShot)).toBe(true);
  });

  it('returns false when the counter is greater than 0 (AC1 — round 2 after round-1 use)', () => {
    // AC1: burst_shot used on round 1 → counter = 3, skill unavailable on round 2
    const char = makeChar({ skillCooldowns: { burst_shot: 3 } });
    expect(isSkillReady(char as unknown as Character, burstShot)).toBe(false);
  });

  it('returns false when exactly 1 round remains', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 1 } });
    expect(isSkillReady(char as unknown as Character, burstShot)).toBe(false);
  });

  it('checks per skill id — one skill on cooldown does not block another', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 3 } });
    expect(isSkillReady(char as unknown as Character, noCD)).toBe(true);
  });
});

// ---------- triggerCooldown ----------

describe('triggerCooldown', () => {
  it('sets the counter to skill.cooldown immediately after use', () => {
    const char = makeChar({ skillCooldowns: {} });
    triggerCooldown(char as unknown as Character, burstShot);
    expect(char.skillCooldowns['burst_shot']).toBe(3);
  });

  it('sets overdrive counter to 4 after use', () => {
    const char = makeChar({ skillCooldowns: {} });
    triggerCooldown(char as unknown as Character, overdrive);
    expect(char.skillCooldowns['overdrive']).toBe(4);
  });

  it('does NOT set a counter for a skill with no cooldown field (AC3)', () => {
    // AC3: skills without cooldown must stay immediately available
    const char = makeChar({ skillCooldowns: {} });
    triggerCooldown(char as unknown as Character, noCD);
    expect(Object.keys(char.skillCooldowns)).toHaveLength(0);
  });

  it('does NOT set a counter for a skill with cooldown: 0', () => {
    const zeroCDSkill = { ...burstShot, id: 'zero_cd', cooldown: 0 };
    const char = makeChar({ skillCooldowns: {} });
    triggerCooldown(char as unknown as Character, zeroCDSkill);
    expect(char.skillCooldowns['zero_cd']).toBeUndefined();
  });

  it('overwrites an existing counter when a skill is used again before expiry', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 1 } });
    triggerCooldown(char as unknown as Character, burstShot);
    expect(char.skillCooldowns['burst_shot']).toBe(3);
  });
});

// ---------- tickCooldowns ----------

describe('tickCooldowns', () => {
  it('decrements non-zero counters by 1 for a single character', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 3 } });
    tickCooldowns([char as unknown as Character]);
    expect(char.skillCooldowns['burst_shot']).toBe(2);
  });

  it('decrements multiple skill counters on the same character simultaneously', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 3, overdrive: 4 } });
    tickCooldowns([char as unknown as Character]);
    expect(char.skillCooldowns['burst_shot']).toBe(2);
    expect(char.skillCooldowns['overdrive']).toBe(3);
  });

  it('does not decrement a counter that is already 0', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 0 } });
    tickCooldowns([char as unknown as Character]);
    expect(char.skillCooldowns['burst_shot']).toBe(0);
  });

  it('never goes below 0 after repeated ticks', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 1 } });
    tickCooldowns([char as unknown as Character]);
    tickCooldowns([char as unknown as Character]);
    expect(char.skillCooldowns['burst_shot']).toBeGreaterThanOrEqual(0);
  });

  it('reduces burst_shot counter from 3 to 0 after exactly 3 ticks (AC2)', () => {
    // AC2: used on round 1 (counter=3), ticked at start of rounds 2, 3, 4
    const char = makeChar({ skillCooldowns: { burst_shot: 3 } });
    tickCooldowns([char as unknown as Character]); // start of round 2 → 2
    tickCooldowns([char as unknown as Character]); // start of round 3 → 1
    tickCooldowns([char as unknown as Character]); // start of round 4 → 0
    expect(char.skillCooldowns['burst_shot']).toBe(0);
  });

  it('burst_shot is ready again (isSkillReady returns true) after 3 ticks (AC2)', () => {
    const char = makeChar({ skillCooldowns: { burst_shot: 3 } });
    tickCooldowns([char as unknown as Character]);
    tickCooldowns([char as unknown as Character]);
    tickCooldowns([char as unknown as Character]);
    expect(isSkillReady(char as unknown as Character, burstShot)).toBe(true);
  });

  it('ticks counters across multiple characters independently', () => {
    const char1 = makeChar({ id: 'c1', skillCooldowns: { burst_shot: 2 } });
    const char2 = makeChar({ id: 'c2', skillCooldowns: { overdrive: 4 } });
    tickCooldowns([char1, char2] as unknown as Character[]);
    expect(char1.skillCooldowns['burst_shot']).toBe(1);
    expect(char2.skillCooldowns['overdrive']).toBe(3);
  });

  it('does NOT tick a dead character\'s counters', () => {
    const dead = makeChar({ alive: false, skillCooldowns: { burst_shot: 3 } });
    tickCooldowns([dead as unknown as Character]);
    expect(dead.skillCooldowns['burst_shot']).toBe(3);
  });

  it('ticks living characters while skipping dead ones in a mixed party', () => {
    const alive = makeChar({ id: 'alive', alive: true, skillCooldowns: { overdrive: 4 } });
    const dead = makeChar({ id: 'dead', alive: false, skillCooldowns: { overdrive: 4 } });
    tickCooldowns([alive, dead] as unknown as Character[]);
    expect(alive.skillCooldowns['overdrive']).toBe(3);
    expect(dead.skillCooldowns['overdrive']).toBe(4);
  });
});
