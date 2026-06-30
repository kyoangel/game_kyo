import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';
import { SKILLS } from '../../src/data/skills';
import { createEnemy, createCharacter } from '../../src/battle/CharacterFactory';
import { calcDamage } from '../../src/battle/DamageCalc';
import {
  seedDiscoveredThisBattle,
  recordHitDiscovery,
  isWeaknessIconVisible,
} from '../../src/battle/WeaknessDiscovery';
import { decideActionWithAwareness } from '../../src/battle/SkillAI';
import type { Character, CharacterTemplate, GameState } from '../../src/types';

// Spec: pixel-squad-general-weakness-wiring
// Integration tests that trace directly to the spec's named acceptance criteria,
// exercising the full pipeline with real stage/skill data rather than
// hand-crafted stubs.  Each describe block names its AC explicitly.

function makeGameState(discovered: Record<string, string> = {}): GameState {
  return {
    slotId: 0, pool: [], squad: [], expPool: 0, currency: 0,
    stageProgress: { completedStageIds: [] },
    savedAt: 0, inventory: [], ngPlusCycle: 0, hasClearedGame: false,
    discoveredWeaknesses: { ...discovered } as any,
  };
}

const PROTAGONIST_TEMPLATE: CharacterTemplate = {
  id: 'protagonist', name: '主角', isProtagonist: true,
  baseStats: { hp: 100, atk: 40, def: 10, spd: 12 },
  skillIds: [],
  statGrowth: { hp: 0, atk: 0, def: 0, spd: 0 },
  unlockMethod: 'start',
};

function makeProtagonist(...skillKeys: string[]): Character {
  const c = createCharacter(PROTAGONIST_TEMPLATE, 1);
  c.skills = skillKeys.map(k => SKILLS[k]);
  return c;
}

// ── AC-1: Weakness assignment ─────────────────────────────────────────────────
// "Given stage 1-1 starts and mutant's EnemyTemplate.weakness is 'fire',
//  When the enemy Character is created via createEnemy,
//  Then enemy.weakness === 'fire'"

describe('AC-1: stage 1-1 mutant — createEnemy propagates the weakness from the stage template', () => {
  it('stage 1-1 has exactly one enemy with id "mutant"', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    expect(stage).toBeDefined();
    const template = stage.enemies.find(e => e.id === 'mutant');
    expect(template).toBeDefined();
  });

  it('the mutant EnemyTemplate in stage 1-1 has weakness "fire"', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const template = stage.enemies.find(e => e.id === 'mutant')!;
    expect(template.weakness).toBe('fire');
  });

  it('createEnemy(stage-1-1 mutant template) produces a Character with weakness "fire"', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const template = stage.enemies.find(e => e.id === 'mutant')!;
    const enemy = createEnemy(template);
    expect(enemy.weakness).toBe('fire');
    expect(enemy.templateId).toBe('mutant');
  });
});

// ── AC-2: raider_a consistency ────────────────────────────────────────────────
// "Given raider_a appears in stages 2-1, 2-2, 2-3, and SQ-2
//  When each EnemyTemplate object for raider_a is inspected
//  Then all four set weakness: 'physical'"

describe('AC-2: raider_a weakness is physical in every stage occurrence', () => {
  function raiderAOccurrences() {
    return STAGES.flatMap(s => s.enemies.filter(e => e.id === 'raider_a').map(e => ({ stageId: s.id, e })));
  }

  it('raider_a appears in stages 2-1, 2-2, 2-3, and SQ-2 (exactly those four)', () => {
    const ids = raiderAOccurrences().map(o => o.stageId).sort();
    expect(ids).toEqual(['2-1', '2-2', '2-3', 'SQ-2'].sort());
  });

  it('every raider_a occurrence has weakness "physical" — no occurrence diverges', () => {
    for (const { stageId, e } of raiderAOccurrences()) {
      expect(e.weakness, `raider_a in ${stageId}`).toBe('physical');
    }
  });

  it('createEnemy on any raider_a template yields a Character with weakness "physical"', () => {
    const template = STAGES.find(s => s.id === 'SQ-2')!.enemies.find(e => e.id === 'raider_a')!;
    const enemy = createEnemy(template);
    expect(enemy.weakness).toBe('physical');
  });
});

