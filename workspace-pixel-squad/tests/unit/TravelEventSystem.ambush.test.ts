import { describe, it, expect } from 'vitest';
import {
  getAmbushDifficulty,
  resolveAmbushEvent,
  type Resources,
} from '../../src/battle/TravelEventSystem';

// Spec: specs/pixel-squad-random-travel-events.md
// battle/TravelEventSystem.ts does not exist yet — every import above fails
// to resolve, which is the expected "not implemented" failure mode for this
// suite. Covers Event Type 2 (Ambush) and the Ambush-specific acceptance
// criterion: "When combat is resolved, Then the outcome (win/loss) correctly
// updates `resources` and journey logs."

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { currency: 100, food: 10, medicine: 5, ...overrides };
}

describe('getAmbushDifficulty — scales with current game stage/chapter progression', () => {
  it('is a positive number for an early chapter', () => {
    expect(getAmbushDifficulty(1)).toBeGreaterThan(0);
  });

  it('does not decrease as chapter progression increases', () => {
    const early = getAmbushDifficulty(1);
    const mid = getAmbushDifficulty(3);
    const late = getAmbushDifficulty(5);
    expect(mid).toBeGreaterThanOrEqual(early);
    expect(late).toBeGreaterThanOrEqual(mid);
  });

  it('strictly increases between chapter 1 and chapter 5', () => {
    expect(getAmbushDifficulty(5)).toBeGreaterThan(getAmbushDifficulty(1));
  });
});

describe('resolveAmbushEvent — retreating always resolves as a loss with a resource cost', () => {
  it('returns outcome "loss" when the player retreats, regardless of seed', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = resolveAmbushEvent(makeResources(), 1, seed, true);
      expect(result.outcome).toBe('loss');
    }
  });

  it('reduces resources on retreat', () => {
    const resources = makeResources();
    const result = resolveAmbushEvent(resources, 1, 0, true);
    const totalBefore = resources.currency + resources.food + resources.medicine;
    const totalAfter = result.resources.currency + result.resources.food + result.resources.medicine;
    expect(totalAfter).toBeLessThan(totalBefore);
  });
});

describe('resolveAmbushEvent — combat resolution produces both win and loss outcomes across seeds', () => {
  it('produces at least one win and at least one loss for a fixed difficulty across many seeds', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const result = resolveAmbushEvent(makeResources(), 1, seed, false);
      outcomes.add(result.outcome);
    }
    expect(outcomes).toEqual(new Set(['win', 'loss']));
  });

  it('on a win, grants loot that increases total resources', () => {
    let found = false;
    for (let seed = 0; seed < 100 && !found; seed++) {
      const resources = makeResources();
      const result = resolveAmbushEvent(resources, 1, seed, false);
      if (result.outcome === 'win') {
        found = true;
        const totalBefore = resources.currency + resources.food + resources.medicine;
        const totalAfter = result.resources.currency + result.resources.food + result.resources.medicine;
        expect(totalAfter).toBeGreaterThan(totalBefore);
      }
    }
    expect(found).toBe(true);
  });

  it('on a loss (not retreating), reduces total resources', () => {
    let found = false;
    for (let seed = 0; seed < 100 && !found; seed++) {
      const resources = makeResources();
      const result = resolveAmbushEvent(resources, 1, seed, false);
      if (result.outcome === 'loss') {
        found = true;
        const totalBefore = resources.currency + resources.food + resources.medicine;
        const totalAfter = result.resources.currency + result.resources.food + result.resources.medicine;
        expect(totalAfter).toBeLessThan(totalBefore);
      }
    }
    expect(found).toBe(true);
  });
});

describe('resolveAmbushEvent — determinism (Rule 4: reproducible per seed)', () => {
  it('returns identical resources and outcome for the same inputs every call', () => {
    const resources = makeResources();
    const first = resolveAmbushEvent(resources, 3, 42, false);
    const second = resolveAmbushEvent(resources, 3, 42, false);
    expect(second).toEqual(first);
  });
});

describe('resolveAmbushEvent — purity and logging', () => {
  it('does not mutate the input resources object', () => {
    const resources = makeResources();
    const snapshot = { ...resources };
    resolveAmbushEvent(resources, 2, 5, false);
    expect(resources).toEqual(snapshot);
  });

  it('returns a journey log entry of type ambush describing the outcome', () => {
    const result = resolveAmbushEvent(makeResources(), 2, 5, false);
    expect(result.log.type).toBe('ambush');
    expect(result.log.description.toLowerCase()).toContain(result.outcome);
  });
});
