import { describe, it, expect } from 'vitest';
import {
  TRAVEL_EVENT_TYPES,
  selectTravelEvent,
  beginTravelPhase,
} from '../../src/battle/TravelEventSystem';

// Spec: specs/pixel-squad-random-travel-events.md
// battle/TravelEventSystem.ts does not exist yet — every import above fails
// to resolve, which is the expected "not implemented" failure mode for this
// suite. Covers Rule 1/2/4 and AC-1/AC-2 (event selection is deterministic
// per journey-segment seed and always resolves to one of the three types).

describe('TRAVEL_EVENT_TYPES', () => {
  it('contains exactly supply_drop, ambush, and merchant', () => {
    expect(new Set(TRAVEL_EVENT_TYPES)).toEqual(new Set(['supply_drop', 'ambush', 'merchant']));
  });

  it('has no duplicate entries', () => {
    expect(new Set(TRAVEL_EVENT_TYPES).size).toBe(TRAVEL_EVENT_TYPES.length);
  });
});

describe('selectTravelEvent — Rule 2: always one of the three event types', () => {
  it('returns a value from TRAVEL_EVENT_TYPES for a wide range of seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(TRAVEL_EVENT_TYPES).toContain(selectTravelEvent(seed));
    }
  });
});

describe('selectTravelEvent — Rule 4: deterministic based on the journey segment seed', () => {
  it('returns the exact same event type every time for the same seed', () => {
    const seed = 12345;
    const first = selectTravelEvent(seed);
    for (let i = 0; i < 10; i++) {
      expect(selectTravelEvent(seed)).toBe(first);
    }
  });

  it('is reproducible across independent calls with seed 0', () => {
    expect(selectTravelEvent(0)).toBe(selectTravelEvent(0));
  });

  it('is reproducible across independent calls with a large seed', () => {
    expect(selectTravelEvent(987654321)).toBe(selectTravelEvent(987654321));
  });
});

describe('selectTravelEvent — every event type is actually reachable', () => {
  it('produces all three event types somewhere across seeds 0..999', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      seen.add(selectTravelEvent(seed));
    }
    expect(seen).toEqual(new Set(TRAVEL_EVENT_TYPES));
  });
});

describe('beginTravelPhase — AC-1/AC-2: TravelPhase begins and triggers a random event from the segment seed', () => {
  it('resolves eventType to exactly what selectTravelEvent would return for the same seed', () => {
    const seed = 42;
    const result = beginTravelPhase(seed);
    expect(result.eventType).toBe(selectTravelEvent(seed));
  });

  it('returns a journey log entry describing the triggered event', () => {
    const result = beginTravelPhase(7);
    expect(result.log.type).toBe(result.eventType);
    expect(result.log.seed).toBe(7);
    expect(typeof result.log.description).toBe('string');
    expect(result.log.description.length).toBeGreaterThan(0);
  });

  it('is deterministic — same seed produces the same eventType and log every call', () => {
    const seed = 555;
    const a = beginTravelPhase(seed);
    const b = beginTravelPhase(seed);
    expect(a).toEqual(b);
  });
});
