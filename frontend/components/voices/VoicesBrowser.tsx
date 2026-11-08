'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { HubArticle } from '@/lib/server/voices';
import { langLabel } from '@/lib/voices-shared';

function fmt(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function Card({ a }: { a: HubArticle }) {
  return (
    <Link href={`/voices/${a.slug}`} className="group flex flex-col rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-brand-700">
        <span>{a.type}</span>
        {a.topic && <><span aria-hidden className="text-muted">·</span><span className="text-ink-soft">{a.topic}</span></>}
      </div>
      <h3 className="mt-2 text-lg font-black leading-snug tracking-tight text-ink group-hover:text-brand-700">{a.title}</h3>
      {a.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{a.excerpt}</p>}
      <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3">
        {a.author_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.author_avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-xs font-black text-brand-700">{a.author_name.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="min-w-0 text-xs">
          <span className="block font-bold text-ink">{a.author_name}</span>
          <span className="block text-muted">{[a.author_city, fmt(a.published_at), a.reading_minutes ? `${a.reading_minutes} min read` : '', langLabel(a.language)].filter(Boolean).join(' · ')}</span>
        </span>
      </div>
    </Link>
  );
}

const ALL = '__all__';

// Reader-facing topic tabs for the Voices hub. Topics are free-text (set by
// authors), so the tab set is derived from the published articles themselves —
// grouped case-insensitively, ordered by how many articles carry each topic.
// Filtering is in-memory (no reload); tabs only appear when ≥2 topics exist.
export default function VoicesBrowser({ articles }: { articles: HubArticle[] }) {
  const [active, setActive] = useState<string>(ALL);

  const topics = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const a of articles) {
      const raw = (a.topic || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else map.set(key, { label: raw, count: 1 });
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [articles]);

  const filtered = useMemo(() => {
    if (active === ALL) return articles;
    return articles.filter((a) => (a.topic || '').trim().toLowerCase() === active);
  }, [articles, active]);

  const showTabs = topics.length >= 2;

  const tabCls = (on: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'}`;

  return (
    <div>
      {showTabs && (
        <div className="mb-7 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Browse Voices by topic" data-testid="voices-tabs">
          <button type="button" role="tab" aria-selected={active === ALL} onClick={() => setActive(ALL)} className={tabCls(active === ALL)} data-testid="voices-tab-all">
            All <span className="opacity-70">{articles.length}</span>
          </button>
          {topics.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => setActive(t.key)} className={`${tabCls(active === t.key)} capitalize`} data-testid="voices-tab">
              {t.label} <span className="opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="voices-grid">
        {filtered.map((a) => <Card key={a.slug} a={a} />)}
      </div>
    </div>
  );
}
