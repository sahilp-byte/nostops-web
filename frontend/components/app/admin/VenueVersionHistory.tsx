'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { VENUE_FIELD_LABEL, type VenueRevision } from '@/lib/venue-review-shared';

const ACTION_LABEL: Record<string, string> = {
  baseline: 'Original version on record',
  owner_edit: 'Edited by the owner',
  owner_proposed: 'Changes proposed by the owner',
  minor_edit_auto_approved: 'Small fix — went live automatically',
  admin_edit: 'Edited by an admin',
  changes_approved: 'Owner changes approved',
  restored: 'Earlier version restored',
};
const ACTOR: Record<string, { label: string; cls: string }> = {
  owner: { label: 'Owner', cls: 'bg-brand-50 text-brand-700' },
  admin: { label: 'Admin', cls: 'bg-royal-50 text-royal' },
  ai: { label: 'AI-assisted', cls: 'bg-indigo-100 text-indigo-700' },
  system: { label: 'System', cls: 'bg-cream text-ink-soft' },
};
const STATE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  superseded: 'bg-cream text-muted',
  withdrawn: 'bg-cream text-muted',
};
const fmt = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? (v.length ? v.map(String).join(', ') : '—') : String(v));

/** Every version of the listing, tagged by who made it; admins can restore any live version. */
export default function VenueVersionHistory({ id, revisions }: { id: string; revisions: VenueRevision[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const currentId = revisions.find((r) => r.kind === 'applied')?.id;

  async function restore(r: VenueRevision) {
    if (!window.confirm(`Restore version ${r.version}? The live listing will change to that version (saved as a new version).`)) return;
    setBusy(r.id);
    setMsg(null);
    const res = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/revisions/${encodeURIComponent(r.id)}/restore`, {});
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: (res.data as { error?: string })?.error || 'Could not restore this version.' }); return; }
    setMsg({ ok: true, text: (res.data as { unchanged?: boolean })?.unchanged ? 'That version matches the live listing already.' : `Version ${r.version} restored.` });
    router.refresh();
  }

  return (
    <section className="mt-8" data-testid="version-history">
      <h2 className="text-xl font-black tracking-tight text-ink">Version history</h2>
      <p className="mt-1 text-sm text-muted">Every change to this listing, who made it, and the full listing at that point. Restoring creates a new version.</p>
      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`} role="status">{msg.text}</p>}
      {revisions.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted" data-testid="version-history-empty">
          No versions recorded yet — the first change by the owner or an admin starts the history (the current listing is saved as version 1).
        </p>
      ) : (
        <ol className="mt-4 list-none space-y-3 p-0">
          {revisions.map((r) => {
            const actor = ACTOR[r.actorType || 'system'] || ACTOR.system;
            const isCurrent = r.id === currentId;
            return (
              <li key={r.id} className={`rounded-xl border bg-white p-4 ${isCurrent ? 'border-brand/40' : 'border-line'}`} data-testid="version-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-ink">v{r.version}</span>
                      <span className="text-sm font-bold text-ink">{ACTION_LABEL[r.action] || r.action}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${actor.cls}`} data-testid="version-actor">{actor.label}</span>
                      {r.kind === 'proposed' && r.state && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATE[r.state] || STATE.superseded}`}>{r.state}</span>}
                      {isCurrent && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">Live now</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted">{[r.actor, r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : ''].filter(Boolean).join(' · ')}</p>
                    {r.changed.length > 0 && <p className="mt-1 text-xs text-ink-soft">Changed: {r.changed.map((k) => VENUE_FIELD_LABEL[k] || k).join(', ')}</p>}
                    {r.note && <p className="mt-1 text-xs text-ink-soft">{r.note}</p>}
                    {r.decisionNote && <p className="mt-1 text-xs text-ink-soft">Decision note: {r.decisionNote}</p>}
                  </div>
                  {r.kind === 'applied' && !isCurrent && (
                    <button type="button" onClick={() => restore(r)} disabled={!!busy} className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50" data-testid="version-restore">
                      {busy === r.id ? 'Restoring…' : 'Restore this version'}
                    </button>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-bold text-brand-700">View listing at this version</summary>
                  <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    {Object.keys(VENUE_FIELD_LABEL).filter((k) => k in r.fields).map((k) => (
                      <div key={k}>
                        <dt className="font-bold text-muted">{VENUE_FIELD_LABEL[k]}</dt>
                        <dd className="whitespace-pre-line break-words text-ink-soft">{fmt(r.fields[k])}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
