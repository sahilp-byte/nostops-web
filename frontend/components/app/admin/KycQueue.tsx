'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { KycApplicant } from '@/lib/server/admin-kyc';

// Admin KYC queue (PHASE 2). Full write actions (Approve / Reject) — protected
// server-side by requireAdmin() on the BFF route. A non-admin can never reach
// the underlying backend approve/reject endpoint through the web.

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{children}</span>;
}

function ApplicantCard({ a, onDone }: { a: KycApplicant; onDone: (id: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function act(action: 'approve' | 'reject') {
    setError(null);
    if (action === 'reject' && reason.trim().length < 10) {
      setError('Please give a reason (at least 10 characters).');
      return;
    }
    setBusy(action);
    const body = action === 'reject' ? { reason: reason.trim() } : {};
    const res = await postBff(`/bff/admin/kyc/${encodeURIComponent(a.teacherId)}/${action}`, body);
    setBusy(null);
    if (!res.ok || res.data?.ok === false) {
      setError(res.data?.error || 'Could not complete the action.');
      return;
    }
    onDone(a.teacherId);
    router.refresh();
  }

  return (
    <div data-testid={`kyc-applicant-${a.teacherId}`} className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-ink">{a.name}</h3>
            {a.badge && <Chip>{a.badge}</Chip>}
            {a.level && <Chip>{a.level}</Chip>}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-ink-soft">
            {[a.title, [a.city, a.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            {a.experienceYears != null ? ` · ${a.experienceYears} yrs` : ''}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {a.email && <p className="text-ink-soft"><span className="font-semibold text-ink">Email:</span> {a.email}</p>}
        {a.phone && <p className="text-ink-soft"><span className="font-semibold text-ink">Phone:</span> {a.phone}</p>}
        {a.languages && <p className="text-ink-soft"><span className="font-semibold text-ink">Languages:</span> {a.languages}</p>}
        {a.hourlyRate && <p className="text-ink-soft"><span className="font-semibold text-ink">Rate:</span> {a.hourlyRate}</p>}
      </div>

      {(a.specializations.length > 0 || a.certifications.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.certifications.map((c) => <Chip key={`c-${c}`}>🎓 {c}</Chip>)}
          {a.specializations.map((s) => <Chip key={`s-${s}`}>{s}</Chip>)}
        </div>
      )}

      {a.bio && (
        <div className="mt-3">
          <p className={`text-sm leading-relaxed text-ink-soft ${expanded ? '' : 'line-clamp-2'}`}>{a.bio}</p>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-bold text-brand-700">
            {expanded ? 'Show less' : 'Read full bio'}
          </button>
        </div>
      )}

      {error && <p data-testid="kyc-error" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

      {rejecting && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection (shared with the teacher, ≥10 chars)"
          data-testid={`kyc-reason-${a.teacherId}`}
          className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => act('approve')}
          disabled={busy !== null}
          data-testid={`kyc-approve-${a.teacherId}`}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {busy === 'approve' ? 'Approving…' : '✓ Approve KYC'}
        </button>
        {rejecting ? (
          <>
            <button
              type="button"
              onClick={() => act('reject')}
              disabled={busy !== null}
              data-testid={`kyc-confirm-reject-${a.teacherId}`}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button type="button" onClick={() => { setRejecting(false); setError(null); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={busy !== null}
            data-testid={`kyc-reject-${a.teacherId}`}
            className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}

export default function KycQueue({ applicants: initial }: { applicants: KycApplicant[] }) {
  const [applicants, setApplicants] = useState(initial);
  const remove = (id: string) => setApplicants((prev) => prev.filter((a) => a.teacherId !== id));

  if (applicants.length === 0) {
    return (
      <div data-testid="kyc-empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <p className="text-4xl">✅</p>
        <p className="mt-3 text-lg font-black text-ink">Queue is clear</p>
        <p className="mt-1 text-sm text-ink-soft">There are no KYC submissions awaiting review right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="kyc-queue">
      {applicants.map((a) => <ApplicantCard key={a.teacherId} a={a} onDone={remove} />)}
    </div>
  );
}
