import { describe, it, expect } from 'vitest';
import { resolveSupplyDropEvent, type Resources } from '../../src/battle/TravelEventSystem';

// Spec: specs/pixel-squad-random-travel-events.md
// battle/TravelEventSystem.ts does not exist yet — every import above fails
// to resolve, which is the expected "not implemented" failure mode for this
// suite. Covers Event Type 1 (Supply Drop) and AC-2 (effect applied to the
// player's `resources` object).

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { currency: 100, food: 10, medicine: 5, ...overrides };
}

describe('resolveSupplyDropEvent — grants a small randomized amount of basic resources', () => {
  it('increases food by a small positive amount', () => {
    const resources = makeResources();
    const result = resolveSupplyDropEvent(resources, 1);
    expect(result.resources.food).toBeGreaterThan(resources.food);
    expect(result.resources.food - resources.food).toBeLessThanOrEqual(10);
  });

  it('increases medicine by a small positive amount', () => {
    const resources = makeResources();
    const result = resolveSupplyDropEvent(resources, 1);
    expect(result.resources.medicine).toBeGreaterThan(resources.medicine);
    expect(result.resources.medicine - resources.medicine).toBeLessThanOrEqual(10);
  });

  it('never leaves food or medicine unchanged (grant is always non-zero)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const resources = makeResources();
      const result = resolveSupplyDropEvent(resources, seed);
      expect(result.resources.food).toBeGreaterThan(resources.food);
      expect(result.resources.medicine).toBeGreaterThan(resources.medicine);
    }
  });
});

describe('resolveSupplyDropEvent — may optionally grant a minor currency bonus', () => {
  it('sometimes leaves currency unchanged and sometimes grants a small bonus across many seeds', () => {
    const resources = makeResources();
    const currencyDeltas = new Set<number>();
    for (let seed = 0; seed < 100; seed++) {
      const result = resolveSupplyDropEvent(resources, seed);
      currencyDeltas.add(result.resources.currency - resources.currency);
    }
    expect(currencyDeltas.has(0)).toBe(true);
    expect([...currencyDeltas].some(d => d > 0)).toBe(true);
  });

  it('never grants a currency bonus larger than a minor amount', () => {
    const resources = makeResources();
    for (let seed = 0; seed < 100; seed++) {
      const result = resolveSupplyDropEvent(resources, seed);
      expect(result.resources.currency - resources.currency).toBeLessThanOrEqual(5);
      expect(result.resources.currency - resources.currency).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('resolveSupplyDropEvent — determinism (Rule 4: reproducible per seed)', () => {
  it('returns identical resources for the same seed and starting resources every call', () => {
    const resources = makeResources();
    const first = resolveSupplyDropEvent(resources, 99);
    const second = resolveSupplyDropEvent(resources, 99);
    expect(second.resources).toEqual(first.resources);
  });
});

describe('resolveSupplyDropEvent — purity and logging', () => {
  it('does not mutate the input resources object', () => {
    const resources = makeResources();
    const snapshot = { ...resources };
    resolveSupplyDropEvent(resources, 3);
    expect(resources).toEqual(snapshot);
  });

  it('returns a journey log entry of type supply_drop', () => {
    const result = resolveSupplyDropEvent(makeResources(), 3);
    expect(result.log.type).toBe('supply_drop');
    expect(typeof result.log.description).toBe('string');
    expect(result.log.description.length).toBeGreaterThan(0);
  });
});
