export function detectLocale(): string {
  try {
    const lang = globalThis.navigator?.language;
    return typeof lang === 'string' && lang.length > 0 ? lang : 'en';
  } catch {
    return 'en';
  }
}

/** Site language choices written by the site's EN / 繁中 switch (and `?lang=` on a page URL). */
export const SITE_LANG_KEY = 'gk:lang';
const SITE_LANGS = ['en', 'zh-TW'];

/** Own site: the visitor's explicit site language wins over the browser language. */
export function pickSiteLocale(stored: string | null, browser: string): string {
  return stored !== null && SITE_LANGS.includes(stored) ? stored : browser;
}

export function siteLocale(): string {
  let stored: string | null = null;
  try {
    stored = globalThis.localStorage?.getItem(SITE_LANG_KEY) ?? null;
  } catch {
    /* storage blocked: fall back to the browser language */
  }
  return pickSiteLocale(stored, detectLocale());
}
