import { describe, it, expect } from 'vitest';
import {
  seedDiscoveredThisBattle,
  recordHitDiscovery,
  isWeaknessIconVisible,
} from '../../src/battle/WeaknessDiscovery';
import { calcDamage } from '../../src/battle/DamageCalc';
import { createEnemy, createCharacter } from '../../src/battle/CharacterFactory';
import { SKILLS } from '../../src/data/skills';
import type { Character, EnemyTemplate, GameState, CharacterTemplate } from '../../src/types';

// Spec: pixel-squad-general-weakness-wiring — "discovery on hit" section.
// This pure logic (seeding discoveredThisBattle from the save, deciding
// whether a hit is a *new* discovery, and gating weakness-icon visibility)
// is extracted out of BattleScene's Phaser-bound executePlayerCommand /
// updateWeaknessIcon so it can be unit tested without a scene — the same
// pattern already used for revealBossWeakness (battle/BossWeaknessReveal.ts).

function makeGameState(discoveredWeaknesses: Record<string, string> = {}): GameState {
  return {
    slotId: 0,
    pool: [],
    squad: [],
    expPool: 0,
    currency: 0,
    stageProgress: { completedStageIds: [] },
    savedAt: Date.now(),
    inventory: [],
    ngPlusCycle: 0,
    hasClearedGame: false,
    discoveredWeaknesses: { ...discoveredWeaknesses } as any,
  };
}

const mutantTemplate: EnemyTemplate = {
  id: 'mutant',
  name: '變種人',
  baseStats: { hp: 60, atk: 15, def: 5, spd: 8 },
  skillIds: [],
  weakness: 'fire',
};

const raiderATemplate: EnemyTemplate = {
  id: 'raider_a',
  name: '掠奪者',
  baseStats: { hp: 80, atk: 20, def: 8, spd: 12 },
  skillIds: [],
  weakness: 'physical',
};

const protagonistTemplate: CharacterTemplate = {
  id: 'protagonist',
  name: '主角',
  isProtagonist: true,
  baseStats: { hp: 100, atk: 40, def: 10, spd: 12 },
  skillIds: [],
  statGrowth: { hp: 0, atk: 0, def: 0, spd: 0 },
  unlockMethod: 'start',
};

function makeAttacker(): Character {
  const char = createCharacter(protagonistTemplate, 1);
  char.skills = [SKILLS.burst_shot, SKILLS.swift_strike, SKILLS.shield_bash];
  return char;
}