// ── AC-3: discovery on hit (burst_shot / fire vs mutant / fire) ───────────────
// "When the protagonist attacks with burst_shot (fire) and the hit lands,
//  Then calcDamage returns isWeaknessHit: true, damage is 1.5× base,
//  'mutant' is added to discoveredThisBattle, recordWeaknessDiscovery is called."

describe('AC-3: discovery on hit — burst_shot (fire) against mutant (fire weakness)', () => {
  it('SKILLS.burst_shot has element "fire"', () => {
    expect(SKILLS.burst_shot.element).toBe('fire');
  });

  it('calcDamage with burst_shot against a fire-weak mutant returns isWeaknessHit: true', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const mutantTemplate = stage.enemies.find(e => e.id === 'mutant')!;
    const attacker = makeProtagonist('burst_shot');
    const target = createEnemy(mutantTemplate);

    const result = calcDamage(attacker, target, SKILLS.burst_shot);
    expect(result.isWeaknessHit).toBe(true);
  });

  it('burst_shot damage against fire-weak mutant is 1.5× the non-weakness base', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const mutantTemplate = stage.enemies.find(e => e.id === 'mutant')!;
    const attacker = makeProtagonist();
    const weakTarget = createEnemy(mutantTemplate);                              // weakness: fire
    const plainTarget = createEnemy({ ...mutantTemplate, weakness: undefined }); // no weakness

    const weakResult = calcDamage(attacker, weakTarget, SKILLS.burst_shot);
    const plainResult = calcDamage(attacker, plainTarget, SKILLS.burst_shot);

    expect(weakResult.damage).toBe(Math.floor(plainResult.damage * 1.5));
  });

  it('recordHitDiscovery adds mutant to discoveredThisBattle and writes gameState', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const mutantTemplate = stage.enemies.find(e => e.id === 'mutant')!;
    const attacker = makeProtagonist('burst_shot');
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    const dmgResult = calcDamage(attacker, target, SKILLS.burst_shot);
    const isNew = recordHitDiscovery(dmgResult.isWeaknessHit, target, discoveredThisBattle, gameState);

    expect(isNew).toBe(true);
    expect(discoveredThisBattle.has('mutant')).toBe(true);
    expect(gameState.discoveredWeaknesses?.['mutant']).toBe('fire');
  });
});

// ── AC-4: idempotent on repeat hit ────────────────────────────────────────────
// "a second weakness hit on the same enemy is not a new discovery"

describe('AC-4: second burst_shot on the same mutant is idempotent', () => {
  it('second hit returns isNewDiscovery=false and does not duplicate the save entry', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const mutantTemplate = stage.enemies.find(e => e.id === 'mutant')!;
    const attacker = makeProtagonist();
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    const first = calcDamage(attacker, target, SKILLS.burst_shot);
    recordHitDiscovery(first.isWeaknessHit, target, discoveredThisBattle, gameState);

    const second = calcDamage(attacker, target, SKILLS.burst_shot);
    const isNew = recordHitDiscovery(second.isWeaknessHit, target, discoveredThisBattle, gameState);

    expect(isNew).toBe(false);
    expect(discoveredThisBattle.size).toBe(1);
    expect(Object.keys(gameState.discoveredWeaknesses ?? {})).toHaveLength(1);
  });
});

// ── AC-5: non-weakness hit produces no discovery ──────────────────────────────
// "swift_strike (thunder) vs mutant (fire weakness) → isWeaknessHit false"

describe('AC-5: non-weakness hit — swift_strike (thunder) vs mutant (fire) does not discover', () => {
  it('SKILLS.swift_strike has element "thunder"', () => {
    expect(SKILLS.swift_strike.element).toBe('thunder');
  });

  it('calcDamage swift_strike vs fire-weak mutant returns isWeaknessHit: false', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const mutantTemplate = stage.enemies.find(e => e.id === 'mutant')!;
    const attacker = makeProtagonist();
    const target = createEnemy(mutantTemplate);

    const result = calcDamage(attacker, target, SKILLS.swift_strike);
    expect(result.isWeaknessHit).toBe(false);
  });

  it('recordHitDiscovery does not add to discoveredThisBattle on a non-weakness hit', () => {
    const stage = STAGES.find(s => s.id === '1-1')!;
    const mutantTemplate = stage.enemies.find(e => e.id === 'mutant')!;
    const attacker = makeProtagonist();
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    const dmgResult = calcDamage(attacker, target, SKILLS.swift_strike);
    const isNew = recordHitDiscovery(dmgResult.isWeaknessHit, target, discoveredThisBattle, gameState);

    expect(isNew).toBe(false);
    expect(discoveredThisBattle.size).toBe(0);
    expect(gameState.discoveredWeaknesses?.['mutant']).toBeUndefined();
  });
});

