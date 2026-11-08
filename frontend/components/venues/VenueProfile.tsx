import Link from 'next/link';
import { notFound } from 'next/navigation';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical, toWww } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { titleCase } from '@/lib/format';
import { getVenue, getVenues, getRetreatsAtVenue, getVenueGoogle, fmtOpenMonths, venuePath, venueCitySlug, computeAvailabilityItems } from '@/lib/server/venues';
import { getPublicRetreats, type PublicRetreat } from '@/lib/server/retreats';
import { getCities, citySlug } from '@/lib/server/cities';
import { getVerifiedMatcher } from '@/lib/server/venue-submissions-local';
import { getPlaceDetails } from '@/lib/server/google-places';
import { googleAccess, withGoogleCovers } from '@/lib/server/ai-assisted-venues';
import EnhancedBadge from '@/components/venues/EnhancedBadge';
import VenueGrowthTracker from '@/components/venues/growth/VenueGrowthTracker';
import { getVenueAnalysis, type RetreatInsight } from '@/lib/server/venue-insight';
import RetreatGallery from '@/components/retreats/RetreatGallery';
import RetreatCard from '@/components/retreats/RetreatCard';
import VenueReviews from '@/components/retreats/VenueReviews';
import VenueAvailability from '@/components/venues/VenueAvailability';
import ShareButtons from '@/components/share/ShareButtons';
import SaveVenueButton from '@/components/venues/SaveVenueButton';
import RetreatFaq from '@/components/retreats/RetreatFaq';
import AiRetreatInsight from '@/components/retreats/AiRetreatInsight';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-20">
      <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-lg">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

async function load(id: string) {
  const v = await getVenue(id);
  if (!v) return null;
  const retreats = await getRetreatsAtVenue(id);
  const google = await getVenueGoogle(retreats).catch(() => null);
  const [venues, cities, allRetreats] = await Promise.all([
    getVenues({ limit: 100 }),
    getCities().catch(() => []),
    getPublicRetreats().catch(() => ({ retreats: [] as PublicRetreat[] })),
  ]);
  const others = await withGoogleCovers(venues.filter((x) => x.id !== id).slice(0, 3));
  // City internal-linking — gated so we NEVER link to a page that 404s.
  const slug = v.city ? citySlug(v.city) : '';
  const cityHasTeachers = !!slug && cities.some((c) => c.slug === slug);
  const cityHasRetreats = !!slug && allRetreats.retreats.some((r) => r.city && citySlug(r.city) === slug);
  return { v, retreats, google, others, slug, cityHasTeachers, cityHasRetreats };
}

