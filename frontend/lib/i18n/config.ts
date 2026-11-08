// i18n config for the app UI. Locale is persisted in a readable cookie so the
// server render and client hydrate agree. Content translation is phased; this
// covers the core UI (nav, header, search, common labels). See messages.ts.

export const LOCALE_COOKIE = 'nostops_locale';

export type Locale = 'en' | 'hi' | 'mr' | 'bn' | 'ta' | 'te';

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALES: Array<{ code: Locale; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
];

const CODES = new Set(LOCALES.map((l) => l.code));

export function coerceLocale(value: string | undefined | null): Locale {
  return value && CODES.has(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

// Pick the visitor's most-preferred SUPPORTED language from an Accept-Language
// header (respecting q-weights). Returns null if none of our locales match.
export function detectLocaleFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { base: (tag || '').trim().toLowerCase().split('-')[0], q: q ? parseFloat(q) : 1 };
    })
    .filter((x) => x.base)
    .sort((a, b) => b.q - a.q);
  for (const { base } of ranked) {
    if (CODES.has(base as Locale)) return base as Locale;
  }
  return null;
}

export function nativeName(code: Locale): string {
  return LOCALES.find((l) => l.code === code)?.native ?? code;
}
