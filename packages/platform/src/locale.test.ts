import { describe, expect, it } from 'vitest';
import { pickSiteLocale } from './locale.ts';

describe('pickSiteLocale', () => {
  it('uses the site language the visitor chose', () => {
    expect(pickSiteLocale('en', 'zh-TW')).toBe('en');
    expect(pickSiteLocale('zh-TW', 'en-US')).toBe('zh-TW');
  });
  it('falls back to the browser language when nothing (or junk) is stored', () => {
    expect(pickSiteLocale(null, 'zh-TW')).toBe('zh-TW');
    expect(pickSiteLocale('fr', 'en-US')).toBe('en-US');
  });
});
