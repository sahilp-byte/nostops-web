'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listDrafts, deleteDraft, type SavedDraft } from '@/lib/retreat-drafts';

const TOTAL_STEPS = 9;

function fmtWhen(ts?: number): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function DraftsList() {
  const [drafts, setDrafts] = useState<SavedDraft[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(listDrafts());
  }, []);

  function remove(id: string) {
    deleteDraft(id);
    setDrafts(listDrafts());
    setConfirmId(null);
  }

  if (drafts === null) {
    return <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted" data-testid="drafts-loading">Loading your drafts…</div>;
  }

  if (drafts.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center" data-testid="drafts-empty">
        <span className="text-3xl">📝</span>
        <p className="mt-2 text-base font-extrabold text-ink">No saved drafts</p>
        <p className="mt-1 text-sm text-ink-soft">Start a retreat and use “Save &amp; finish later” — it&apos;ll wait for you right here.</p>
        <Link href="/app/teacher/retreats/new?fresh=1" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="drafts-start-new">Host a retreat →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="drafts-list">
      {drafts.map((d) => {
        const step = typeof d.step === 'number' ? Math.min(TOTAL_STEPS, d.step + 1) : 1;
        const pct = Math.round((step / TOTAL_STEPS) * 100);
        const title = d.title?.trim() || 'Untitled retreat';
        const sub = d.shortDesc?.trim();
        const venue = [d.venueName, d.venueCity].filter(Boolean).join(', ');
        return (
          <div key={d.id} className="rounded-2xl border border-line bg-white p-4" data-testid="draft-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-ink">{title}</p>
                {sub && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{sub}</p>}
                <p className="mt-1 text-xs text-muted">
                  {venue ? `${venue} · ` : ''}Step {step} of {TOTAL_STEPS}
                  {d.savedAt ? ` · saved ${fmtWhen(d.savedAt)}` : ''}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold text-muted">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>

            <div className="mt-3 flex items-center gap-2">
              <Link href={`/app/teacher/retreats/new?draft=${encodeURIComponent(d.id)}`} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="draft-resume">Resume →</Link>
              {confirmId === d.id ? (
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => remove(d.id)} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700" data-testid="draft-delete-confirm">Delete</button>
                  <button type="button" onClick={() => setConfirmId(null)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Cancel</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmId(d.id)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600" data-testid="draft-delete">Delete</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
