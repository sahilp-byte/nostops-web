import type { Metadata } from 'next';
import Link from 'next/link';
import { searchLocalityNames, searchSpaces, type PublicSpace } from '@/lib/server/spaces';
import { getPublicDirectory } from '@/lib/server/cities';
import { nearbyTeachers } from '@/lib/spaces-teachers';
import { SpaceCard, TeacherCard } from '@/components/spaces/PublicCards';
import { OFFICIAL_MODELS_NOTE, SPACE_MODELS, SPACE_TYPES } from '@/lib/spaces';
import { SpBreadcrumbs, SpEmpty, SpIcon, SpSwash } from '@/components/spaces/ui';
import { canonical } from '@/lib/site';

export const dynamic = 'force-dynamic';
// Public launch SEO: the bare /spaces page is indexable; search-result variants (?pin=, ?q=) stay noindex,follow
// and canonicalise to /spaces so they are never indexed as separate pages.
const SPACES_TITLE = 'NOSTOPS Spaces — yoga spaces in your neighbourhood';
const SPACES_DESC = 'Find community halls, studios and neighbourhood spaces for yoga near your PIN code or locality, and the NOSTOPS teachers who live nearby.';
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const isSearch = !!(sp.pin || sp.q || sp.locality);
  return {
    title: SPACES_TITLE,
    description: SPACES_DESC,
    alternates: { canonical: canonical('/spaces') },
    openGraph: { title: SPACES_TITLE, description: SPACES_DESC, url: canonical('/spaces'), type: 'website' },
    robots: isSearch ? { index: false, follow: true } : { index: true, follow: true },
  };
}

const PIN_RE = /^[1-9][0-9]{5}$/;