describe('seedDiscoveredThisBattle', () => {
  it('returns an empty Set when discoveredWeaknesses is undefined', () => {
    const set = seedDiscoveredThisBattle(undefined);
    expect(set instanceof Set).toBe(true);
    expect(set.size).toBe(0);
  });

  it('returns an empty Set when discoveredWeaknesses is an empty object', () => {
    const set = seedDiscoveredThisBattle({});
    expect(set.size).toBe(0);
  });

  it('pre-seeds the Set with every templateId already in the save', () => {
    const set = seedDiscoveredThisBattle({ raider_a: 'physical' as any, mech_a: 'thunder' as any });
    expect(set.has('raider_a')).toBe(true);
    expect(set.has('mech_a')).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe('recordHitDiscovery: new discovery on a player weakness hit', () => {
  it('records mutant (fire) as a new discovery when burst_shot (fire) lands', () => {
    const attacker = makeAttacker();
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    const dmgResult = calcDamage(attacker, target, SKILLS.burst_shot);
    expect(dmgResult.isWeaknessHit).toBe(true); // sanity: this is in fact a weakness hit

    const isNewDiscovery = recordHitDiscovery(dmgResult.isWeaknessHit, target, discoveredThisBattle, gameState);

    expect(isNewDiscovery).toBe(true);
    expect(discoveredThisBattle.has('mutant')).toBe(true);
    expect(gameState.discoveredWeaknesses?.['mutant']).toBe('fire');
  });

  it('does not throw and still updates discoveredThisBattle when gameState is undefined', () => {
    const attacker = makeAttacker();
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();

    const dmgResult = calcDamage(attacker, target, SKILLS.burst_shot);

    expect(() => recordHitDiscovery(dmgResult.isWeaknessHit, target, discoveredThisBattle, undefined)).not.toThrow();
    expect(discoveredThisBattle.has('mutant')).toBe(true);
  });
});

describe('recordHitDiscovery: idempotent on repeat hits within the same battle', () => {
  it('a second weakness hit on an already-discovered templateId is not a new discovery', () => {
    const attacker = makeAttacker();
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    const firstHit = calcDamage(attacker, target, SKILLS.burst_shot);
    recordHitDiscovery(firstHit.isWeaknessHit, target, discoveredThisBattle, gameState);

    const secondHit = calcDamage(attacker, target, SKILLS.burst_shot);
    const isNewDiscovery = recordHitDiscovery(secondHit.isWeaknessHit, target, discoveredThisBattle, gameState);

    expect(isNewDiscovery).toBe(false);
    expect(discoveredThisBattle.size).toBe(1);
    expect(Object.keys(gameState.discoveredWeaknesses ?? {})).toHaveLength(1);
    expect(gameState.discoveredWeaknesses?.['mutant']).toBe('fire');
  });
});

describe('recordHitDiscovery: non-weakness hit never records a discovery', () => {
  it('a thunder skill against a fire-weak enemy is not a weakness hit and is not recorded', () => {
    const attacker = makeAttacker();
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    const dmgResult = calcDamage(attacker, target, SKILLS.swift_strike);
    expect(dmgResult.isWeaknessHit).toBe(false); // sanity

    const isNewDiscovery = recordHitDiscovery(dmgResult.isWeaknessHit, target, discoveredThisBattle, gameState);

    expect(isNewDiscovery).toBe(false);
    expect(discoveredThisBattle.size).toBe(0);
    expect(gameState.discoveredWeaknesses?.['mutant']).toBeUndefined();
  });

  it('returns false when target has no weakness at all, even if isWeaknessHit is passed as true', () => {
    const target = createEnemy({ id: 'no_weakness_enemy', name: 'x', baseStats: { hp: 1, atk: 1, def: 1, spd: 1 }, skillIds: [] });
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    const isNewDiscovery = recordHitDiscovery(true, target, discoveredThisBattle, gameState);

    expect(isNewDiscovery).toBe(false);
    expect(discoveredThisBattle.size).toBe(0);
  });
});

describe('isWeaknessIconVisible: gates icon display by discoveredThisBattle membership', () => {
  it('is false when the character has no weakness, regardless of set membership', () => {
    const target = createEnemy({ id: 'plain', name: 'x', baseStats: { hp: 1, atk: 1, def: 1, spd: 1 }, skillIds: [] });
    const discoveredThisBattle = new Set<string>(['plain']);

    expect(isWeaknessIconVisible(target, discoveredThisBattle)).toBe(false);
  });

  it('is false when weakness exists but templateId has not been discovered yet', () => {
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>();

    expect(isWeaknessIconVisible(target, discoveredThisBattle)).toBe(false);
  });

  it('is true when weakness exists and templateId is in discoveredThisBattle', () => {
    const target = createEnemy(mutantTemplate);
    const discoveredThisBattle = new Set<string>(['mutant']);

    expect(isWeaknessIconVisible(target, discoveredThisBattle)).toBe(true);
  });
});

describe('discovery persists and carries forward from a prior save', () => {
  it('an enemy whose templateId is pre-seeded shows its weakness icon with no hit required', () => {
    const gameState = makeGameState({ raider_a: 'physical' as any });
    const discoveredThisBattle = seedDiscoveredThisBattle(gameState.discoveredWeaknesses);
    const target = createEnemy(raiderATemplate);

    expect(isWeaknessIconVisible(target, discoveredThisBattle)).toBe(true);
  });
});

describe('same-species reveal: discovering one instance reveals all instances with the same templateId', () => {
  it('hitting the weakness on one raider_a reveals the icon for a second, unhit raider_a', () => {
    const attacker = makeAttacker();
    const raiderA1 = createEnemy(raiderATemplate);
    const raiderA2 = createEnemy(raiderATemplate);
    const discoveredThisBattle = new Set<string>();
    const gameState = makeGameState();

    // Before any hit, neither instance shows its icon.
    expect(isWeaknessIconVisible(raiderA1, discoveredThisBattle)).toBe(false);
    expect(isWeaknessIconVisible(raiderA2, discoveredThisBattle)).toBe(false);

    const dmgResult = calcDamage(attacker, raiderA1, SKILLS.shield_bash);
    expect(dmgResult.isWeaknessHit).toBe(true); // sanity: shield_bash is physical, raider_a is physical-weak

    const isNewDiscovery = recordHitDiscovery(dmgResult.isWeaknessHit, raiderA1, discoveredThisBattle, gameState);
    expect(isNewDiscovery).toBe(true);

    // Both instances share templateId 'raider_a' — both reveal simultaneously.
    expect(isWeaknessIconVisible(raiderA1, discoveredThisBattle)).toBe(true);
    expect(isWeaknessIconVisible(raiderA2, discoveredThisBattle)).toBe(true);
  });
});
