'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import { canonical } from '@/lib/site';
import type { Candidate } from '@/lib/server/discovery-admin';

// Candidate management table: view classification/claim/onboarding status and
// take admin actions (approve, reject, mark irrelevant/duplicate, invite /
// resend, advance onboarding stage, open/copy claim link, link the live
// verified profile so the provisional URL graduates + redirects).
const STAGE_LABEL: Record<string, string> = {
  PROFILE_COMPLETE: 'Profile complete', APPLICATION: 'Application', EMPANELLED: 'Empanelled',
};

export default function CandidateTableClient({ items }: { items: Candidate[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [handleDraft, setHandleDraft] = useState<Record<string, string>>({});

  async function act(id: string, action: string, extra?: { stage?: string | null; handle?: string }) {
    setErr(null); setBusyId(id);
    const r = await sendBff(`/bff/admin/discovery/candidates/${id}`, 'POST', { action, ...extra });
    setBusyId(null);
    if (!r.ok) { setErr(r.data?.error || 'Action failed.'); return; }
    router.refresh();
  }

  async function copyClaimLink(c: Candidate) {
    if (!c.city_slug || !c.teacher_slug) return;
    const url = canonical(`/teachers/in/${c.city_slug}/${c.teacher_slug}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(c._id);
      setTimeout(() => setCopiedId((v) => (v === c._id ? null : v)), 1800);
    } catch {
      setErr('Could not copy the link.');
    }
  }

  if (items.length === 0) {
    return <div className="mt-3 rounded-2xl border border-dashed border-line bg-cream/40 p-6 text-center text-sm text-muted">No candidates in this view.</div>;
  }

  return (
    <div className="mt-3 space-y-2">
      {err && <p className="text-[13px] font-bold text-red-600">{err}</p>}
      {items.map((c) => {
        const claimable = c.status === 'accepted' && (c.classification === 'INDIVIDUAL_TEACHER' || c.classification === 'TEACHER_BUSINESS');
        const profileHref = c.city_slug && c.teacher_slug ? `/teachers/in/${c.city_slug}/${c.teacher_slug}` : null;
        const busy = busyId === c._id;
        return (
          <div key={c._id} className="rounded-xl border border-line bg-white p-3" data-testid="candidate-row">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-ink">{c.name}</p>
                <p className="text-[12px] text-muted">{[c.locality, c.city].filter(Boolean).join(', ')} · {c.source_query || '—'}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Tag className="bg-slate-100 text-slate-600">{c.classification}</Tag>
                  {c.admin_status && <Tag className="bg-amber-50 text-amber-700">{c.admin_status}</Tag>}
                  {c.claim_state && <Tag className="bg-brand-50 text-brand-700">{c.claim_state}</Tag>}
                  {c.invited_at ? <Tag className="bg-sky-50 text-sky-700">invited{c.invite_count && c.invite_count > 1 ? ` ×${c.invite_count}` : ''}</Tag> : null}
                  {c.onboarding_stage && <Tag className="bg-emerald-50 text-emerald-700">{STAGE_LABEL[c.onboarding_stage] || c.onboarding_stage}</Tag>}
                </div>
              </div>
              {profileHref && (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <a href={profileHref} target="_blank" rel="noreferrer" className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] font-bold text-ink-soft hover:border-brand" data-testid="cand-open-claim">Open claim page ↗</a>
                  <button type="button" onClick={() => copyClaimLink(c)} className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] font-bold text-ink-soft hover:border-brand" data-testid="cand-copy-link">
                    {copiedId === c._id ? 'Copied ✓' : 'Copy claim link'}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line/60 pt-2">
              {claimable && (
                <Btn testid="cand-invite" onClick={() => act(c._id, c.invited_at ? 'resend_invite' : 'invite')} disabled={busy}>
                  {c.invited_at ? 'Resend invite' : 'Mark invited'}
                </Btn>
              )}
              <Btn onClick={() => act(c._id, 'approve')} disabled={busy}>Approve</Btn>
              <Btn onClick={() => act(c._id, 'reject')} disabled={busy}>Reject</Btn>
              <Btn onClick={() => act(c._id, 'mark_irrelevant')} disabled={busy}>Irrelevant</Btn>
              <Btn onClick={() => act(c._id, 'mark_duplicate')} disabled={busy}>Duplicate</Btn>
              {c.admin_status && <Btn onClick={() => act(c._id, 'clear')} disabled={busy}>Clear flag</Btn>}
              {c.claim_state === 'CLAIMED' && (
                <>
                  <Btn onClick={() => act(c._id, 'set_stage', { stage: 'PROFILE_COMPLETE' })} disabled={busy}>→ Profile complete</Btn>
                  <Btn onClick={() => act(c._id, 'set_stage', { stage: 'APPLICATION' })} disabled={busy}>→ Application</Btn>
                  <Btn onClick={() => act(c._id, 'set_stage', { stage: 'EMPANELLED' })} disabled={busy}>→ Empanelled</Btn>
                  <Btn onClick={() => act(c._id, 'unclaim')} disabled={busy}>Unclaim</Btn>
                </>
              )}
            </div>

            {/* Graduation: link the live verified profile → provisional URL redirects there */}
            {c.claim_state === 'CLAIMED' && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2" data-testid="cand-verified-link">
                {c.verified_handle ? (
                  <>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">graduated → /teachers/{c.verified_handle}</span>
                    <Btn onClick={() => act(c._id, 'unlink_verified')} disabled={busy}>Unlink verified</Btn>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={handleDraft[c._id] || ''}
                      onChange={(e) => setHandleDraft((m) => ({ ...m, [c._id]: e.target.value }))}
                      placeholder="verified profile handle"
                      className="rounded-md border border-line px-2 py-1 text-[12px] outline-none focus:border-brand"
                      data-testid="cand-verified-input"
                    />
                    <Btn onClick={() => act(c._id, 'link_verified', { handle: (handleDraft[c._id] || '').trim() })} disabled={busy || !(handleDraft[c._id] || '').trim()}>
                      Link verified profile
                    </Btn>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>;
}
function Btn({ children, onClick, disabled, testid }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; testid?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testid}
      className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] font-bold text-ink-soft hover:border-brand disabled:opacity-50">
      {children}
    </button>
  );
}
