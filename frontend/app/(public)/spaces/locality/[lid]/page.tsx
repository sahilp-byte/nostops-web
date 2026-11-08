import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { districtSlug, getPublicLocality } from '@/lib/server/spaces';
import { getPublicDirectory } from '@/lib/server/cities';
import { nearbyTeachers } from '@/lib/spaces-teachers';
import { OFFICIAL_MODELS_NOTE } from '@/lib/spaces';
import { SpacesPageHeader, SpEmpty, SpIcon } from '@/components/spaces/ui';
import { SpaceCard, TeacherCard } from '@/components/spaces/PublicCards';
import { canonical } from '@/lib/site';

// Public locality page: one official India Post locality with at least one approved Space.
// Indexed (and in the sitemap) only when the locality's coverage status is ACTIVE and it has a genuine (non-QA) Space.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lid: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lid } = await params;
  const d = await getPublicLocality(decodeURIComponent(lid)).catch(() => null);
  if (!d) return { title: 'Locality not found', robots: { index: false, follow: true } };
  const L = d.locality;
  const title = `Yoga spaces in ${L.name}, ${L.district} (${L.pin})`;
  const description = `${d.spaces.length} NOSTOPS-checked yoga ${d.spaces.length === 1 ? 'space' : 'spaces'} in ${L.name}, ${L.district}, ${L.state} — and verified NOSTOPS teachers in ${L.district}.`;
  const url = canonical(`/spaces/locality/${encodeURIComponent(L.id)}`);
  const indexable = d.coverage_status === 'ACTIVE' && d.has_genuine;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: 'website' }, robots: { index: indexable, follow: true } };
}

export default async function LocalityPage({ params }: Props) {
  const { lid } = await params;
  const d = await getPublicLocality(decodeURIComponent(lid));
  if (!d) notFound();
  const L = d.locality;
  const teachers = nearbyTeachers(await getPublicDirectory(), L.district, L.state, [], true);

  return (
    <div className="container-x py-6" data-testid="locality-page">
      <SpacesPageHeader
        crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: L.district, href: `/spaces/district/${districtSlug(L.state)}/${districtSlug(L.district)}` }, { label: L.name }]}
        title={<span data-testid="locality-name">Yoga spaces in {L.name}</span>}
        subtitle={<span className="inline-flex items-center gap-2"><span className="text-[#F28A1E]"><SpIcon name="pin" className="h-5 w-5" /></span>{[L.district, L.state].filter(Boolean).join(', ')} · PIN {L.pin}</span>}
        image={null}
      />
      <div className="mt-6 space-y-10">
        <section data-testid="locality-spaces">
          <h2 className="text-[26px]">NOSTOPS Spaces in {L.name}</h2>
          <p className="mt-1 text-[15px] text-ink-soft">Every Space is checked by NOSTOPS. {OFFICIAL_MODELS_NOTE}</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.spaces.map((s) => <SpaceCard key={s.id} s={s} />)}</div>
        </section>
        <section data-testid="locality-teachers">
          <h2 className="text-[26px]">Verified NOSTOPS teachers in {L.district}</h2>
          {teachers.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{teachers.map((t) => <TeacherCard key={t.handle} t={t} />)}</div>
          ) : <div className="mt-3"><SpEmpty title={`No verified teachers listed in ${L.district} yet`} testId="locality-teachers-empty"><Link href="/teachers" className="font-bold text-brand-700 underline">Browse all teachers</Link></SpEmpty></div>}
        </section>
        <p className="text-[15px]"><Link href={`/spaces?pin=${L.pin}`} className="font-bold text-brand-700 underline" data-testid="locality-pin-link">See all Spaces near PIN {L.pin}</Link></p>
      </div>
    </div>
  );
}
