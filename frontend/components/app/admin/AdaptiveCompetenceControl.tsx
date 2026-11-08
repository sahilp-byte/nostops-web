'use client';
// SPECIAL NEEDS — admin verification of adaptive-practice competence. Only a
// verified teacher can be offered a Special Needs programme; without one the
// event safely shows "No teacher yet" instead of an unqualified match.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import type { DirectoryTeacher, SpecialNeedsAwaiting } from '@/lib/server/institutional';

const AWAIT_LABEL: Record<SpecialNeedsAwaiting['status'], string> = {
  NO_VERIFIED_TEACHER_IN_CITY: 'No verified teacher in this city',
  VERIFIED_TEACHERS_UNAVAILABLE: 'Verified teacher(s) in city, none available',
  OFFER_HELD_BY_UNVERIFIED_TEACHER: 'Older offer held by an unverified teacher',
};

export default function AdaptiveCompetenceControl({ teachers, awaiting = [] }: { teachers: DirectoryTeacher[]; awaiting?: SpecialNeedsAwaiting[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const list = teachers.filter((t) => !q.trim() || `${t.name} ${t.city} ${t.handle}`.toLowerCase().includes(q.trim().toLowerCase()));

  async function setVerified(t: DirectoryTeacher, verified: boolean) {
    setBusy(t.teacher_id); setMsg('');
    const res = await sendBff(`/bff/institutional/admin/teacher-directory/${encodeURIComponent(t.teacher_id)}`, 'PATCH', { verified });
    setBusy('');
    if (!res.ok) { setMsg(res.data?.error || 'Could not update.'); return; }
    setMsg(verified
      ? `${t.name || t.teacher_id} verified for Special Needs${res.data?.newly_matched ? ` · offered ${res.data.newly_matched} waiting programme(s)` : ''}.`
      : `${t.name || t.teacher_id} is no longer eligible for Special Needs programmes.`);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4" data-testid="adaptive-competence-control">
      <p className="text-sm font-black text-ink">Special Needs · verified adaptive-practice competence</p>
      <p className="mt-1 text-xs text-muted">
        Special Needs programmes are offered only to teachers verified here. If none is eligible in the event&rsquo;s city, the organiser sees &ldquo;No teacher yet&rdquo; and NOSTOPS follows up. Teachers cannot grant this themselves.
      </p>
      <div className="mt-3 rounded-xl border border-line bg-cream/60 p-3" data-testid="sn-awaiting">
        <p className="text-xs font-black text-ink">
          Special Needs events awaiting a verified teacher: <span data-testid="sn-awaiting-count">{awaiting.length}</span>
        </p>
        {awaiting.length > 0 && (
          <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto p-0">
            {awaiting.slice(0, 50).map((e) => (
              <li key={e.event_id} className="py-1.5 text-[11px] text-ink-soft" data-testid={`sn-awaiting-${e.event_id}`}>
                <span className="font-bold text-ink">{e.title || e.event_id}</span>
                {' · '}{e.city || 'No city'}{' · '}{e.event_date || 'date TBC'}{e.organisation_name ? ` · ${e.organisation_name}` : ''}
                <span className="ml-1 font-semibold text-amber-700">— {AWAIT_LABEL[e.status] || e.status} ({e.verified_teachers_in_city} verified in city)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teachers…" data-testid="adaptive-search"
        className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
      {msg && <p className="mt-2 text-xs font-semibold text-brand-700" data-testid="adaptive-msg">{msg}</p>}
      <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto p-0">
        {list.map((t) => (
          <li key={t.teacher_id} className="flex items-center gap-3 py-2" data-testid={`adaptive-row-${t.teacher_id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{t.name || t.teacher_id}{t.is_demo && <span className="ml-1 text-[10px] font-semibold text-amber-700">demo</span>}</p>
              <p className="truncate text-[11px] text-muted">{t.city || 'No city'} · {t.taxonomies.length ? `declared: ${t.taxonomies.join(', ')}` : 'no pathways declared'}
                {t.invalid_taxonomies?.length ? <span className="ml-1 text-amber-700" data-testid={`adaptive-invalid-${t.teacher_id}`}>· ignored invalid: {t.invalid_taxonomies.join(', ')}</span> : null}
              </p>
            </div>
            {t.adaptive_practice_verified ? (
              <>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700" data-testid={`adaptive-verified-${t.teacher_id}`}>✓ Verified</span>
                <button type="button" disabled={busy === t.teacher_id} onClick={() => setVerified(t, false)} data-testid={`adaptive-revoke-${t.teacher_id}`}
                  className="min-h-[36px] rounded-lg border border-line px-3 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">Revoke</button>
              </>
            ) : (
              <button type="button" disabled={busy === t.teacher_id} onClick={() => setVerified(t, true)} data-testid={`adaptive-verify-${t.teacher_id}`}
                className="min-h-[36px] rounded-lg bg-brand px-3 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50">Verify</button>
            )}
          </li>
        ))}
        {!list.length && <li className="py-4 text-center text-xs text-muted">No teachers in the matching directory.</li>}
      </ul>
    </div>
  );
}