export default async function SpacesPage({ searchParams }: { searchParams: Promise<{ pin?: string; q?: string; locality?: string }> }) {
  const { pin: rawPin, q: rawQ, locality: rawLoc } = await searchParams;
  const qText = String(rawQ || '').trim().slice(0, 60);
  // One box: a 6-digit value is a PIN; anything else is an official locality name (prefix of the India Post name).
  const raw = rawPin || (/^\d+$/.test(qText) ? qText : '');
  const nameQuery = !raw && qText ? qText : '';
  const nameRes = nameQuery.length >= 3 ? await searchLocalityNames(nameQuery) : null;
  const pin = String(raw || '').replace(/\D/g, '').slice(0, 6);
  const searched = !!raw || (!!qText && !nameQuery);
  const valid = PIN_RE.test(pin);
  const res = valid ? await searchSpaces(pin) : null;
  const r = res?.result || null;
  const chosen = r && rawLoc ? r.localities.find((l) => l.id === rawLoc) || null : null;
  const atLocality = chosen && r ? r.exact.filter((s) => s.location?.locality_id === chosen.id) : [];
  const teachers = r ? nearbyTeachers(await getPublicDirectory(), r.district, r.state, [...new Set(r.localities.flatMap((l) => [l.name, l.taluk]))]) : [];

  return (
    <div data-testid="spaces-page">
      {/* Hero — mirrors the locality/PIN discovery reference: serif title, PIN field + saffron action, sunrise city art */}
      <section className="relative overflow-hidden border-b border-[#EEDFC8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/spaces/locality-hero.jpg" alt="" aria-hidden className="sp-fade-left pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[46%] object-cover lg:block" />
        <div className="container-x relative py-8 lg:py-10">
          <SpBreadcrumbs items={[{ label: 'Spaces' }]} />
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#FDE7CC] px-4 py-1 text-[14px] font-semibold text-[#7A2E05]"><SpIcon name="pin" className="h-4 w-4" />NOSTOPS Spaces · India</p>
          <h1 className="mt-3 max-w-2xl text-[40px] leading-[1.12] lg:text-[50px]">Find yoga spaces in your neighbourhood</h1>
          <SpSwash className="mt-1 h-3 w-72" />
          <p className="mt-3 max-w-xl text-[18px] font-medium text-[#1C2A47]">Enter your Indian PIN code or locality name to discover community halls, studios and local spaces — and the NOSTOPS teachers who live near you.</p>
          <form method="get" action="/spaces" className="mt-6 flex max-w-xl gap-3" data-testid="spaces-search-form">
            <label className="relative flex-1">
              <span className="sr-only">PIN code or locality name</span>
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#F28A1E]"><SpIcon name="pin" className="h-5 w-5" /></span>
              <input name="q" defaultValue={pin || qText} maxLength={60} minLength={3} required placeholder="PIN code or locality name"
                className="min-h-[54px] w-full rounded-xl border bg-white pl-11 pr-4 text-[18px] font-medium tracking-wide text-ink shadow-sm" data-testid="spaces-pin-input" />
            </label>
            <button type="submit" className="sp-btn-primary bg-brand" data-testid="spaces-search-btn">Search<SpIcon name="search" className="h-5 w-5" strokeWidth={2.2} /></button>
          </form>
          <p className="mt-3 flex items-center gap-1.5 text-[14px] text-[#3B4762]"><SpIcon name="info" className="h-4 w-4" />Available in India only. Outside India? <Link href="/venues" className="font-semibold underline">Browse Global Venues</Link></p>
        </div>
      </section>

      <div className="container-x py-8">
      {searched && !valid && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-semibold text-red-700" data-testid="spaces-invalid">Enter a valid 6-digit Indian PIN code.</p>}
      {nameQuery && nameQuery.length < 3 && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-semibold text-red-700" data-testid="spaces-name-short">Type at least 3 letters of the locality name, or a 6-digit PIN code.</p>}
      {nameRes && (
        <section data-testid="spaces-locality-matches">
          {nameRes.status !== 200 ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-semibold text-red-700" data-testid="spaces-name-error">{nameRes.message || 'We couldn’t search localities right now. Please try again.'}</p>
          ) : !nameRes.localities.length ? (
            <SpEmpty title="No official locality found" testId="spaces-name-empty">No India Post locality name starts with “{nameQuery}”. Check the spelling or search by PIN code.</SpEmpty>
          ) : (
            <>
              <h2 className="text-[26px]">Localities starting with “{nameQuery}”</h2>
              <p className="mt-1 text-[15px] text-ink-soft">Official India Post locality names. Choose yours to see Spaces there.</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nameRes.localities.map((l) => (
                  <li key={l.id}>
                    <Link href={`/spaces?pin=${l.pin}&locality=${encodeURIComponent(l.id)}`} className="sp-card block min-h-[64px] p-3 hover:border-[#F2B574]" data-testid="spaces-locality-match">
                      <span className="block font-bold text-[#0F4C4A]">{l.name}</span>
                      <span className="block text-sm text-ink-soft">{[l.district, l.state].filter(Boolean).join(', ')} · PIN {l.pin}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {nameRes.truncated && <p className="mt-2 text-sm text-ink-soft" data-testid="spaces-name-truncated">Showing the first 30 matches. Type more of the name to narrow the list.</p>}
            </>
          )}
        </section>
      )}
      {valid && !r && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-semibold text-red-700" data-testid="spaces-unknown">{res?.message || 'We couldn’t look up this PIN code right now. Please try again.'}</p>}

      {r && (
        <div className="space-y-10" data-testid="spaces-results">
          <p className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-[#D6EBC6] bg-[#F3FAEC] px-4 py-1.5 text-[15px] text-[#1C2A47]" data-testid="spaces-area"><span className="text-[#22A447]"><SpIcon name="pin" className="h-4 w-4" /></span><span>Showing results for <strong>{chosen ? `${chosen.name}, ` : ''}{r.pin}</strong> · {r.district}, {r.state}</span></p>

          {chosen && (
            <section data-testid="spaces-at-locality">
              <h2 className="text-[26px]">Spaces in {chosen.name}</h2>
              {atLocality.length ? (
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{atLocality.map((s) => <SpaceCard key={s.id} s={s} />)}</div>
              ) : <div className="mt-3"><SpEmpty title={`No Spaces listed in ${chosen.name} yet`} testId="spaces-locality-empty">Other Spaces at PIN {r.pin} are shown below.</SpEmpty></div>}
            </section>
          )}

          {(() => { const rest = r.exact.filter((s) => !atLocality.some((a) => a.id === s.id)); return rest.length || !chosen ? (
          <section>
            <h2 className="text-[26px]">{chosen ? `Other Spaces at ${r.pin}` : `Spaces at ${r.pin}`}</h2>
            {rest.length ? (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="spaces-exact">{rest.map((s) => <SpaceCard key={s.id} s={s} />)}</div>
            ) : <div className="mt-3"><SpEmpty title="No Spaces listed here yet" testId="spaces-exact-empty">No Spaces listed at this PIN code yet.</SpEmpty></div>}
          </section>
          ) : null; })()}

          <section>
            <h2 className="text-[26px]">More Spaces in {r.district}</h2>
            {r.nearby.length ? (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="spaces-nearby">{r.nearby.map((s) => <SpaceCard key={s.id} s={s} />)}</div>
            ) : <p className="mt-2 text-[15px] text-ink-soft" data-testid="spaces-nearby-empty">No other Spaces in {r.district} yet.</p>}
          </section>

          <section>
            <h2 className="text-[26px]">NOSTOPS teachers near you</h2>
            {teachers.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="spaces-teachers">
                {teachers.map((t) => <TeacherCard key={t.handle} t={t} />)}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-soft" data-testid="spaces-teachers-empty">No NOSTOPS teachers listed in {r.district} yet. <Link href="/teachers" className="font-bold text-brand-700 underline">Browse all teachers</Link>.</p>
            )}
          </section>
        </div>
      )}

      <section className="sp-card mt-12 grid gap-6 overflow-hidden p-6 lg:grid-cols-[1fr_1.1fr] lg:p-8" data-testid="spaces-list-cta">
        <div>
          <h2 className="text-[30px] leading-tight">Have a hall, studio or community space?</h2>
          <SpSwash className="mt-1 h-3 w-56" />
          <p className="mt-3 max-w-xl text-[16px] text-[#1C2A47]">List it on NOSTOPS Spaces so teachers can run yoga programmes for your neighbourhood. Listing is free. Every Space is checked by NOSTOPS before it goes live.</p>
          <p className="mt-4 rounded-xl border border-[#F6DFC0] bg-[#FFF6EA] p-3 text-[14px] text-[#1C2A47]" data-testid="official-models-note"><strong>Important:</strong> {OFFICIAL_MODELS_NOTE}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/app/spaces/new" className="sp-btn-primary bg-brand" data-testid="spaces-list-btn">List a Space<SpIcon name="arrowRight" className="h-5 w-5" strokeWidth={2.2} /></Link>
            <Link href="/spaces/community-partners" className="sp-btn-secondary">Community Partners</Link>
          </div>
        </div>
        <div>
          <h3 className="text-[22px]">The Three Participation Models</h3>
          <div className="mt-3 divide-y divide-[#EEDFC8]" data-testid="spaces-models">
            {Object.entries(SPACE_MODELS).map(([k, m]) => (
              <div key={m.label} className="flex items-start gap-4 py-3">
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${k === 'community' ? 'bg-[#E6F5DC] text-[#22A447]' : 'bg-[#FDE7CC] text-[#E8690C]'}`}><SpIcon name={k === 'commercial' ? 'building' : k === 'subsidised' ? 'tag' : 'users'} className="h-8 w-8" /></span>
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-[18px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{m.label} Space <span className={`rounded-full px-3 py-0.5 text-[13px] font-semibold ${m.tone}`} style={{ fontFamily: 'var(--sp-sans)' }}>{m.badge}</span></p>
                  <p className="mt-0.5 text-[15px] text-[#1C2A47]">{m.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
