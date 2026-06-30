import { describe, it, expect } from 'vitest';
import { BOSS_CONFIGS } from '../../src/data/bossConfigs';

// Spec: boss-phase-weakness — each of the 5 bosses gains a `weaknessOverride`
// on the single existing phase closest to 50% HP. Thresholds, aiType, and
// message text must stay unchanged — only weaknessOverride is added.

function phaseAt(bossId: string, threshold: number): any {
  return BOSS_CONFIGS[bossId].phases.find(p => p.hpThreshold === threshold);
}

describe('BOSS_CONFIGS weaknessOverride wiring', () => {
  it('vega: 0.5 phase carries weaknessOverride "ice", aiType/message unchanged', () => {
    const phase = phaseAt('vega', 0.5);
    expect(phase.weaknessOverride).toBe('ice');
    expect(phase.aiType).toBe('aggressive');
    expect(phase.message).toBe('「你逼我的！」');
  });

  it('crow: 0.6 phase carries weaknessOverride "thunder", aiType/message unchanged', () => {
    const phase = phaseAt('crow', 0.6);
    expect(phase.weaknessOverride).toBe('thunder');
    expect(phase.aiType).toBe('defensive');
    expect(phase.message).toBe('「有趣，讓我認真一點。」');
  });

  it('zora: 0.5 phase carries weaknessOverride "fire", aiType/message unchanged', () => {
    const phase = phaseAt('zora', 0.5);
    expect(phase.weaknessOverride).toBe('fire');
    expect(phase.aiType).toBe('normal');
    expect(phase.message).toBe('「你比我想的更頑強。」');
  });

  it('dex: 0.4 phase carries weaknessOverride "toxin", aiType/message unchanged', () => {
    const phase = phaseAt('dex', 0.4);
    expect(phase.weaknessOverride).toBe('toxin');
    expect(phase.aiType).toBe('aggressive');
    expect(phase.message).toBe('「鎧甲脫了，真的開始了。」');
  });

  it('aaaa: 0.6 phase carries weaknessOverride "ice", aiType/message unchanged', () => {
    const phase = phaseAt('aaaa', 0.6);
    expect(phase.weaknessOverride).toBe('ice');
    expect(phase.aiType).toBe('berserk');
    expect(phase.message).toBe('「...」');
  });

  it('regression: other phases (e.g. vega berserk at 0.2) have no weaknessOverride', () => {
    const phase = phaseAt('vega', 0.2);
    expect(phase.weaknessOverride).toBeUndefined();
  });

  it('regression: full-HP intro phases have no weaknessOverride', () => {
    expect(phaseAt('vega', 1.0).weaknessOverride).toBeUndefined();
    expect(phaseAt('crow', 1.0).weaknessOverride).toBeUndefined();
    expect(phaseAt('zora', 1.0).weaknessOverride).toBeUndefined();
    expect(phaseAt('dex', 1.0).weaknessOverride).toBeUndefined();
    expect(phaseAt('aaaa', 1.0).weaknessOverride).toBeUndefined();
  });

  it('regression: each boss still has exactly one phase carrying weaknessOverride', () => {
    for (const bossId of ['vega', 'crow', 'zora', 'dex', 'aaaa']) {
      const withOverride = BOSS_CONFIGS[bossId].phases.filter((p: any) => p.weaknessOverride);
      expect(withOverride).toHaveLength(1);
    }
  });
});
