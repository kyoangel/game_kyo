import { describe, expect, it } from 'vitest';
import { topRightSlotX } from './topRight.ts';

describe('topRightSlotX', () => {
  it('puts mute at width - 60 and every next icon one step (76) left', () => {
    expect(topRightSlotX(720, 0)).toBe(660);
    expect(topRightSlotX(720, 1)).toBe(584);
    expect(topRightSlotX(720, 2)).toBe(508);
  });
  it('keeps equal spacing between neighbours', () => {
    expect(topRightSlotX(720, 0) - topRightSlotX(720, 1)).toBe(topRightSlotX(720, 1) - topRightSlotX(720, 2));
  });
});
