'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { LOCALES } from '@/lib/i18n/config';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Language')}
        title={t('Language')}
        data-testid="language-switcher"
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition hover:bg-cream"
      >
        <span aria-hidden="true">🌐</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-line bg-white p-2 shadow-lg">
          <p className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted">{t('Language')}</p>
          {LOCALES.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={locale === l.code}
              type="button"
              onClick={() => { setLocale(l.code); setOpen(false); }}
              data-testid={`lang-${l.code}`}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-cream ${
                locale === l.code ? 'text-brand-700' : 'text-ink-soft'
              }`}
            >
              <span>{l.native}<span className="ml-1 text-xs text-muted">{l.code === 'en' ? '' : `· ${l.label}`}</span></span>
              {locale === l.code && <span aria-hidden="true" className="text-brand-700">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
