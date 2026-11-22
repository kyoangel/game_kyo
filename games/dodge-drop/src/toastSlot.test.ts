import { describe, expect, it } from 'vitest';
import { nextToastSlot, rushBannerUntil } from './toastSlot.ts';

describe('nextToastSlot', () => {
  it('shows immediately when the queue is free', () => {
    expect(nextToastSlot(1000, 0, 1600)).toEqual({ showAt: 1000, freeAt: 2600 });
  });
  it('queues a second toast behind the first even when it arrives a moment later', () => {
    const a = nextToastSlot(1000, 0, 1600);
    const b = nextToastSlot(1250, a.freeAt, 1600);
    expect(b.showAt).toBe(2600);
    expect(b.freeAt).toBe(4200);
  });
  it('never schedules in the past once the queue drained', () => {
    expect(nextToastSlot(9000, 2600, 1600).showAt).toBe(9000);
  });
});

describe('rushBannerUntil', () => {
  it('normal rush: banner ends 0.8 s after the rush starts', () => {
    expect(rushBannerUntil(45, 0)).toBe(45.8);
    expect(rushBannerUntil(90, 0)).toBe(90.8);
  });
  it('gold start (rush at 90 s inside the 2 s tier banner): banner shows after the tier banner, 0.8 s', () => {
    expect(rushBannerUntil(90, 92)).toBeCloseTo(92.8);
  });
  it('rush that starts after the tier banner window is unaffected', () => {
    expect(rushBannerUntil(90, 62)).toBe(90.8);
  });
});
