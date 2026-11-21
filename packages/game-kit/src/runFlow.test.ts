import { describe, expect, it } from 'vitest';
import { RunFlow } from './runFlow.ts';

describe('RunFlow', () => {
  it('offers revive only when a callback exists, rewarded ads are on, and it is unused', () => {
    const f = new RunFlow();
    expect(f.canOfferRevive(true, true)).toBe(true);
    expect(f.canOfferRevive(false, true)).toBe(false);
    expect(f.canOfferRevive(true, false)).toBe(false);
  });
  it('allows only one revive per run', () => {
    const f = new RunFlow();
    f.markReviveUsed();
    expect(f.canOfferRevive(true, true)).toBe(false);
  });
  it('reset re-enables revive', () => {
    const f = new RunFlow();
    f.markReviveUsed();
    f.reset();
    expect(f.canOfferRevive(true, true)).toBe(true);
  });
});
