'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBff } from '@/lib/auth-client';
import { fmtDateTime } from '@/lib/format';

// Phase 8B.2 — read-only teachers of one locality, from the existing admin BFF
// (/bff/admin/spaces-coverage/locality/{lid}/teachers → confirmed service localities only).
type T = {
  teacher_id: string; name: string | null; admin_path: string | null; admin_link_note: string | null; public_path: string | null;
  bucket: 'VERIFIED_ELIGIBLE' | 'REGISTERED_NOT_VERIFIED' | 'INELIGIBLE'; empanelled: boolean; id_verified: boolean; active: boolean;
  special_needs_qualified: boolean; status_synced_at: string | null; stale_warning: string | null;
};
const BUCKET: Record<T['bucket'], { label: string; cls: string }> = {
  VERIFIED_ELIGIBLE: { label: 'Verified & eligible', cls: 'bg-[#E3F4D6] text-[#16632C]' },
  REGISTERED_NOT_VERIFIED: { label: 'Registered, not yet verified', cls: 'bg-[#FDE7CC] text-[#7A2E05]' },
  INELIGIBLE: { label: 'Inactive / ineligible', cls: 'bg-[#F1ECE3] text-[#4A4540]' },
};

export default function LocalityTeachers({ lid }: { lid: string }) {
  const [state, setState] = useState<{ loading: boolean; error?: string; teachers?: T[] }>({ loading: true });
  useEffect(() => {
    let live = true;
    getBff<{ teachers?: T[]; error?: string }>(`/bff/admin/spaces-coverage/locality/${encodeURIComponent(lid)}/teachers`).then((r) => {
      if (live) setState(r.ok ? { loading: false, teachers: r.data.teachers || [] } : { loading: false, error: r.data?.error || 'Teachers are unavailable right now.' });
    });
    return () => { live = false; };
  }, [lid]);

  return (
    <section className="sp-card p-5" data-testid="locality-teachers">
      <h2 className="text-[20px]">Yoga teachers serving this locality</h2>
      <p className="mt-1 text-xs text-[#6E6A63]">Read-only. Teachers who confirmed this locality as a service area; status comes from the main NOSTOPS backend.</p>
      {state.loading ? <p className="mt-3 animate-pulse text-sm text-[#6E6A63]" data-testid="teachers-loading">Loading teachers…</p>
        : state.error ? <p role="alert" className="mt-3 text-sm font-medium text-[#8A2A22]" data-testid="teachers-error">{state.error}</p>
          : !state.teachers!.length ? <p className="mt-3 text-sm text-[#3B4762]" data-testid="teachers-empty">No teacher has confirmed this locality yet.</p>
            : (
              <ul className="mt-3 divide-y divide-[#EEDFC8]">
                {state.teachers!.map((t) => (
                  <li key={t.teacher_id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid={`teacher-${t.teacher_id}`}>
                    <div className="min-w-0">
                      {t.admin_path ? <Link href={t.admin_path} className="font-semibold text-[#0F4C4A] hover:text-[#E8690C]">{t.name || t.teacher_id}</Link> : <span className="font-semibold text-[#1C2A47]">{t.name || t.teacher_id}</span>}
                      {t.admin_link_note && <span className="ml-2 text-xs text-[#6E6A63]">{t.admin_link_note}</span>}
                      <p className="text-xs text-[#6E6A63]">
                        Empanelled {t.empanelled ? '✓' : '✗'} · ID verified {t.id_verified ? '✓' : '✗'} · {t.active ? 'Active' : 'Inactive'}{t.special_needs_qualified ? ' · Special Needs qualified' : ''}
                        {' · '}{t.stale_warning ? <span className="text-[#7A2E05]">{t.stale_warning}</span> : `refreshed ${fmtDateTime(t.status_synced_at)}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${BUCKET[t.bucket].cls}`}>{BUCKET[t.bucket].label}</span>
                  </li>
                ))}
              </ul>
            )}
    </section>
  );
}
