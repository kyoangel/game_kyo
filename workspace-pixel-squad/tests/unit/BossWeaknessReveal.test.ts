import { describe, it, expect } from 'vitest';
import { revealBossWeakness } from '../../src/battle/BossWeaknessReveal';
import type { BossPhase } from '../../src/battle/BossAI';
import type { Character, GameState } from '../../src/types';

// Spec: boss-phase-weakness — the first time a boss phase with
// `weaknessOverride` is entered, the boss's live `weakness` field must be set
// permanently and (when a GameState is available) the discovery must be
// recorded immediately via recordWeaknessDiscovery, independent of any
// player hit landing. This pure logic is extracted out of BattleScene's
// Phaser-bound executeEnemyAction so it can be unit tested without a scene.

function makeBoss(templateId: string, hp: number, maxHp: number): Character {
  return {
    id: 'boss_1',
    templateId,
    name: templateId,
    isProtagonist: false,
    isPlayer: false,
    level: 1,
    exp: 0,
    expToNext: 50,
    stats: { hp, maxHp, atk: 30, def: 10, spd: 10 },
    skills: [],
    statPoints: 0,
    archetype: '坦克',
    alive: true,
    defending: false,
    activeBuffs: [],
    activeStatusEffects: [],
    skillCooldowns: {},
  };
}

function makeGameState(): GameState {
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
    discoveredWeaknesses: {},
  };
}

describe('revealBossWeakness', () => {
  it('sets enemy.weakness to phase.weaknessOverride when present', () => {
    const boss = makeBoss('vega', 100, 200);
    const phase = { hpThreshold: 0.5, aiType: 'aggressive', weaknessOverride: 'ice' } as BossPhase;

    revealBossWeakness(boss, phase);

    expect((boss as any).weakness).toBe('ice');
  });

  it('records the discovery on gameState.discoveredWeaknesses keyed by templateId', () => {
    const boss = makeBoss('crow', 132, 220);
    const phase = { hpThreshold: 0.6, aiType: 'defensive', weaknessOverride: 'thunder' } as BossPhase;
    const state = makeGameState();

    revealBossWeakness(boss, phase, state);

    expect(state.discoveredWeaknesses?.['crow']).toBe('thunder');
  });

  it('does not throw and still sets weakness when gameState is undefined', () => {
    const boss = makeBoss('zora', 130, 260);
    const phase = { hpThreshold: 0.5, aiType: 'normal', weaknessOverride: 'fire' } as BossPhase;

    expect(() => revealBossWeakness(boss, phase, undefined)).not.toThrow();
    expect((boss as any).weakness).toBe('fire');
  });

  it('is a no-op on the weakness field when the phase has no weaknessOverride', () => {
    const boss = makeBoss('vega', 40, 200);
    (boss as any).weakness = 'ice'; // already revealed in an earlier phase
    const berserkPhase: BossPhase = { hpThreshold: 0.2, aiType: 'berserk', message: '「我不會倒下的！」' };

    revealBossWeakness(boss, berserkPhase);

    expect((boss as any).weakness).toBe('ice'); // unchanged, never cleared
  });

  it('does not record a discovery when the phase has no weaknessOverride', () => {
    const boss = makeBoss('vega', 40, 200);
    const state = makeGameState();
    const berserkPhase: BossPhase = { hpThreshold: 0.2, aiType: 'berserk', message: '「我不會倒下的！」' };

    revealBossWeakness(boss, berserkPhase, state);

    expect(state.discoveredWeaknesses?.['vega']).toBeUndefined();
  });

  it.each([
    ['vega', 'ice'],
    ['crow', 'thunder'],
    ['zora', 'fire'],
    ['dex', 'toxin'],
    ['aaaa', 'ice'],
  ])('reveals %s weakness as %s and records it under its templateId', (templateId, element) => {
    const boss = makeBoss(templateId, 1, 100);
    const phase = { hpThreshold: 0.5, aiType: 'normal', weaknessOverride: element } as BossPhase;
    const state = makeGameState();

    revealBossWeakness(boss, phase, state);

    expect((boss as any).weakness).toBe(element);
    expect(state.discoveredWeaknesses?.[templateId]).toBe(element);
  });

  it('only mutates the passed-in boss instance, not unrelated characters', () => {
    const boss = makeBoss('dex', 160, 400);
    const ally = makeBoss('player_1', 100, 100);
    const phase = { hpThreshold: 0.4, aiType: 'aggressive', weaknessOverride: 'toxin' } as BossPhase;

    revealBossWeakness(boss, phase);

    expect((boss as any).weakness).toBe('toxin');
    expect((ally as any).weakness).toBeUndefined();
  });
});
