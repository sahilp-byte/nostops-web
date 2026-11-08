import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicSpace } from '@/lib/server/spaces';
import { FACILITIES, OFFICIAL_MODELS_NOTE, SPACE_MODELS, SPACE_TYPES } from '@/lib/spaces';
import { SpacesPageHeader, SpEmpty, SpIcon, SpSection } from '@/components/spaces/ui';
import { canonical } from '@/lib/site';
import SpaceShare from '@/components/spaces/SpaceShare';

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await getPublicSpace(id);
  if (!s) return { title: 'Space not found', robots: { index: false, follow: true } };
  const title = `${s.name} · ${[s.location?.locality, s.location?.district].filter(Boolean).join(', ')} · NOSTOPS Spaces`;
  const description = `${SPACE_TYPES[s.space_type || ''] || 'Yoga space'} in ${[s.location?.locality, s.location?.district, s.location?.state].filter(Boolean).join(', ')} (PIN ${s.location?.pin || ''}) for NOSTOPS yoga programmes.`;
  const url = canonical(`/spaces/${encodeURIComponent(id)}`);
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    // Approved Spaces only reach here (others 404). QA/TEST records are never indexed.
    robots: /^(spc_qa_|TEST_)/.test(id) || /^TEST_/i.test(s.name || '') ? { index: false, follow: true } : { index: true, follow: true },
  };
}

// Public Space detail (approved Spaces only). No owner identity, contact details or documents are shown.
export default async function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getPublicSpace(id);
  if (!s) notFound();
  const model = SPACE_MODELS[s.model || ''];

  return (
    <div className="container-x py-6" data-testid="space-detail-page">
      <SpacesPageHeader
        crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: `Spaces near ${s.location?.pin || ''}`, href: `/spaces?pin=${s.location?.pin || ''}` }, { label: s.name || 'Space' }]}
        title={<span data-testid="space-detail-name">{s.name}</span>}
        subtitle={<span className="inline-flex items-center gap-2"><span className="text-[#F28A1E]"><SpIcon name="pin" className="h-5 w-5" /></span>{[s.location?.locality, s.location?.district, s.location?.state].filter(Boolean).join(', ')} · {s.location?.pin}</span>}
        image={null}
        aside={<p className="sp-panel-green hidden items-center gap-3 px-5 py-3 lg:flex"><span className="text-[#22A447]"><SpIcon name="shield" className="h-9 w-9" /></span><span><b className="block text-[18px] text-[#0F4C4A]">Checked by NOSTOPS</b><span className="text-[14px] text-[#1C2A47]">Visible on NOSTOPS Spaces</span></span></p>}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {s.photos?.length ? (
            <div className={`grid gap-3 ${s.photos.length > 2 ? 'sm:grid-cols-[2fr_1fr]' : s.photos.length === 2 ? 'sm:grid-cols-2' : ''}`} data-testid="space-detail-photos">
              {s.photos.slice(0, 4).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={p} alt={`${s.name} photo ${i + 1}`} className={`w-full rounded-[18px] object-cover shadow-sm ${i === 0 && s.photos!.length > 2 ? 'aspect-[3/2] sm:row-span-3 sm:h-full' : 'aspect-[3/2]'}`} />
              ))}
            </div>
          ) : <SpEmpty title="Photos coming soon" testId="space-detail-no-photos">The Space owner has not added photos yet.</SpEmpty>}

          <SpSection icon="info" title="About this Space">
            <p className="flex flex-wrap gap-2 text-[14px] font-semibold">
              {model && <span className={`rounded-full px-4 py-1.5 ${model.tone}`}>{model.label}</span>}
              {SPACE_TYPES[s.space_type || ''] && <span className="rounded-full bg-[#FCF4E6] px-4 py-1.5 text-[#1C2A47]">{SPACE_TYPES[s.space_type || '']}</span>}
            </p>
            <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-[#1C2A47]">{s.description}</p>
          </SpSection>

          {s.facilities?.length ? (
            <SpSection icon="layers" title="Key Facilities & Amenities">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{s.facilities.map((f) => <span key={f} className="flex items-center gap-2 rounded-xl border border-[#EEDFC8] bg-white px-3 py-2.5 text-[15px] font-medium text-[#1C2A47]"><span className="text-[#22A447]"><SpIcon name="check" className="h-5 w-5" strokeWidth={2.4} /></span>{FACILITIES[f] || f}</span>)}</div>
            </SpSection>
          ) : null}
        </div>

        <aside className="h-fit space-y-4">
          <SpSection icon="handshake" title="Participation & Details">
            <dl className="divide-y divide-[#EEDFC8] text-[15px]">
              <div className="py-2.5"><dt className="font-medium text-muted">Participation model</dt><dd className="text-[17px] font-bold text-[#0F4C4A]" data-testid="space-detail-model">{model?.label}</dd><dd className="text-[14px] text-ink-soft">{model?.blurb}</dd></div>
              <div className="py-2.5"><dt className="font-medium text-muted">Space type</dt><dd className="font-semibold text-ink">{SPACE_TYPES[s.space_type || '']}</dd></div>
              {s.capacity ? <div className="py-2.5"><dt className="font-medium text-muted">Max capacity</dt><dd className="font-semibold text-ink">Up to {s.capacity} people</dd></div> : null}
              {s.area_sqft ? <div className="py-2.5"><dt className="font-medium text-muted">Area</dt><dd className="font-semibold text-ink">{s.area_sqft} sq ft</dd></div> : null}
              {s.availability ? <div className="py-2.5"><dt className="font-medium text-muted">Availability</dt><dd className="font-semibold text-ink">{s.availability}</dd></div> : null}
              {s.landmark ? <div className="py-2.5"><dt className="font-medium text-muted">Landmark</dt><dd className="font-semibold text-ink">{s.landmark}</dd></div> : null}
            </dl>
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#E6F5DC] p-3 text-[14px] font-semibold text-[#1E6B2F]"><SpIcon name="shield" className="h-5 w-5" />Checked by NOSTOPS</p>
            <p className="mt-3 text-[13px] text-ink-soft" data-testid="official-models-note">{OFFICIAL_MODELS_NOTE}</p>
          </SpSection>
          <Link href={`/app/spaces/enquiries/new?space=${s.id}`} className="sp-btn-primary w-full bg-accent" data-testid="space-send-enquiry"><SpIcon name="calendar" className="h-6 w-6" />Send an Enquiry</Link>
          <p className="text-center text-[13px] text-muted">For NOSTOPS teachers. An enquiry is not a booking.</p>
          <SpSection icon="pin" title="Share this Space">
            <SpaceShare url={canonical(`/spaces/${encodeURIComponent(s.id || id)}`)} name={s.name || 'NOSTOPS Space'} />
            {s.location?.locality_id && (
              <Link href={`/spaces/locality/${encodeURIComponent(s.location.locality_id)}`} className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-bold text-brand-700 underline" data-testid="space-locality-link">More in {s.location.locality}</Link>
            )}
          </SpSection>
        </aside>
      </div>
    </div>
  );
}
