import { describe, it, expect } from 'vitest';
import { windowFrameRects } from '../../src/ui/battleWindow';

describe('windowFrameRects', () => {
  it('bg 為整塊、outer 內縮 1、inner 內縮 5', () => {
    const f = windowFrameRects(118, 468, 236, 104);
    expect(f.bg).toEqual({ x: 118, y: 468, w: 236, h: 104 });
    expect(f.outer).toEqual({ x: 119, y: 469, w: 234, h: 102 });
    expect(f.inner).toEqual({ x: 123, y: 473, w: 226, h: 94 });
  });
});
