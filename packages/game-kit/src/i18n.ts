export type Strings = Record<string, Record<string, string>>;

export function mergeStrings(...sets: Strings[]): Strings {
  const out: Strings = {};
  for (const set of sets) {
    for (const [locale, dict] of Object.entries(set)) {
      out[locale] = { ...(out[locale] ?? {}), ...dict };
    }
  }
  return out;
}

export function resolveLocale(available: string[], requested: string): string {
  if (available.includes(requested)) return requested;
  const base = requested.split('-')[0]?.toLowerCase() ?? '';
  const byBase = available.find((l) => l.split('-')[0]?.toLowerCase() === base);
  return byBase ?? 'en';
}

export function createI18n(strings: Strings, locale: string): (key: string) => string {
  const loc = resolveLocale(Object.keys(strings), locale);
  return (key) => strings[loc]?.[key] ?? strings.en?.[key] ?? key;
}