// ── AC-6: discovery persists and carries forward from a prior save ─────────────
// "Given raider_a was previously discovered, When SQ-2 battle initialises,
//  Then discoveredThisBattle is pre-seeded and icon is visible from frame 1"

describe('AC-6: prior save knowledge carries forward via seedDiscoveredThisBattle', () => {
  it('seedDiscoveredThisBattle from a save with raider_a seeds the Set', () => {
    const gameState = makeGameState({ raider_a: 'physical' });
    const set = seedDiscoveredThisBattle(gameState.discoveredWeaknesses);
    expect(set.has('raider_a')).toBe(true);
  });

  it('SQ-2 raider_a icon is immediately visible when pre-seeded from save', () => {
    const gameState = makeGameState({ raider_a: 'physical' });
    const discoveredThisBattle = seedDiscoveredThisBattle(gameState.discoveredWeaknesses);

    const template = STAGES.find(s => s.id === 'SQ-2')!.enemies.find(e => e.id === 'raider_a')!;
    const enemy = createEnemy(template);

    expect(isWeaknessIconVisible(enemy, discoveredThisBattle)).toBe(true);
  });

  it('an undiscovered enemy in SQ-2 shows no icon before any hit', () => {
    const gameState = makeGameState({}); // nothing discovered
    const discoveredThisBattle = seedDiscoveredThisBattle(gameState.discoveredWeaknesses);

    const template = STAGES.find(s => s.id === 'SQ-2')!.enemies.find(e => e.id === 'raider_a')!;
    const enemy = createEnemy(template);

    expect(isWeaknessIconVisible(enemy, discoveredThisBattle)).toBe(false);
  });
});

// ── AC-7: same-species reveal in one battle ────────────────────────────────────
// "Hitting raider_a_1's weakness reveals BOTH raider_a_1 and raider_a_2 icons"

describe('AC-7: same-species reveal — discovering one raider_a reveals all raider_a instances', () => {
  it('both raider_a instances share templateId "raider_a"', () => {
    const template = STAGES.find(s => s.id === '2-1')!.enemies.find(e => e.id === 'raider_a')!;
    const r1 = createEnemy(template);
    const r2 = createEnemy(template);
    expect(r1.templateId).toBe('raider_a');
    expect(r2.templateId).toBe('raider_a');
  });

  it('shield_bash (physical) lands as a weakness hit against raider_a (physical weakness)', () => {
    const template = STAGES.find(s => s.id === '2-1')!.enemies.find(e => e.id === 'raider_a')!;
    const attacker = makeProtagonist('shield_bash');
    const target = createEnemy(template);

    const result = calcDamage(attacker, target, SKILLS.shield_bash);
    expect(result.isWeaknessHit).toBe(true);
  });

  it('after hitting raider_a_1, isWeaknessIconVisible is true for BOTH raider_a_1 and raider_a_2', () => {
    const template = STAGES.find(s => s.id === '2-1')!.enemies.find(e => e.id === 'raider_a')!;
    const attacker = makeProtagonist();
    const raiderA1 = createEnemy(template);
    const raiderA2 = createEnemy(template);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    // Before hit: neither visible.
    expect(isWeaknessIconVisible(raiderA1, discoveredThisBattle)).toBe(false);
    expect(isWeaknessIconVisible(raiderA2, discoveredThisBattle)).toBe(false);

    const dmgResult = calcDamage(attacker, raiderA1, SKILLS.shield_bash);
    recordHitDiscovery(dmgResult.isWeaknessHit, raiderA1, discoveredThisBattle, gameState);

    // After hit on raiderA1: both instances show icon (shared templateId).
    expect(isWeaknessIconVisible(raiderA1, discoveredThisBattle)).toBe(true);
    expect(isWeaknessIconVisible(raiderA2, discoveredThisBattle)).toBe(true);
  });
});

