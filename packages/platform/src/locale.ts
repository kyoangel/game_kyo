export function detectLocale(): string {
  try {
    const lang = globalThis.navigator?.language;
    return typeof lang === 'string' && lang.length > 0 ? lang : 'en';
  } catch {
    return 'en';
  }
}
