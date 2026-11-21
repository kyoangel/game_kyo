import { describe, expect, it } from 'vitest';
import { cssColor, DEFAULT_THEME, resolveTheme } from './theme.ts';

describe('theme', () => {
  it('resolveTheme() equals DEFAULT_THEME', () => {
    expect(resolveTheme()).toEqual(DEFAULT_THEME);
  });
  it('partial override replaces only given keys', () => {
    const t = resolveTheme({ primary: 0x123456 });
    expect(t.primary).toBe(0x123456);
    expect(t.accent).toBe(DEFAULT_THEME.accent);
  });
  it('cssColor formats hex', () => {
    expect(cssColor(0x0000ff)).toBe('#0000ff');
    expect(cssColor(0x3ff0ff)).toBe('#3ff0ff');
  });
});
