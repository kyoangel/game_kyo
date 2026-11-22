import { describe, expect, it } from 'vitest';
import { nextToastSlot } from './toastSlot.ts';

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
