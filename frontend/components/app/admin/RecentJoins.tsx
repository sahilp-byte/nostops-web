'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Person = {
  kind: 'teachers' | 'council';
  id: string; name: string; handle: string | null; city: string | null;
  status: string; createdAt: string | null;
};

const PAGE_SIZE = 10;

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const n = Number(s);
  const d = Number.isFinite(n) && s.length >= 10 && !s.includes('-') ? new Date(n) : new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function RecentJoins({ people }: { people: Person[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const current = useMemo(() => people.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [people, page]);

  if (people.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No members found yet.</p>;
  }

  return (
    <div>
      <ul className="list-none space-y-2 p-0" data-testid="recent-joins-list">
        {current.map((p) => {
          const href = p.kind === 'teachers' ? `/app/admin/teachers/${p.id}` : `/app/admin/people`;
          const suspended = p.status === 'suspended';
          return (
            <li key={`${p.kind}-${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold text-ink">{p.name}</span>
                  <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">{p.kind === 'teachers' ? 'Teacher' : 'Council'}</span>
                  {suspended && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Suspended</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {p.handle ? `@${p.handle}` : p.id}{p.city ? ` · ${p.city}` : ''} · joined {fmtDate(p.createdAt)}
                </p>
              </div>
              <Link href={href} className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="monitor-link">
                Monitor onboarding →
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, people.length)} of {people.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-brand disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm font-semibold text-ink-soft">{page + 1} / {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-brand disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
