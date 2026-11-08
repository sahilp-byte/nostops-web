'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { nativeName, type Locale } from '@/lib/i18n/config';

// First-visit language offer. Rendered only when the server detected a supported
// non-English browser language and no locale cookie exists yet. Either action
// writes the locale cookie, so the offer never shows again.
export default function LanguageSuggestionToast({ suggested }: { suggested: Locale }) {
  const { setLocale } = useI18n();
  const native = nativeName(suggested);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4" data-testid="language-suggest-toast">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-xl">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg">🌐</span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink">
          View NOSTOPS in <span className="text-brand-700">{native}</span>?
        </p>
        <button
          type="button"
          onClick={() => setLocale('en')}
          data-testid="language-suggest-dismiss"
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream"
        >
          Keep English
        </button>
        <button
          type="button"
          onClick={() => setLocale(suggested)}
          data-testid="language-suggest-accept"
          className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          {native}
        </button>
      </div>
    </div>
  );
}
