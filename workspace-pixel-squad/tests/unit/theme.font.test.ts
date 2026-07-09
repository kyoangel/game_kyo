import { describe, it, expect } from 'vitest';
import { FONT_FAMILY, TextStyles } from '../../src/ui/theme';

describe('pixel font integration', () => {
  it('FONT_FAMILY 指向 Fusion Pixel 並保留 monospace fallback', () => {
    expect(FONT_FAMILY).toContain('Fusion Pixel');
    expect(FONT_FAMILY).toContain('monospace');
  });
  it('所有 TextStyles 都使用 FONT_FAMILY', () => {
    for (const style of Object.values(TextStyles)) {
      expect((style as { fontFamily?: string }).fontFamily).toBe(FONT_FAMILY);
    }
  });
});
