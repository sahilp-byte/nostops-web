'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import { CHECKLIST_LABELS } from '@/lib/spaces';

type Visit = { checklist: Record<string, boolean>; visited_on: string; notes: string; by: string; at: string } | null;

// Admin: optional site-visit checklist + approve / request changes / reject (Phase 3).
export default function AdminSpaceActions({ id, status, missing, checklistKeys, siteVisit }: {
  id: string; status: string; missing: string[]; checklistKeys: string[]; siteVisit: Visit;
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Record<string, boolean>>(siteVisit?.checklist || {});
  const [visitedOn, setVisitedOn] = useState(siteVisit?.visited_on || '');
  const [notes, setNotes] = useState(siteVisit?.notes || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [visitMsg, setVisitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveVisit() {
    setBusy('visit'); setVisitMsg(null);
    const r = await sendBff(`/bff/admin/spaces/${id}/site-visit`, 'PUT', { checklist, visited_on: visitedOn, notes });
    setBusy(null);
    setVisitMsg(r.ok ? { ok: true, text: 'Site visit saved.' } : { ok: false, text: r.data?.error || 'Could not save the site visit.' });
    if (r.ok) router.refresh();
  }

  async function decide(action: 'approve' | 'reject' | 'request_changes') {
    setMsg(null);
    if (action !== 'approve' && !note.trim()) return setMsg({ ok: false, text: 'Add a note so the owner knows why.' });
    if (action === 'approve' && !window.confirm('Approve this Space and publish it on NOSTOPS Spaces?')) return;
    setBusy(action);
    const r = await postBff(`/bff/admin/spaces/${id}/${action}`, { note });
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not save the decision.' });
    setMsg({ ok: true, text: 'Decision saved. The owner has been emailed.' });
    setNote('');
    router.refresh();
  }

  async function changeListing(action: 'unlist' | 'relist') {
    setMsg(null);
    if (action === 'unlist' && !note.trim()) return setMsg({ ok: false, text: 'Add a reason for unlisting this Space.' });
    if (!window.confirm(action === 'unlist' ? 'Unlist this Space? It will disappear from public search. Nothing is deleted.' : 'Relist this Space on NOSTOPS Spaces?')) return;
    setBusy(action);
    const r = await postBff(`/bff/admin/spaces/${id}/${action}`, { note });
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not update the listing.' });
    setMsg({ ok: true, text: action === 'unlist' ? 'Space unlisted. It no longer appears in public search.' : 'Space relisted and public again.' });
    setNote('');
    router.refresh();
  }

  return (
    <aside className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="site-visit-panel">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">Site visit (optional)</h2>
        {siteVisit && <p className="mt-1 text-xs text-muted">Last saved by {siteVisit.by}</p>}
        <div className="mt-3 space-y-2">
          {checklistKeys.map((k) => (
            <label key={k} className="flex min-h-[40px] items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!checklist[k]} onChange={(e) => setChecklist((c) => ({ ...c, [k]: e.target.checked }))} data-testid={`visit-${k}`} />
              {CHECKLIST_LABELS[k] || k}
            </label>
          ))}
        </div>
        <label className="mt-3 block text-sm font-bold text-ink">Visited on
          <input type="date" className="mt-1 w-full min-h-[44px] rounded-xl border border-line px-3 text-sm" value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} data-testid="visit-date" />
        </label>
        <label className="mt-3 block text-sm font-bold text-ink">Visit notes
          <textarea className="mt-1 w-full min-h-[80px] rounded-xl border border-line p-3 text-sm" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} data-testid="visit-notes" />
        </label>
        <button type="button" onClick={saveVisit} disabled={!!busy} className="mt-3 min-h-[44px] w-full rounded-xl border border-brand text-sm font-black text-brand-700 disabled:opacity-50" data-testid="visit-save">
          {busy === 'visit' ? 'Saving…' : 'Save site visit'}
        </button>
        {visitMsg && <p className={`mt-2 text-sm font-semibold ${visitMsg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status" data-testid="visit-msg">{visitMsg.text}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5" data-testid="decision-panel">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">Decision</h2>
        {status === 'approved' || status === 'unlisted' ? (
          <div data-testid="listing-panel">
            <p className="mt-2 text-sm text-ink-soft">{status === 'approved' ? 'This Space is live in public search. Unlisting hides it from public discovery without deleting anything.' : 'This Space is unlisted: it is hidden from public search. Ownership, history and documents are kept.'}</p>
            <label className="mt-3 block text-sm font-bold text-ink">{status === 'approved' ? 'Reason for unlisting' : 'Note (optional)'}
              <textarea className="mt-1 w-full min-h-[80px] rounded-xl border border-line p-3 text-sm" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} data-testid="listing-note" />
            </label>
            {status === 'approved'
              ? <button type="button" onClick={() => changeListing('unlist')} disabled={!!busy} className="sp-btn-secondary mt-3 w-full !border-red-300 !text-red-700" data-testid="listing-unlist">{busy === 'unlist' ? 'Unlisting…' : 'Unlist from public search'}</button>
              : <button type="button" onClick={() => changeListing('relist')} disabled={!!busy} className="sp-btn-primary mt-3 w-full bg-brand" data-testid="listing-relist">{busy === 'relist' ? 'Relisting…' : 'Relist on NOSTOPS Spaces'}</button>}
          </div>
        ) : status !== 'submitted' ? (
          <p className="mt-2 text-sm text-ink-soft" data-testid="decision-not-pending">This Space is not waiting for a decision.</p>
        ) : (
          <>
            {missing.length > 0 && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Missing: {missing.join(', ')}</p>}
            <label className="mt-3 block text-sm font-bold text-ink">Note to the owner <span className="font-normal text-muted">(required to reject or ask for changes)</span>
              <textarea className="mt-1 w-full min-h-[80px] rounded-xl border border-line p-3 text-sm" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} data-testid="decision-note" />
            </label>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => decide('approve')} disabled={!!busy} className="min-h-[48px] rounded-xl bg-brand text-sm font-black text-white disabled:opacity-50" data-testid="decision-approve">{busy === 'approve' ? 'Approving…' : 'Approve and publish'}</button>
              <button type="button" onClick={() => decide('request_changes')} disabled={!!busy} className="min-h-[48px] rounded-xl border border-orange-400 text-sm font-black text-orange-800 disabled:opacity-50" data-testid="decision-changes">Ask for changes</button>
              <button type="button" onClick={() => decide('reject')} disabled={!!busy} className="min-h-[48px] rounded-xl border border-red-300 text-sm font-black text-red-700 disabled:opacity-50" data-testid="decision-reject">Reject</button>
            </div>
          </>
        )}
        {msg && <p className={`mt-3 text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status" data-testid="decision-msg">{msg.text}</p>}
      </section>
    </aside>
  );
}
