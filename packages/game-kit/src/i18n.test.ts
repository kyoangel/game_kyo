import { describe, expect, it } from 'vitest';
import { createI18n, mergeStrings, resolveLocale } from './i18n.ts';

describe('resolveLocale', () => {
  const avail = ['en', 'zh-TW'];
  it('exact match', () => expect(resolveLocale(avail, 'zh-TW')).toBe('zh-TW'));
  it('base-language match', () => expect(resolveLocale(avail, 'zh-HK')).toBe('zh-TW'));
  it('case-insensitive base match', () => expect(resolveLocale(avail, 'EN-us')).toBe('en'));
  it('falls back to en', () => expect(resolveLocale(avail, 'fr-FR')).toBe('en'));
});

describe('mergeStrings', () => {
  it('later sets override earlier per key, per locale', () => {
    const merged = mergeStrings({ en: { a: '1', b: '2' } }, { en: { b: 'B' }, 'zh-TW': { a: '一' } });
    expect(merged).toEqual({ en: { a: '1', b: 'B' }, 'zh-TW': { a: '一' } });
  });
});

describe('createI18n', () => {
  const t = createI18n({ en: { hi: 'Hi', only: 'EN only' }, 'zh-TW': { hi: '嗨' } }, 'zh-TW');
  it('uses the resolved locale', () => expect(t('hi')).toBe('嗨'));
  it('falls back to en for missing keys', () => expect(t('only')).toBe('EN only'));
  it('returns the key when nothing matches', () => expect(t('nope')).toBe('nope'));
});
