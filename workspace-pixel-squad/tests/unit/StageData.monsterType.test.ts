import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';
import type { EnemyTemplate } from '../../src/types';

// Helper: find a specific enemy object within a stage.
// Tests fail with "monsterType is undefined" because stages.ts does not yet set it.
function enemy(stageId: string, enemyId: string): EnemyTemplate {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) throw new Error(`Stage '${stageId}' not found`);
  const e = stage.enemies.find(e => e.id === enemyId);
  if (!e) throw new Error(`Enemy '${enemyId}' not found in stage '${stageId}'`);
  return e;
}

describe('Enemy monsterType — humanoid mutants → demon', () => {
  it('mutant (stage 1-1) maps to demon', () => {
    expect((enemy('1-1', 'mutant') as any).monsterType).toBe('demon');
  });

  it('mutant_a (stage 1-2) maps to demon', () => {
    expect((enemy('1-2', 'mutant_a') as any).monsterType).toBe('demon');
  });

  it('mutant_b (stage 1-2) maps to demon', () => {
    expect((enemy('1-2', 'mutant_b') as any).monsterType).toBe('demon');
  });
});

describe('Enemy monsterType — feral wolves → small_dragon', () => {
  it('wolf_a (stage 1-3) maps to small_dragon', () => {
    expect((enemy('1-3', 'wolf_a') as any).monsterType).toBe('small_dragon');
  });

  it('wolf_b (stage 1-3) maps to small_dragon', () => {
    expect((enemy('1-3', 'wolf_b') as any).monsterType).toBe('small_dragon');
  });
});

describe('Enemy monsterType — raiders → demon', () => {
  it('raider (stage 1-4) maps to demon', () => {
    expect((enemy('1-4', 'raider') as any).monsterType).toBe('demon');
  });

  it('raider_sniper (stage 1-4) maps to demon', () => {
    expect((enemy('1-4', 'raider_sniper') as any).monsterType).toBe('demon');
  });

  it('raider_cap (stage 2-3) maps to demon', () => {
    expect((enemy('2-3', 'raider_cap') as any).monsterType).toBe('demon');
  });
});

describe('Enemy monsterType — ground crawlers → lizard', () => {
  it('waste_dog (stage 2-1) maps to lizard', () => {
    expect((enemy('2-1', 'waste_dog') as any).monsterType).toBe('lizard');
  });

  it('em_spider (stage 4-1) maps to lizard', () => {
    expect((enemy('4-1', 'em_spider') as any).monsterType).toBe('lizard');
  });
});

describe('Enemy monsterType — mechanical / ethereal units → jinn', () => {
  it('mech_a (stage 2-4) maps to jinn', () => {
    expect((enemy('2-4', 'mech_a') as any).monsterType).toBe('jinn');
  });

  it('mech_b (stage 2-4) maps to jinn', () => {
    expect((enemy('2-4', 'mech_b') as any).monsterType).toBe('jinn');
  });

  it('mech_soldier (stage 4-3) maps to jinn', () => {
    expect((enemy('4-3', 'mech_soldier') as any).monsterType).toBe('jinn');
  });

  it('em_guard_a (stage 4-3) maps to jinn', () => {
    expect((enemy('4-3', 'em_guard_a') as any).monsterType).toBe('jinn');
  });

  it('forge_bot (stage 4-2) maps to jinn', () => {
    expect((enemy('4-2', 'forge_bot') as any).monsterType).toBe('jinn');
  });

  it('elite_mech_a (stage 4-4) maps to jinn', () => {
    expect((enemy('4-4', 'elite_mech_a') as any).monsterType).toBe('jinn');
  });

  it('top_samurai (stage 5-4) maps to jinn', () => {
    expect((enemy('5-4', 'top_samurai') as any).monsterType).toBe('jinn');
  });
});

describe('Enemy monsterType — human soldiers → demon', () => {
  it('soldier (stage 2-4) maps to demon', () => {
    expect((enemy('2-4', 'soldier') as any).monsterType).toBe('demon');
  });

  it('soldier_a (stage 3-2) maps to demon', () => {
    expect((enemy('3-2', 'soldier_a') as any).monsterType).toBe('demon');
  });

  it('franken (stage 3-2) maps to demon', () => {
    expect((enemy('3-2', 'franken') as any).monsterType).toBe('demon');
  });

  it('bomber (stage 3-3) maps to demon', () => {
    expect((enemy('3-3', 'bomber') as any).monsterType).toBe('demon');
  });

  it('sniper (stage 3-4) maps to demon', () => {
    expect((enemy('3-4', 'sniper') as any).monsterType).toBe('demon');
  });

  it('ruin_guard_a (stage 5-2) maps to demon', () => {
    expect((enemy('5-2', 'ruin_guard_a') as any).monsterType).toBe('demon');
  });
});

describe('Enemy monsterType — large mutant beasts → dragon', () => {
  it('beast_a (stage 3-1) maps to dragon', () => {
    expect((enemy('3-1', 'beast_a') as any).monsterType).toBe('dragon');
  });

  it('beast_b (stage 3-1) maps to dragon', () => {
    expect((enemy('3-1', 'beast_b') as any).monsterType).toBe('dragon');
  });

  it('beast_c (stage 3-1) maps to dragon', () => {
    expect((enemy('3-1', 'beast_c') as any).monsterType).toBe('dragon');
  });

  it('gargoyle (stage 5-2) maps to dragon', () => {
    expect((enemy('5-2', 'gargoyle') as any).monsterType).toBe('dragon');
  });
});

describe('Boss enemy monsterType — AC8, AC9', () => {
  // AC: Vega (1-5) → demon
  it('vega boss (stage 1-5) has monsterType demon', () => {
    expect((enemy('1-5', 'vega') as any).monsterType).toBe('demon');
  });

  // AC: Crow (2-5) → jinn
  it('crow boss (stage 2-5) has monsterType jinn', () => {
    expect((enemy('2-5', 'crow') as any).monsterType).toBe('jinn');
  });

  // AC8: Zora (3-5) → medusa
  it('zora boss (stage 3-5) has monsterType medusa', () => {
    expect((enemy('3-5', 'zora') as any).monsterType).toBe('medusa');
  });

  // AC9: Dex (4-5) → dragon
  it('dex boss (stage 4-5) has monsterType dragon', () => {
    expect((enemy('4-5', 'dex') as any).monsterType).toBe('dragon');
  });

  // Final boss → demon
  it('aaaa boss (stage 5-5) has monsterType demon', () => {
    expect((enemy('5-5', 'aaaa') as any).monsterType).toBe('demon');
  });
});

describe('Enemy monsterType — no unknown MonsterType values', () => {
  const VALID_MONSTER_TYPES = new Set(['demon', 'dragon', 'jinn', 'lizard', 'medusa', 'small_dragon', undefined]);

  it('every enemy monsterType is either a valid MonsterType or undefined (for unmapped enemies)', () => {
    STAGES.forEach(stage => {
      stage.enemies.forEach(e => {
        const mt = (e as any).monsterType;
        expect(
          VALID_MONSTER_TYPES.has(mt),
          `Enemy '${e.id}' in stage '${stage.id}' has invalid monsterType: '${mt}'`,
        ).toBe(true);
      });
    });
  });
});