export default async function VenueProfile({ venueId }: { venueId: string }) {
  const data = await load(venueId);
  if (!data) notFound();
  const { v, retreats, google, others, slug, cityHasTeachers, cityHasRetreats } = data;
  const isVerified = await getVerifiedMatcher().then((m) => m({ id: v.id, venuePartnerId: v.id, name: v.name, city: v.city })).catch(() => false);
  // Google photos & reviews are a PAID, per-venue feature (or grandfathered).
  // Free listings show only the owner's own photos, or a neutral placeholder.
  // Eligible venues use the retreat-connected enrichment, else a LIVE Places
  // Details fetch for their admin-confirmed (pinned) place_id.
  const access = await googleAccess(v);
  let enrichment = access.allowed ? google?.e || null : null;
  let liveVenueEnrichment = false;
  if (access.allowed && !enrichment && access.placeId) {
    const live = await getPlaceDetails(access.placeId).catch(() => null);
    if (live) {
      enrichment = live;
      liveVenueEnrichment = true;
    }
  }
  const location = [v.city, v.state].filter(Boolean).join(', ');

  // NOSTOPS AI analysis + "Verified Venue" badge are shown when this profile
  // fetches photos + reviews from the venue's verified Google Business listing
  // (the paid AI-assisted venues, or any retreat-connected venue with reviews).
  const fetchesGoogleListing = !!enrichment && enrichment.reviews.length > 0;
  const venueAnalysis: RetreatInsight | null = fetchesGoogleListing
    ? await getVenueAnalysis(
        {
          id: v.id,
          name: v.name,
          city: v.city,
          state: v.state,
          summary: v.summary,
          capacity: v.capacity,
          bestForFramings: v.bestForFramings,
          sattvicCertified: v.sattvicCertified,
        },
        enrichment,
      ).catch(() => null)
    : null;
  const venueFacts: string[] = fetchesGoogleListing
    ? [
        location ? `Located in ${location}` : '',
        typeof v.capacity === 'number' ? `Hosts up to ${v.capacity} guests` : '',
        v.sattvicCertified ? 'Sattvic vegetarian kitchen · certified' : '',
        v.openMonths.length > 0 ? `Open ${fmtOpenMonths(v.openMonths)}` : '',
        typeof enrichment?.rating === 'number' ? `Rated ${enrichment.rating.toFixed(1)} on Google${enrichment.reviewCount ? ` (${enrichment.reviewCount} reviews)` : ''}` : '',
        v.bestForFramings.length ? `Best for ${v.bestForFramings.map((f) => titleCase(f)).join(', ')}` : '',
      ].filter(Boolean)
    : [];

  // Maps / website links. Admin-corrected values (the separate Google Business
  // Listing URL, then the combined website/maps field) take precedence over the
  // Google-derived enrichment URL, so a stale derived value never masks a fix.
  const isMapsLink = (u?: string) => !!u && /(?:google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page|maps\.google|[?&]cid=)/i.test(u);
  const correctedUrl = (v.websiteOrMapsUrl || '').trim();
  const businessUrl = (v.googleBusinessUrl || '').trim();
  const mapsLink = businessUrl || (isMapsLink(correctedUrl) ? correctedUrl : '') || enrichment?.mapsUri || '';
  const websiteLink = (correctedUrl && !isMapsLink(correctedUrl) ? correctedUrl : '') || enrichment?.websiteUri || '';

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = retreats.filter((r) => !r.endDate || r.endDate >= today);

  // Gallery: cover + Google photos + retreat covers. Google photos stream through
  // the retreat proxy when retreat-connected, else the venue media proxy (live).
  const googlePhotoUrls = (enrichment?.photos || [])
    .map((p) =>
      liveVenueEnrichment
        ? `/bff/venue-photo/media?name=${encodeURIComponent(p.name)}&w=1200`
        : google
          ? `/bff/retreats/${google.retreatId}/venue-photo?name=${encodeURIComponent(p.name)}&w=1200`
          : '',
    )
    .filter(Boolean);
  const retreatImages = retreats.flatMap((r) => (r.coverImage ? [r.coverImage] : []));
  // Hero: the owner's cover first; an eligible venue without one uses its first Google photo.
  const heroImage = v.coverImage || googlePhotoUrls[0] || null;
  const galleryImages = Array.from(new Set([v.coverImage, ...(v.photos || []), ...googlePhotoUrls, ...retreatImages].filter(Boolean) as string[]));

  // Teachers who host here (public host names) — deduped.
  const hostMap = new Map<string, { name: string; handle?: string; count: number }>();
  for (const r of retreats) {
    if (!r.guruName) continue;
    const key = r.guruHandle || r.guruName;
    const cur = hostMap.get(key);
    if (cur) cur.count += 1;
    else hostMap.set(key, { name: r.guruName, handle: r.guruHandle, count: 1 });
  }
  const hosts = [...hostMap.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  // Venue track record.
  const totalRetreats = retreats.length;
  const distinctTeachers = hostMap.size;
  const repeatTeachers = [...hostMap.values()].filter((h) => h.count > 1).length;
  const pastRetreats = retreats.filter((r) => r.endDate && r.endDate < today);
  const occSamples = retreats.filter((r) => typeof r.seatsTotal === 'number' && r.seatsTotal > 0);
  const avgOccupancyPct = occSamples.length
    ? Math.round(
        (occSamples.reduce((acc, r) => acc + Math.max(0, (r.seatsTotal || 0) - (r.seatsRemaining ?? 0)) / (r.seatsTotal || 1), 0) / occSamples.length) * 100,
      )
    : null;
  const hasTrackRecord = totalRetreats > 0;

  const trust: { icon: string; text: string }[] = [];
  if (isVerified) trust.push({ icon: '🛡️', text: 'NOSTOPS Verified Venue' });
  if (v.sattvicCertified) trust.push({ icon: '🥗', text: 'Sattvic-certified kitchen' });
  if (typeof enrichment?.rating === 'number') trust.push({ icon: '⭐', text: `${enrichment.rating.toFixed(1)} on Google${enrichment.reviewCount ? ` · ${enrichment.reviewCount} reviews` : ''}` });
  trust.push({ icon: '🛡️', text: 'NOSTOPS cooperative venue' });
  if (hosts.length > 0) trust.push({ icon: '🧘', text: `Hosted by ${hosts.length} verified teacher${hosts.length === 1 ? '' : 's'}` });

  const path = venuePath(v);
  const url = canonical(path);
  const amenities: { '@type': 'LocationFeatureSpecification'; name: string; value: true }[] = [];
  if (v.sattvicCertified) amenities.push({ '@type': 'LocationFeatureSpecification', name: 'Sattvic vegetarian kitchen', value: true });
  amenities.push({ '@type': 'LocationFeatureSpecification', name: 'Yoga practice hall', value: true });
  for (const a of v.amenities || []) amenities.push({ '@type': 'LocationFeatureSpecification', name: a, value: true });
  const galleryForLd = [v.coverImage, ...retreatImages].filter(Boolean).slice(0, 6) as string[];
  const place: any = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': url,
    url,
    name: v.name,
    ...(v.summary ? { description: v.summary } : {}),
    ...(galleryForLd.length ? { image: galleryForLd.map(toWww) } : {}),
    address: { '@type': 'PostalAddress', ...(v.country ? { addressCountry: v.country } : {}), ...(v.city ? { addressLocality: v.city } : {}), ...(v.state ? { addressRegion: v.state } : {}) },
    ...(typeof v.lat === 'number' && typeof v.lng === 'number' ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}),
    ...(typeof v.capacity === 'number' ? { maximumAttendeeCapacity: v.capacity } : {}),
    ...(amenities.length ? { amenityFeature: amenities } : {}),
    ...(typeof enrichment?.rating === 'number' ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: enrichment.rating, ...(enrichment.reviewCount ? { reviewCount: enrichment.reviewCount } : {}) } } : {}),
  };

  // Venue FAQ (verified facts) shown on-page AND as FAQPage JSON-LD.
  const gt = v.gettingThere;
  const baseGettingThere = gt
    ? gt.text ||
      [gt.nearestAirport && `Nearest airport: ${gt.nearestAirport}`, gt.nearestRailway && `Nearest railway: ${gt.nearestRailway}`, gt.nearestRoadHub && `By road: ${gt.nearestRoadHub}`, gt.localTransport && `Local transport: ${gt.localTransport}`]
        .filter(Boolean)
        .join('. ')
    : '';
  const gettingThereParts: string[] = [];
  if (baseGettingThere) gettingThereParts.push(/[.!?]$/.test(baseGettingThere.trim()) ? baseGettingThere.trim() : `${baseGettingThere.trim()}.`);
  else if (enrichment?.address) gettingThereParts.push(`${v.name} is located at ${enrichment.address}.`);
  else if (location) gettingThereParts.push(`${v.name} is in ${location}, India.`);
  const gettingThereText = gettingThereParts.join(' ').trim();

  const climateText = v.weatherBand ? `Climate: ${/[.!?]$/.test(v.weatherBand.trim()) ? v.weatherBand.trim() : `${v.weatherBand.trim()}.`}` : '';
  const bestTimeText = [v.openMonths.length ? fmtOpenMonths(v.openMonths) : '', climateText].filter(Boolean).join(' · ');

  const venueFaqs: { q: string; a: string }[] = [
    location ? { q: `Where is ${v.name}?`, a: `${v.name} is located in ${location}, India.` } : { q: '', a: '' },
    typeof v.capacity === 'number' ? { q: `How many guests can ${v.name} host?`, a: `Up to ${v.capacity} guests for a residential yoga retreat.` } : { q: '', a: '' },
    { q: 'Is the food vegetarian?', a: v.sattvicCertified ? 'Yes — the kitchen serves sattvic vegetarian meals and is certified.' : 'Meals are vegetarian and prepared fresh on-site; specifics are confirmed by the host for each retreat.' },
    v.bestForFramings.length ? { q: `What is ${v.name} best suited for?`, a: `Well suited for ${v.bestForFramings.map((f) => titleCase(f)).join(', ')} and residential yoga immersions.` } : { q: '', a: '' },
    bestTimeText ? { q: `When is the best time to visit ${v.name}?`, a: bestTimeText } : { q: '', a: '' },
    gettingThereText ? { q: `How do I get to ${v.name}?`, a: gettingThereText } : { q: '', a: '' },
  ].filter((x) => x.q && x.a);

  const jsonld = normalizeJsonLd([
    place,
    ...(venueFaqs.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          '@id': `${url}#faq`,
          mainEntity: venueFaqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }]
      : []),
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
        { '@type': 'ListItem', position: 2, name: 'Venues', item: canonical('/venues') },
        ...(v.city ? [{ '@type': 'ListItem', position: 3, name: v.city, item: canonical(`/venues/in/${venueCitySlug(v)}`) }] : []),
        { '@type': 'ListItem', position: v.city ? 4 : 3, name: v.name, item: url },
      ],
    },
  ]);

  const hasGoodToKnow = gettingThereText || v.thingsToCarry.length > 0;
  const foodText = v.sattvicCertified
    ? 'Sattvic vegetarian kitchen — fresh, seasonal, prepared on-site. Certified.'
    : 'Vegetarian meals, freshly prepared on-site. Dietary needs are confirmed with the host for each retreat.';

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />
      <VenueGrowthTracker venueId={v.id} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/venues" className="hover:text-brand-700">Venues</Link>
          <span aria-hidden>/</span>
          {v.city && (
            <>
              <Link href={`/venues/in/${venueCitySlug(v)}`} className="hover:text-brand-700">{v.city}</Link>
              <span aria-hidden>/</span>
            </>
          )}
          <span className="line-clamp-1 max-w-[16rem] font-semibold text-ink-soft">{v.name}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink">
        {heroImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={v.name} className="absolute inset-0 h-full w-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-ink to-accent-600 opacity-90" />
        )}
        <div className="container-x relative py-16 md:py-24">
          <div className="flex flex-wrap items-center gap-2">
            {access.allowed && access.basis !== 'admin' && <EnhancedBadge />}
            {fetchesGoogleListing && (access.basis !== 'admin' || isVerified) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm" data-testid="venue-verified-venue-badge">
                <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current"><path fillRule="evenodd" d="M10 1.5l2.1 1.53 2.59-.09.93 2.42 2.1 1.5-.78 2.48.78 2.48-2.1 1.5-.93 2.42-2.59-.09L10 18.5l-2.1-1.53-2.59.09-.93-2.42-2.1-1.5.78-2.48L2.28 8.4l2.1-1.5.93-2.42 2.59.09L10 1.5zm3.03 6.12a.75.75 0 00-1.06-1.06L8.75 9.78 7.03 8.06A.75.75 0 005.97 9.12l2.25 2.25c.3.3.77.3 1.06 0l3.75-3.75z" clipRule="evenodd" /></svg>
                Verified Venue
              </span>
            )}
            {isVerified && <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white" data-testid="venue-verified-badge">🛡️ NOSTOPS Verified Venue</span>}
            {v.sattvicCertified && <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">Sattvic certified</span>}
            {v.growthPartner && (
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur" title="This venue shares NOSTOPS on its own website. Not a verification or endorsement." data-testid="venue-partner-badge">
                🤝 NOSTOPS Partner
              </span>
            )}
            {typeof enrichment?.rating === 'number' && (
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur"><span aria-hidden className="text-amber-400">★</span> {enrichment.rating.toFixed(1)} Google</span>
            )}
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[1.1] tracking-tight text-white md:text-5xl">{v.name}</h1>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/85">
            {location && <span className="flex items-center gap-2"><span aria-hidden>📍</span>{location}</span>}
            {typeof v.capacity === 'number' && <span className="flex items-center gap-2"><span aria-hidden>👥</span>Up to {v.capacity} guests</span>}
            {v.openMonths.length > 0 && <span className="flex items-center gap-2"><span aria-hidden>🗓️</span>{fmtOpenMonths(v.openMonths)}</span>}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {upcoming.length > 0 ? (
              <a href="#retreats" className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-accent-600">See retreats here →</a>
            ) : (
              <Link href="/retreats" className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-accent-600">Browse all retreats →</Link>
            )}
            <ShareButtons path={path} title={v.name} message={`Discover ${v.name}${location ? `, ${location}` : ''} — a yoga retreat venue on NOSTOPS`} tone="dark" />
            <SaveVenueButton id={v.id} name={v.name} variant="pill" />
          </div>
        </div>
      </section>

      <div className="container-x space-y-12 py-12">
        {galleryImages.length > 0 && (
          <RetreatGallery images={galleryImages} title={v.name} attribution={googlePhotoUrls.length ? 'Some photos via Google' : undefined} />
        )}

        {v.summary && (
          <Section title="About this venue">
            <p className="whitespace-pre-line text-lg leading-relaxed text-ink-soft">{v.summary}</p>
          </Section>
        )}

        {fetchesGoogleListing && (
          <AiRetreatInsight
            facts={venueFacts}
            insight={venueAnalysis}
            title="NOSTOPS AI Analysis"
            subtitle="NOSTOPS AI reads this venue from its verified Google Business listing — facts, review patterns and interpretation kept clearly apart."
            disclaimer="This analysis is an AI synthesis of the venue's public Google reviews and verified facts — not a promise. It makes no medical claims and guarantees no outcomes. Please confirm details before booking."
            testId="venue-ai-analysis"
          />
        )}

        {(mapsLink || websiteLink) && (
          <Section title="Find this venue">
            <div className="flex flex-wrap items-center gap-3" data-testid="venue-find-links">
              {mapsLink && (
                <a href={mapsLink} target="_blank" rel="noopener noreferrer nofollow" data-testid="venue-maps-link" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">
                  <span aria-hidden>📍</span> View on Google Maps ↗
                </a>
              )}
              {websiteLink && (
                <a href={websiteLink} target="_blank" rel="noopener noreferrer nofollow" data-testid="venue-website-link" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">
                  <span aria-hidden>🌐</span> Visit website ↗
                </a>
              )}
            </div>
          </Section>
        )}

        <div className="rounded-2xl border border-line bg-cream/60 p-4 text-sm text-ink-soft" data-testid="venue-claim-cta">
          Own or manage {v.name}?{' '}
          <a href={`/app/venue/claim/${encodeURIComponent(v.id)}`} className="font-bold text-brand-700 hover:underline" rel="nofollow" data-testid="venue-claim-link">Claim this venue</a>{' '}
          to keep its details up to date. Open to empanelled NOSTOPS teachers and Council Gurus; every claim is reviewed by NOSTOPS.
        </div>

        {/* The space & facilities */}
        <Section title="The space & facilities">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {typeof v.capacity === 'number' && <Fact icon="👥" label="Capacity" value={`Up to ${v.capacity} guests`} />}
            {v.sattvicCertified && <Fact icon="🥗" label="Kitchen" value="Sattvic vegetarian, certified" />}
            {v.weatherBand && <Fact icon="🌤️" label="Climate" value={v.weatherBand} />}
            {v.openMonths.length > 0 && <Fact icon="🗓️" label="Season" value={fmtOpenMonths(v.openMonths)} />}
            {v.bestForFramings.map((f) => <Fact key={f} icon="✨" label="Best for" value={titleCase(f)} />)}
          </div>
          {v.amenities && v.amenities.length > 0 && (
            <div className="mt-5" data-testid="venue-amenities">
              <h3 className="text-sm font-black uppercase tracking-wide text-muted">Amenities</h3>
              <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
                {v.amenities.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-brand-50/50 px-3 py-1 text-sm font-semibold text-ink-soft">
                    <span aria-hidden className="text-brand-700">✓</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Yoga suitability */}
        <Section title="Yoga suitability">
          <p className="text-ink-soft">
            {v.name} is set up for residential yoga practice{typeof v.capacity === 'number' ? ` for groups of up to ${v.capacity}` : ''} — a dedicated practice space, quiet surroundings and a rhythm that supports early-morning sadhana.
          </p>
          {v.bestForFramings.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" data-testid="venue-yoga-suitability">
              {v.bestForFramings.map((f) => (
                <span key={f} className="rounded-full border border-brand/20 bg-brand-50/60 px-3 py-1 text-sm font-semibold text-brand-700">Ideal for {titleCase(f)}</span>
              ))}
            </div>
          )}
        </Section>

        {/* Accommodation & Food */}
        <Section title="Accommodation & food">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5" data-testid="venue-accommodation">
              <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-muted"><span aria-hidden>🛏️</span> Accommodation</p>
              <p className="mt-2 text-ink-soft">
                {typeof v.capacity === 'number' ? `On-site residential stay for up to ${v.capacity} guests. ` : 'On-site residential stay. '}
                Room types and sharing are confirmed with the host for each retreat.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5" data-testid="venue-food">
              <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-muted"><span aria-hidden>🥗</span> Food</p>
              <p className="mt-2 text-ink-soft">{foodText}</p>
            </div>
          </div>
        </Section>

        {/* Good to know */}
        {hasGoodToKnow && (
          <Section title="Good to know">
            <div className="grid gap-6 sm:grid-cols-2">
              {v.gettingThere && (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-muted">Getting there & transport</h3>
                  {v.gettingThere.text ? (
                    <p className="mt-2 whitespace-pre-line text-ink-soft">{v.gettingThere.text}</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 text-ink-soft">
                      {v.gettingThere.nearestAirport && <li><span className="font-semibold text-ink">✈️ Airport:</span> {v.gettingThere.nearestAirport}</li>}
                      {v.gettingThere.nearestRailway && <li><span className="font-semibold text-ink">🚆 Railway:</span> {v.gettingThere.nearestRailway}</li>}
                      {v.gettingThere.nearestRoadHub && <li><span className="font-semibold text-ink">🛣️ By road:</span> {v.gettingThere.nearestRoadHub}</li>}
                      {v.gettingThere.localTransport && <li><span className="font-semibold text-ink">🚕 Local:</span> {v.gettingThere.localTransport}</li>}
                    </ul>
                  )}
                </div>
              )}
              {v.thingsToCarry.length > 0 && <div><h3 className="text-sm font-black uppercase tracking-wide text-muted">What to carry</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{v.thingsToCarry.map((x) => <li key={x} className="capitalize">{x}</li>)}</ul></div>}
            </div>
          </Section>
        )}

        {/* Video tour */}
        {v.videoUrl && (
          <Section title="Video tour">
            <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">▶ Watch the venue tour</a>
          </Section>
        )}

        {/* Google reviews */}
        {enrichment && (enrichment.reviews.length > 0 || typeof enrichment.rating === 'number') && (
          <Section title="What guests say">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {typeof enrichment.rating === 'number' && <span className="font-semibold text-ink"><span aria-hidden className="text-amber-500">★</span> {enrichment.rating.toFixed(1)}{enrichment.reviewCount ? ` (${enrichment.reviewCount})` : ''}</span>}
              </div>
              <p className="mt-3 text-[11px] text-muted">Venue rating &amp; reviews provided by Google.</p>
            </div>
            {enrichment.reviews.length > 0 && <div className="mt-4"><VenueReviews reviews={enrichment.reviews} /></div>}
          </Section>
        )}

        {/* Track record */}
        {hasTrackRecord && (
          <Section title="Track record at this venue">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="venue-track-record">
              <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black text-ink">{totalRetreats}</p><p className="mt-0.5 text-xs font-semibold text-muted">Retreats hosted{pastRetreats.length ? ` · ${pastRetreats.length} completed` : ''}</p></div>
              <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black text-ink">{distinctTeachers}</p><p className="mt-0.5 text-xs font-semibold text-muted">Teacher{distinctTeachers === 1 ? '' : 's'} hosted here</p></div>
              <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black text-brand-700">{repeatTeachers}</p><p className="mt-0.5 text-xs font-semibold text-muted">Teacher{repeatTeachers === 1 ? '' : 's'} who returned</p></div>
              <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black text-ink">{avgOccupancyPct === null ? '—' : `${avgOccupancyPct}%`}</p><p className="mt-0.5 text-xs font-semibold text-muted">Average occupancy</p></div>
            </div>
            {repeatTeachers > 0 && (
              <p className="mt-3 text-sm text-ink-soft">🔁 Teachers come back to {v.name} — a sign of a venue that delivers for practice, stay and hospitality.</p>
            )}
          </Section>
        )}

        {/* Host information */}
        {hosts.length > 0 && (
          <Section title="Teachers who host here">
            <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {hosts.map((h) => (
                <li key={h.name} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg font-black text-brand-700">{h.name.charAt(0)}</span>
                  <div className="min-w-0">
                    {h.handle ? (
                      <Link href={`/teachers/${h.handle}`} className="font-black text-ink hover:text-brand-700 hover:underline">{h.name}</Link>
                    ) : (
                      <span className="font-black text-ink">{h.name}</span>
                    )}
                    <p className="text-xs text-muted">{h.count} retreat{h.count === 1 ? '' : 's'} here{h.count > 1 ? ' · returning teacher' : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Trust signals */}
        <Section title="Why you can trust this venue">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trust.map((t) => (
              <div key={t.text} className="flex items-center gap-3 rounded-xl border border-brand/15 bg-brand-50/40 p-4">
                <span aria-hidden className="text-2xl">{t.icon}</span>
                <span className="text-sm font-semibold text-ink">{t.text}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Availability + retreats at this venue */}
        <section id="retreats" className="scroll-mt-20">
          <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Availability & upcoming retreats</h2>
          <p className="mt-1 text-sm text-muted">Live occupancy and remaining seats. Pick a date window to see what’s open.</p>
          <div className="mt-4">
            <VenueAvailability venueId={v.id} initial={computeAvailabilityItems(retreats, today)} initialFrom={today} />
          </div>
          {upcoming.length > 0 && (
            <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((r: PublicRetreat) => <li key={r.id}><RetreatCard r={r} /></li>)}
            </ul>
          )}
        </section>

        {/* Venue FAQ (matches FAQPage JSON-LD) */}
        {venueFaqs.length > 0 && <RetreatFaq items={venueFaqs} />}

        {/* Explore the city — contextual internal links (gated to live pages) */}
        {v.city && (
          <section aria-label={`Explore ${v.city}`}>
            <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Explore {v.city}</h2>
            <p className="mt-1 text-sm text-muted">Discover the wider NOSTOPS yoga ecosystem around {v.city}.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="venue-city-links">
              <Link href={`/venues/in/${venueCitySlug(v)}`} className="card group flex items-center gap-3 p-4 transition hover:border-brand hover:shadow-md" data-testid="venue-city-venues-link">
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg">🏡</span>
                <span className="min-w-0 font-black text-ink group-hover:text-brand-700">All venues in {v.city} →</span>
              </Link>
              {cityHasTeachers && (
                <Link href={`/yoga-teachers/${slug}`} className="card group flex items-center gap-3 p-4 transition hover:border-brand hover:shadow-md" data-testid="venue-city-teachers-link">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg">🧘</span>
                  <span className="min-w-0 font-black text-ink group-hover:text-brand-700">Yoga teachers in {v.city} →</span>
                </Link>
              )}
              {cityHasRetreats && (
                <Link href={`/retreats/in/${slug}`} className="card group flex items-center gap-3 p-4 transition hover:border-brand hover:shadow-md" data-testid="venue-city-retreats-link">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-lg">🌿</span>
                  <span className="min-w-0 font-black text-ink group-hover:text-brand-700">Yoga retreats in {v.city} →</span>
                </Link>
              )}
              {cityHasTeachers && (
                <Link href={`/become-a-teacher/${slug}`} className="card group flex items-center gap-3 p-4 transition hover:border-brand hover:shadow-md" data-testid="venue-city-become-link">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-royal-50 text-lg">✨</span>
                  <span className="min-w-0 font-black text-ink group-hover:text-brand-700">Become a teacher in {v.city} →</span>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Other venues */}
        {others.length > 0 && (
          <section>
            <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Other NOSTOPS venues</h2>
            <ul className="mt-5 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-3">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={venuePath(o)} className="card group flex items-center gap-3 p-4 transition hover:border-brand hover:shadow-md">
                    {o.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.coverImage} alt={o.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-700 via-brand to-accent-600 text-lg font-black text-white">{(o.name.trim()[0] || 'N').toUpperCase()}</span>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-black text-ink group-hover:text-brand-700">{o.name}</p>
                      <p className="line-clamp-1 text-xs text-muted">{[o.city, o.state].filter(Boolean).join(', ')}</p>
                      {o.coverFromGoogle && <p className="text-[10px] text-muted">Photo: Google</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href="/venues" className="block text-center text-sm font-bold text-brand-700 hover:underline">← All venues</Link>
      </div>
    </main>
  );
}
