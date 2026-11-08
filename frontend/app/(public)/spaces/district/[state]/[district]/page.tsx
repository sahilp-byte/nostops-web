import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicDistrict } from '@/lib/server/spaces';
import { getPublicDirectory } from '@/lib/server/cities';
import { nearbyTeachers } from '@/lib/spaces-teachers';
import { OFFICIAL_MODELS_NOTE } from '@/lib/spaces';
import { SpacesPageHeader, SpEmpty, SpIcon } from '@/components/spaces/ui';
import { SpaceCard, TeacherCard } from '@/components/spaces/PublicCards';
import { canonical } from '@/lib/site';

// Public district page: one official India Post district — its ACTIVE localities, approved Spaces and verified
// teachers. Exists when the district has an approved Space or an ACTIVE locality; indexed only with ≥1 ACTIVE locality.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ state: string; district: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, district } = await params;
  const d = await getPublicDistrict(state, district).catch(() => null);
  if (!d) return { title: 'District not found', robots: { index: false, follow: true } };
  const title = `Yoga spaces and teachers in ${d.district}, ${d.state}`;
  const description = `NOSTOPS in ${d.district}: ${d.active_localities.length} active ${d.active_localities.length === 1 ? 'locality' : 'localities'}, ${d.spaces.length} checked yoga ${d.spaces.length === 1 ? 'space' : 'spaces'} and verified NOSTOPS teachers.`;
  const url = canonical(`/spaces/district/${state}/${district}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description }, robots: { index: d.active_localities.length > 0, follow: true } };
}

export default async function DistrictPage({ params }: Props) {
  const { state, district } = await params;
  const d = await getPublicDistrict(state, district);
  if (!d) notFound();
  const teachers = nearbyTeachers(await getPublicDirectory(), d.district, d.state, [], true);

  return (
    <div className="container-x py-6" data-testid="district-page">
      <SpacesPageHeader
        crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: d.state }, { label: d.district }]}
        title={<span data-testid="district-name">NOSTOPS in {d.district}</span>}
        subtitle={<span className="inline-flex items-center gap-2"><span className="text-[#F28A1E]"><SpIcon name="pin" className="h-5 w-5" /></span>{d.state}</span>}
        image={null}
      />
      <div className="mt-6 space-y-10">
        <section data-testid="district-localities">
          <h2 className="text-[26px]">Active localities</h2>
          {d.active_localities.length ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {d.active_localities.map((l) => (
                <li key={l.id}>
                  <Link href={l.has_spaces ? `/spaces/locality/${encodeURIComponent(l.id)}` : `/spaces?pin=${l.pin}&locality=${encodeURIComponent(l.id)}`}
                    className="sp-card block min-h-[64px] p-3 hover:border-[#F2B574]" data-testid="district-locality">
                    <span className="block font-bold text-[#0F4C4A]">{l.name}</span>
                    <span className="block text-sm text-ink-soft">PIN {l.pin}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="mt-3"><SpEmpty title="No active localities yet" testId="district-localities-empty">NOSTOPS is still onboarding localities in {d.district}.</SpEmpty></div>}
        </section>
        <section data-testid="district-spaces">
          <h2 className="text-[26px]">NOSTOPS Spaces in {d.district}</h2>
          <p className="mt-1 text-[15px] text-ink-soft">Every Space is checked by NOSTOPS. {OFFICIAL_MODELS_NOTE}</p>
          {d.spaces.length ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.spaces.map((s) => <SpaceCard key={s.id} s={s} />)}</div>
          ) : <div className="mt-3"><SpEmpty title="No Spaces listed yet" testId="district-spaces-empty"><Link href="/app/spaces/new" className="font-bold text-brand-700 underline">List a Space</Link></SpEmpty></div>}
        </section>
        <section data-testid="district-teachers">
          <h2 className="text-[26px]">Verified NOSTOPS teachers in {d.district}</h2>
          {teachers.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{teachers.map((t) => <TeacherCard key={t.handle} t={t} />)}</div>
          ) : <div className="mt-3"><SpEmpty title={`No verified teachers listed in ${d.district} yet`} testId="district-teachers-empty"><Link href="/teachers" className="font-bold text-brand-700 underline">Browse all teachers</Link></SpEmpty></div>}
        </section>
      </div>
    </div>
  );
}
