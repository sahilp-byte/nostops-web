import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminSpace } from '@/lib/server/spaces';
import { DOC_KINDS, FACILITIES, SPACE_MODELS, SPACE_STATUS, SPACE_TYPES } from '@/lib/spaces';
import { fmtDateTime } from '@/lib/format';
import AdminSpaceActions from '@/components/spaces/AdminSpaceActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Space review', robots: { index: false, follow: false } };

export default async function AdminSpacePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const d = await getAdminSpace(id);
  if (!d) notFound();
  const s = d.space;
  const st = SPACE_STATUS[s.status] || SPACE_STATUS.draft;
  const rows: [string, string][] = [
    ['Type', SPACE_TYPES[s.space_type || ''] || '—'], ['Model', SPACE_MODELS[s.model || '']?.label || '—'],
    ['Capacity', s.capacity ? `${s.capacity} people` : '—'], ['Area', s.area_sqft ? `${s.area_sqft} sq ft` : '—'],
    ['PIN / locality', s.location ? `${s.location.pin} · ${s.location.locality}` : '—'],
    ['District / state', s.location ? `${s.location.district}, ${s.location.state}` : '—'],
    ['Address', s.address_line || '—'], ['Landmark', s.landmark || '—'], ['Availability', s.availability || '—'],
    ['Contact', [s.contact_name, s.contact_phone, s.contact_email].filter(Boolean).join(' · ') || '—'],
    ['Listed by', `${s.owner_name || ''} · ${s.owner_email || ''}`],
  ];

  return (
    <div className="mx-auto max-w-5xl" data-testid="admin-space-page">
      <Link href="/app/admin/spaces" className="text-sm font-bold text-brand-700">← Spaces verification</Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-[36px] leading-tight">{s.name || 'Untitled Space'}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.tone}`} data-testid="admin-space-status">{st.label}</span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-white p-5">
            <dl className="grid gap-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex gap-3"><dt className="w-32 shrink-0 font-semibold text-muted">{k}</dt><dd className="font-bold text-ink">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-4 whitespace-pre-line text-sm text-ink-soft">{s.description}</p>
            {s.facilities?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">{s.facilities.map((f) => <span key={f} className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-ink">{FACILITIES[f] || f}</span>)}</div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5" data-testid="admin-space-photos">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted">Photos ({s.photos?.length || 0})</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {(s.photos || []).map((p) => <img key={p} src={p} alt="" className="aspect-square w-full rounded-xl object-cover" />)}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5" data-testid="admin-space-docs">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted">Private documents</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {Object.entries(DOC_KINDS).map(([k, meta]) => {
                const doc = s.documents?.find((x) => x.kind === k);
                return (
                  <li key={k} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-ink">{meta.label}</span>
                    {doc ? (
                      <a href={`/bff/admin/spaces/doc/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center text-brand-700 underline" data-testid={`admin-doc-${k}`}>{doc.name}</a>
                    ) : <span className="text-red-700">Missing</span>}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5" data-testid="admin-space-history">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted">History</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(s.history || []).slice().reverse().map((h, i) => (
                <li key={i} className="text-ink-soft"><span className="font-bold text-ink">{h.action.replace(/_/g, ' ')}</span> · {h.actor} · {fmtDateTime(h.at)}{h.note ? ` · “${h.note}”` : ''}</li>
              ))}
            </ul>
          </section>
        </div>

        <AdminSpaceActions id={s.id} status={s.status} missing={d.missing} checklistKeys={d.checklistKeys} siteVisit={s.site_visit || null} />
      </div>
    </div>
  );
}
