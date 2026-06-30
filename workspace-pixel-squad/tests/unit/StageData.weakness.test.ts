import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';
import type { Element } from '../../src/types';

// Spec: pixel-squad-general-weakness-wiring — every non-boss EnemyTemplate in
// data/stages.ts must carry a weakness, assigned per the spec's element table.
// Boss EnemyTemplate entries (vega, crow, zora, dex, aaaa) are unchanged —
// they still gain their weakness only via BossPhase.weaknessOverride, never
// from the template.

const BOSS_IDS = ['vega', 'crow', 'zora', 'dex', 'aaaa'];

const EXPECTED_WEAKNESS: Record<string, Element> = {
  // fire
  mutant: 'fire', mutant_a: 'fire', mutant_b: 'fire',
  beast_a: 'fire', beast_b: 'fire', beast_c: 'fire',
  bomber: 'fire',
  shadow_a: 'fire', shadow_b: 'fire', shadow_c: 'fire',
  ruin_deity: 'fire',
  // ice
  wolf_a: 'ice', wolf_b: 'ice',
  ruin_guard_a: 'ice', ruin_guard_b: 'ice',
  gargoyle: 'ice',
  ancient_a: 'ice', ancient_b: 'ice',
  // thunder
  mech_a: 'thunder', mech_b: 'thunder', mech_c: 'thunder',
  em_spider: 'thunder',
  franken: 'thunder',
  em_guard_a: 'thunder', em_guard_b: 'thunder',
  mech_soldier: 'thunder',
  forge_bot: 'thunder',
  elite_mech_a: 'thunder', elite_mech_b: 'thunder', elite_mech_c: 'thunder',
  top_samurai: 'thunder',
  // toxin
  waste_dog: 'toxin',
  soldier: 'toxin', soldier_a: 'toxin', soldier_b: 'toxin', soldier_c: 'toxin',
  elite_guard_a: 'toxin', elite_guard_b: 'toxin',
  market_boss: 'toxin',
  // physical
  raider: 'physical', raider_a: 'physical', raider_b: 'physical', raider_c: 'physical',
  raider_cap: 'physical', raider_sniper: 'physical',
  sniper: 'physical',
  elite_a: 'physical', elite_b: 'physical', elite_c: 'physical',
  arena_a: 'physical', arena_b: 'physical', arena_c: 'physical', arena_champ: 'physical',
};

function allEnemyTemplates() {
  return STAGES.flatMap(stage => stage.enemies.map(enemy => ({ stageId: stage.id, isBoss: stage.isBoss, enemy })));
}

describe('weakness assignment: every non-boss EnemyTemplate carries the assigned element', () => {
  it.each(Object.entries(EXPECTED_WEAKNESS))('id "%s" has weakness "%s" everywhere it appears', (id, element) => {
    const occurrences = allEnemyTemplates().filter(t => t.enemy.id === id);
    expect(occurrences.length).toBeGreaterThan(0); // sanity: id actually exists in STAGES
    for (const { stageId, enemy } of occurrences) {
      expect(enemy.weakness, `enemy "${id}" in stage "${stageId}" should have weakness "${element}"`).toBe(element);
    }
  });

  it('every non-boss enemy id present in STAGES has a defined weakness', () => {
    const missing = allEnemyTemplates()
      .filter(t => !t.isBoss)
      .filter(t => !t.enemy.weakness)
      .map(t => `${t.stageId}:${t.enemy.id}`);
    expect(missing).toEqual([]);
  });

  it('every non-boss enemy id present in STAGES is covered by the assignment table', () => {
    const uncovered = allEnemyTemplates()
      .filter(t => !t.isBoss)
      .filter(t => !(t.enemy.id in EXPECTED_WEAKNESS))
      .map(t => `${t.stageId}:${t.enemy.id}`);
    expect(uncovered).toEqual([]);
  });
});

describe('weakness assignment: repeated ids never diverge across stages (discoveredWeaknesses is keyed by templateId)', () => {
  it('raider_a uses the same weakness in every stage it appears (2-1, 2-2, 2-3, SQ-2)', () => {
    const occurrences = allEnemyTemplates().filter(t => t.enemy.id === 'raider_a');
    const stageIds = occurrences.map(o => o.stageId).sort();
    expect(stageIds).toEqual(['2-1', '2-2', '2-3', 'SQ-2'].sort());
    const distinctWeaknesses = new Set(occurrences.map(o => o.enemy.weakness));
    expect(distinctWeaknesses.size).toBe(1);
    expect([...distinctWeaknesses][0]).toBe('physical');
  });

  it('mech_a uses the same weakness in every stage it appears (2-4, 4-1, 4-2)', () => {
    const occurrences = allEnemyTemplates().filter(t => t.enemy.id === 'mech_a');
    const distinctWeaknesses = new Set(occurrences.map(o => o.enemy.weakness));
    expect(distinctWeaknesses.size).toBe(1);
    expect([...distinctWeaknesses][0]).toBe('thunder');
  });

  it('soldier_a uses the same weakness in every stage it appears (3-2, 3-3)', () => {
    const occurrences = allEnemyTemplates().filter(t => t.enemy.id === 'soldier_a');
    const distinctWeaknesses = new Set(occurrences.map(o => o.enemy.weakness));
    expect(distinctWeaknesses.size).toBe(1);
    expect([...distinctWeaknesses][0]).toBe('toxin');
  });

  it('elite_a uses the same weakness in every stage it appears (3-4, 5-1)', () => {
    const occurrences = allEnemyTemplates().filter(t => t.enemy.id === 'elite_a');
    const distinctWeaknesses = new Set(occurrences.map(o => o.enemy.weakness));
    expect(distinctWeaknesses.size).toBe(1);
    expect([...distinctWeaknesses][0]).toBe('physical');
  });

  it('elite_b uses the same weakness in every stage it appears (3-4, 5-1)', () => {
    const occurrences = allEnemyTemplates().filter(t => t.enemy.id === 'elite_b');
    const distinctWeaknesses = new Set(occurrences.map(o => o.enemy.weakness));
    expect(distinctWeaknesses.size).toBe(1);
    expect([...distinctWeaknesses][0]).toBe('physical');
  });
});

describe('weakness assignment: boss EnemyTemplate entries are untouched', () => {
  it.each(BOSS_IDS)('boss "%s" template has weakness undefined (gained only via weaknessOverride)', (bossId) => {
    const occurrences = allEnemyTemplates().filter(t => t.enemy.id === bossId);
    expect(occurrences.length).toBeGreaterThan(0);
    for (const { enemy } of occurrences) {
      expect(enemy.weakness).toBeUndefined();
    }
  });

  it('boss stages are flagged isBoss: true and excluded from non-boss coverage checks', () => {
    const bossStages = STAGES.filter(s => BOSS_IDS.some(id => s.enemies.some(e => e.id === id)));
    for (const stage of bossStages) {
      expect(stage.isBoss).toBe(true);
    }
  });
});
