import { describe, it, expect } from 'vitest';
import { PLAYER_TEMPLATES } from '../../src/data/characters';

describe('PLAYER_TEMPLATES', () => {
  it('has exactly 12 templates', () => {
    expect(PLAYER_TEMPLATES).toHaveLength(12);
  });

  it('has exactly one protagonist', () => {
    expect(PLAYER_TEMPLATES.filter(t => t.isProtagonist)).toHaveLength(1);
    expect(PLAYER_TEMPLATES[0].isProtagonist).toBe(true);
  });

  it('protagonist has unlockMethod start', () => {
    const p = PLAYER_TEMPLATES.find(t => t.isProtagonist)!;
    expect(p.unlockMethod).toBe('start');
  });

  it('all templates have required fields', () => {
    PLAYER_TEMPLATES.forEach(t => {
      expect(t.id, `${t.id} missing id`).toBeTruthy();
      expect(t.name, `${t.id} missing name`).toBeTruthy();
      expect(t.baseStats.hp, `${t.id} missing hp`).toBeGreaterThan(0);
      expect(['start', 'stage', 'recruit']).toContain(t.unlockMethod);
      if (t.unlockMethod !== 'start') {
        expect(t.unlockStageId, `${t.id} missing unlockStageId`).toBeTruthy();
      }
    });
  });

  it('template IDs are unique', () => {
    const ids = PLAYER_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('non-protagonist templates have non-zero statGrowth totals', () => {
    PLAYER_TEMPLATES.filter(t => !t.isProtagonist).forEach(t => {
      const total = t.statGrowth.hp + t.statGrowth.atk + t.statGrowth.def + t.statGrowth.spd;
      expect(total, `${t.id} has zero stat growth`).toBeGreaterThan(0);
    });
  });
});
