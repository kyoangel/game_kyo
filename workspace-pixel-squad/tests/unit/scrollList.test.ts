import { describe, it, expect } from 'vitest';
import { computeMaxScroll, clampScroll } from '../../src/ui/scrollList';

// Drag-to-scroll math for BaseScene's squad/bench/inventory list, which can
// overflow the fixed 360x640 viewport once 5 squad members + bench + supply
// items are all rendered (see bug report: hub buttons became unreachable /
// overlapped by list content with a full 5-person squad, no way to scroll).

describe('computeMaxScroll', () => {
  it('returns 0 when content fits entirely within the viewport', () => {
    expect(computeMaxScroll(300, 472)).toBe(0);
  });

  it('returns 0 when content exactly fills the viewport', () => {
    expect(computeMaxScroll(472, 472)).toBe(0);
  });

  it('returns the overflow amount when content exceeds the viewport', () => {
    expect(computeMaxScroll(700, 472)).toBe(228);
  });
});

describe('clampScroll', () => {
  it('clamps negative targets up to 0', () => {
    expect(clampScroll(-40, 228)).toBe(0);
  });

  it('clamps targets above maxScroll down to maxScroll', () => {
    expect(clampScroll(500, 228)).toBe(228);
  });

  it('passes through values already within [0, maxScroll]', () => {
    expect(clampScroll(100, 228)).toBe(100);
  });

  it('always returns 0 when maxScroll is 0 (nothing to scroll)', () => {
    expect(clampScroll(50, 0)).toBe(0);
    expect(clampScroll(-50, 0)).toBe(0);
  });
});
