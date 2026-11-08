'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtDate } from '@/lib/format';
import { APP_PENDING } from '@/lib/nomination-status';
import type { Nomination } from '@/lib/server/admin-nominations';
import type { AppArchive } from '@/lib/server/guru-nominations';

// Nominations made in the mobile app (main backend). Shows the full nomination (citation,
// lineage, references, contacts) and lets admins Advance / Reject / Request info while it is
// pending. "Archive" replaces the old one-click hard delete: it only hides the item here.
const FIELD = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand';

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-28 shrink-0 font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{value}</dd>
    </div>
  );
}

function Card({ n, archived }: { n: Nomination; archived: AppArchive[string] | undefined }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'advance-to-guru' | 'reject' | 'request-info' | 'archive' | 'restore'>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = n.status === APP_PENDING && !archived;

  async function run() {
    if (!mode) return;
    if (mode === 'request-info' && note.trim().length < 5) {
      setError('Please type your question (at least 5 characters).');
      return;
    }
    setError(null);
    setBusy(true);
    const body = mode === 'request-info' ? { question: note.trim() } : mode === 'archive' ? { reason: note.trim() } : { note: note.trim() };
    const res = await postBff(`/bff/admin/nominations/${encodeURIComponent(n.nominationId)}/${mode}`, body);
    setBusy(false);
    if (!res.ok || res.data?.ok === false) {
      setError(res.data?.error || 'Could not complete the action.');
      return;
    }
    setMode(null);
    router.refresh();
  }

  const LABELS = { 'advance-to-guru': 'Advance to Guru', reject: 'Reject', 'request-info': 'Request info', archive: 'Archive', restore: 'Restore' } as const;

  return (
    <article data-testid={`nom-${n.nominationId}`} className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-ink">{n.nomineeName}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {[n.createdAt ? `Nominated ${fmtDate(n.createdAt)}` : null, n.reviewedAt ? `Reviewed ${fmtDate(n.reviewedAt)}` : null, n.nominationId].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {archived && <span className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-bold text-ink-soft">Archived</span>}
          <span data-testid={`nom-status-${n.nominationId}`} className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-bold capitalize text-ink-soft">{n.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <dl className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">The Guru</p>
          <Row label="Lineage" value={n.nomineeLineage} />
          <Row label="City" value={n.nomineeCity} />
          <Row label="Practice" value={n.nomineeDecades ? `${n.nomineeDecades} decade${n.nomineeDecades > 1 ? 's' : ''} (as stated)` : null} />
          <Row label="Email" value={n.nomineeEmail} />
          <Row label="Phone" value={n.nomineePhone} />
        </dl>
        <dl className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Nominated by</p>
          <Row label="Name" value={n.nominatedBy} />
          <Row label="Email" value={n.nominatorEmail} />
          <Row label="Phone" value={n.nominatorPhone} />
          <Row label="Relationship" value={n.relationship} />
        </dl>
      </div>
      {n.citation && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Why they belong on the Council</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft" data-testid={`nom-citation-${n.nominationId}`}>{n.citation}</p>
        </div>
      )}
      {n.references && <p className="mt-3 whitespace-pre-line text-sm text-ink-soft"><span className="font-semibold text-muted">References: </span>{n.references}</p>}
      {n.reviewerNote && <p className="mt-3 text-sm text-ink-soft"><span className="font-semibold text-muted">Reviewer note: </span>{n.reviewerNote}</p>}
      {archived && <p className="mt-3 text-xs text-muted">Archived {fmtDate(archived.at)}{archived.by ? ` by ${archived.by}` : ''}{archived.reason ? `: ${archived.reason}` : ''}</p>}

      <div className="mt-4 border-t border-line pt-4">
        {mode === null ? (
          <div className="flex flex-wrap gap-2">
            {pending && (
              <>
                <button type="button" onClick={() => { setMode('advance-to-guru'); setNote(''); }} data-testid={`nom-advance-${n.nominationId}`} className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600">Advance to Guru</button>
                <button type="button" onClick={() => { setMode('reject'); setNote(''); }} data-testid={`nom-reject-${n.nominationId}`} className="min-h-[44px] rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50">Reject</button>
                <button type="button" onClick={() => { setMode('request-info'); setNote(''); }} data-testid={`nom-request-${n.nominationId}`} className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft transition hover:border-brand">Request info</button>
              </>
            )}
            {archived ? (
              <button type="button" onClick={() => { setMode('restore'); setNote(''); }} data-testid={`nom-restore-${n.nominationId}`} className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft transition hover:border-brand">Restore</button>
            ) : (
              <button type="button" onClick={() => { setMode('archive'); setNote(''); }} data-testid={`nom-archive-${n.nominationId}`} className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs font-bold text-muted transition hover:bg-cream">Archive</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-bold text-ink">{LABELS[mode]}</p>
            {mode === 'archive' && <p className="text-xs text-muted">Hidden from this queue only. Nothing is deleted; restore it any time from Archived.</p>}
            {mode === 'advance-to-guru' && <p className="text-xs text-muted">No invitation is sent at this step, and no Council profile is created.</p>}
            {mode !== 'restore' && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={1200}
                data-testid={`nom-note-${n.nominationId}`}
                placeholder={mode === 'request-info' ? 'What information do you need?' : mode === 'archive' ? 'Reason (optional)' : 'Private note (optional)'}
                className={FIELD}
              />
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={run} data-testid={`nom-confirm-${n.nominationId}`} className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy ? '…' : 'Confirm'}</button>
              <button type="button" onClick={() => { setMode(null); setError(null); }} className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft hover:bg-cream">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function AppNominationsQueue({ items, archive }: { items: Nomination[]; archive: AppArchive }) {
  if (items.length === 0) {
    return (
      <div data-testid="nom-empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <p className="text-4xl" aria-hidden>📜</p>
        <p className="mt-3 text-lg font-black text-ink">Nothing here</p>
        <p className="mt-1 text-sm text-ink-soft">No mobile-app nominations match this filter.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="nom-queue">
      {items.map((n) => <Card key={n.nominationId} n={n} archived={archive[n.nominationId]} />)}
    </div>
  );
}