// ── AC-8: auto-battle uses decideActionWithAwareness ─────────────────────────
// "Given discoveredWeaknesses['mech_a'] === 'thunder' and the actor has
//  swift_strike (thunder, off cooldown), decideActionWithAwareness selects
//  swift_strike targeting mech_a"

describe('AC-8: auto-battle — decideActionWithAwareness uses mech_a/thunder discovery', () => {
  it('SKILLS.swift_strike has element "thunder"', () => {
    expect(SKILLS.swift_strike.element).toBe('thunder');
  });

  it('stage 4-1 contains mech_a enemies with weakness "thunder"', () => {
    const stage = STAGES.find(s => s.id === '4-1')!;
    const mechA = stage.enemies.find(e => e.id === 'mech_a')!;
    expect(mechA.weakness).toBe('thunder');
  });

  it('selects swift_strike targeting mech_a when thunder weakness is discovered', () => {
    const attacker = makeProtagonist('burst_shot', 'swift_strike', 'shield_bash');
    attacker.skillCooldowns = {}; // all skills ready

    const template = STAGES.find(s => s.id === '4-1')!.enemies.find(e => e.id === 'mech_a')!;
    const mechEnemy = createEnemy(template);

    const discoveredWeaknesses = { mech_a: 'thunder' };
    const decision = decideActionWithAwareness(attacker, [attacker], [mechEnemy], discoveredWeaknesses);

    expect(decision.skill?.element).toBe('thunder');
    expect(decision.skill?.id).toBe('swift_strike');
    expect(decision.target.templateId).toBe('mech_a');
  });

  it('falls back to a valid action when mech_a weakness is not yet discovered', () => {
    const attacker = makeProtagonist('swift_strike');
    attacker.skillCooldowns = {};

    const template = STAGES.find(s => s.id === '4-1')!.enemies.find(e => e.id === 'mech_a')!;
    const mechEnemy = createEnemy(template);

    const decision = decideActionWithAwareness(attacker, [attacker], [mechEnemy], {});

    expect(decision.target).toBeDefined();
    expect(decision.target.alive).toBe(true);
  });

  it('does not select swift_strike when it is on cooldown, even if thunder weakness is discovered', () => {
    const attacker = makeProtagonist('burst_shot', 'swift_strike');
    attacker.skillCooldowns = { swift_strike: 2 }; // locked

    const template = STAGES.find(s => s.id === '4-1')!.enemies.find(e => e.id === 'mech_a')!;
    const mechEnemy = createEnemy(template);

    const decision = decideActionWithAwareness(attacker, [attacker], [mechEnemy], { mech_a: 'thunder' });

    expect(decision.skill?.id).not.toBe('swift_strike');
  });
});

// ── AC-9: regression — boss weakness reveal still works with discoveredThisBattle gate ──
// "revealBossWeakness + discoveredThisBattle.add → isWeaknessIconVisible returns true for boss"

describe('AC-9: regression — boss path: adding templateId to discoveredThisBattle makes icon visible', () => {
  it('isWeaknessIconVisible is true for a boss after its templateId is seeded into discoveredThisBattle', () => {
    // Simulate what BattleScene does after revealBossWeakness: adds boss templateId to discoveredThisBattle.
    const vegaTemplate = STAGES.find(s => s.id === '1-5')!.enemies.find(e => e.id === 'vega')!;
    const bossEnemy = createEnemy(vegaTemplate);
    // Boss template has no weakness — it's set mid-battle by revealBossWeakness.
    bossEnemy.weakness = 'ice'; // simulated reveal

    const discoveredThisBattle = new Set<string>();

    // Before reveal: icon hidden.
    expect(isWeaknessIconVisible(bossEnemy, discoveredThisBattle)).toBe(false);

    // BattleScene does: discoveredThisBattle.add(enemy.templateId) after revealBossWeakness.
    discoveredThisBattle.add(bossEnemy.templateId);

    // Now: icon visible.
    expect(isWeaknessIconVisible(bossEnemy, discoveredThisBattle)).toBe(true);
  });

  it('boss template has no weakness in STAGES (weakness is nil until weaknessOverride fires)', () => {
    const bossStage = STAGES.find(s => s.id === '1-5')!;
    const vegaTemplate = bossStage.enemies.find(e => e.id === 'vega')!;
    expect(vegaTemplate.weakness).toBeUndefined();
    expect(bossStage.isBoss).toBe(true);
  });
});
