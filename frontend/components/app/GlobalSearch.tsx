'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';

type Page = { label: string; href: string };
type Hit = { id: string; label: string; sub?: string; badge?: string; href: string };

function mapTeacher(it: any): Hit | null {
  const handle = String(it?.route || '').split('/').filter(Boolean).pop();
  if (!handle) return null;
  return { id: it.id, label: it.label, sub: it.sub, badge: it.badge, href: `/teachers/${handle}` };
}
function mapGuru(it: any): Hit | null {
  const route = String(it?.route || '');
  const href = route.startsWith('/council/') ? route : `/council/${it.id}`;
  return { id: it.id, label: it.label, sub: it.sub, href };
}

export default function GlobalSearch({ pages }: { pages: Page[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Hit[]>([]);
  const [gurus, setGurus] = useState<Hit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K to open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(''); setTeachers([]); setGurus([]); }
  }, [open]);

  // Debounced backend search.
  useEffect(() => {
    const needle = q.trim();
    if (!needle) { setTeachers([]); setGurus([]); setLoading(false); return; }
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`/bff/search?q=${encodeURIComponent(needle)}`, { credentials: 'same-origin' });
        const d = await r.json();
        const res = d?.results || {};
        setTeachers(((res.teachers as any[]) || []).map(mapTeacher).filter(Boolean) as Hit[]);
        setGurus(((res.council_gurus as any[]) || []).map(mapGuru).filter(Boolean) as Hit[]);
      } catch {
        setTeachers([]); setGurus([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  const go = useCallback((href: string) => { setOpen(false); router.push(href); }, [router]);

  const needle = q.trim().toLowerCase();
  const pageHits = (needle ? pages.filter((p) => p.label.toLowerCase().includes(needle)) : pages).slice(0, 6);
  const hasResults = pageHits.length > 0 || teachers.length > 0 || gurus.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('Search')}
        title={t('Search')}
        data-testid="search-open"
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition hover:bg-cream"
      >
        <span aria-hidden="true">🔍</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[10vh]" data-testid="search-overlay">
          <button aria-label="Close search" className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <span aria-hidden="true" className="text-muted">🔍</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('searchPlaceholder')}
                data-testid="search-input"
                className="w-full bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-muted"
              />
              {loading && <span className="text-xs font-semibold text-muted">…</span>}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {pageHits.length > 0 && (
                <Section title={t('Pages')}>
                  {pageHits.map((p) => (
                    <Row key={p.href} onClick={() => go(p.href)} icon="→" label={p.label} testid="search-page" />
                  ))}
                </Section>
              )}
              {teachers.length > 0 && (
                <Section title={t('Teachers')}>
                  {teachers.map((h) => (
                    <Row key={h.id} onClick={() => go(h.href)} icon="🧘" label={h.label} sub={h.sub} badge={h.badge} testid="search-teacher" />
                  ))}
                </Section>
              )}
              {gurus.length > 0 && (
                <Section title={t('Gurus')}>
                  {gurus.map((h) => (
                    <Row key={h.id} onClick={() => go(h.href)} icon="🕉️" label={h.label} sub={h.sub} testid="search-guru" />
                  ))}
                </Section>
              )}
              {needle && !loading && !hasResults && (
                <p className="px-3 py-8 text-center text-sm text-muted" data-testid="search-empty">{t('No results found')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
      {children}
    </div>
  );
}

function Row({ onClick, icon, label, sub, badge, testid }: { onClick: () => void; icon: string; label: string; sub?: string; badge?: string; testid: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-cream"
    >
      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{label}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {badge && <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{badge}</span>}
    </button>
  );
}
