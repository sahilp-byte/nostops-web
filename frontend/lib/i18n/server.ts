import { cookies } from 'next/headers';
import { LOCALE_COOKIE, coerceLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { MESSAGES } from '@/lib/i18n/messages';

// Server-side translator for RSC pages/components. Reads the locale cookie and
// returns a t(key) that mirrors the client useI18n().t (English fallback).
export async function getServerT(): Promise<(key: string) => string> {
  const locale = coerceLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (key: string) => MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
}
