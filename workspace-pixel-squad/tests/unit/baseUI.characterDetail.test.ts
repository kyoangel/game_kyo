/**
 * AC-12: Two-column Base layout — character detail panel
 * When a character card is tapped on the Base scene, the right column updates
 * to show that character's full detail data WITHOUT navigating to a new scene.
 * The detail data includes: archetype badge info, all 4 stats with icon keys,
 * skills list, level, and EXP progress toward next level.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacterDetailData } from '../../src/ui/characterDetail';
import type { Character, Skill } from '../../src/types';

function makeSkill(id: string): Skill {
  return { id, name: `Skill ${id}`, type: 'attack', target: 'enemy', multiplier: 1.0, description: '' };
}

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1', templateId: 'tpl1', name: 'Rex', isProtagonist: false, isPlayer: true,
    level: 3, exp: 80, expToNext: 120,
    stats: { hp: 90, maxHp: 100, atk: 15, def: 8, spd: 10 },
    skills: [makeSkill('slash'), makeSkill('guard')],
    statPoints: 0, archetype: '坦克', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: {},
    ...overrides,
  };
}

describe('buildCharacterDetailData', () => {
  it('includes the character name', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.name).toBe('Rex');
  });

  it('includes the archetype label', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.archetype).toBe('坦克');
  });

  it('includes all four stats: hp, atk, def, spd', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.stats).toHaveProperty('hp');
    expect(detail.stats).toHaveProperty('atk');
    expect(detail.stats).toHaveProperty('def');
    expect(detail.stats).toHaveProperty('spd');
  });

  it('hp stat shows current and max values', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.stats.hp.current).toBe(90);
    expect(detail.stats.hp.max).toBe(100);
  });

  it('includes the skills list with names', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.skills).toHaveLength(2);
    expect(detail.skills[0].name).toBe('Skill slash');
  });

  it('includes the character level', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.level).toBe(3);
  });

  it('includes current EXP amount', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.exp).toBe(80);
  });

  it('includes expToNext for the progress bar upper bound', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(detail.expToNext).toBe(120);
  });

  it('includes expProgressPct between 0 and 1 (for bar width)', () => {
    const detail = buildCharacterDetailData(makeChar({ exp: 60, expToNext: 120 }));
    expect(detail.expProgressPct).toBeCloseTo(0.5);
  });

  it('expProgressPct is 0 when exp is 0', () => {
    const detail = buildCharacterDetailData(makeChar({ exp: 0, expToNext: 100 }));
    expect(detail.expProgressPct).toBe(0);
  });

  it('each stat includes an iconKey string for the icon sprite lookup', () => {
    const detail = buildCharacterDetailData(makeChar());
    expect(typeof detail.stats.hp.iconKey).toBe('string');
    expect(typeof detail.stats.atk.iconKey).toBe('string');
    expect(typeof detail.stats.def.iconKey).toBe('string');
    expect(typeof detail.stats.spd.iconKey).toBe('string');
  });

  it('each skill entry includes its cooldown info', () => {
    const char = makeChar({ skillCooldowns: { slash: 2 } });
    const detail = buildCharacterDetailData(char);
    const slashEntry = detail.skills.find(s => s.id === 'slash');
    expect(slashEntry?.cooldownRemaining).toBe(2);
  });

  it('skill with no cooldown entry shows cooldownRemaining of 0', () => {
    const char = makeChar({ skillCooldowns: {} });
    const detail = buildCharacterDetailData(char);
    expect(detail.skills[0].cooldownRemaining).toBe(0);
  });
});
