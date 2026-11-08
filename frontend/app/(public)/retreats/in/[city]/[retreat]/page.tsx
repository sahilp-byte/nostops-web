import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { metaToMetadata, normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import CopyLinkButton from '@/components/CopyLinkButton';
import ShareButtons from '@/components/share/ShareButtons';
import { retreatIdFromParam, retreatPath, retreatCitySlug, retreatSlug } from '@/lib/retreat-url';
import { inr, titleCase } from '@/lib/format';
import { citySlug } from '@/lib/server/cities';
import { isTeacherActivePublic, publicTrust } from '@/lib/public-teacher';
import { refundFor } from '@/lib/cancellation';
import {
  isPublicRetreatRecord,
  toPublicRetreat,
  getPublicRetreats,
  getRetreatSeo,
  getVenueEnrichment,
  relatedRetreats,
  fmtRange,
  durationDays,
  statusLabel,
  type PublicRetreat,
  type VenueEnrichment,
} from '@/lib/server/retreats';
import RetreatGallery from '@/components/retreats/RetreatGallery';
import RetreatCard from '@/components/retreats/RetreatCard';
import { getRetreatInsight } from '@/lib/server/venue-insight';
import { getVerifiedMatcher } from '@/lib/server/venue-submissions-local';
import { getVenue, venuePath } from '@/lib/server/venues';
import { retreatGoogleAllowed } from '@/lib/server/ai-assisted-venues';
import EnquiryForm from '@/components/retreats/EnquiryForm';
import RetreatReserveCta from '@/components/retreats/RetreatReserveCta';
import RetreatItineraryTimeline from '@/components/retreats/RetreatItineraryTimeline';
import RetreatPriceBreakdown from '@/components/retreats/RetreatPriceBreakdown';
import CancellationPolicy from '@/components/retreats/CancellationPolicy';
import AskTeacher from '@/components/retreats/AskTeacher';
import SaveRetreatButton from '@/components/retreats/SaveRetreatButton';
import MinimumCohort from '@/components/app/teacher/MinimumCohort';
import YogaSeKyaHoga from '@/components/retreats/YogaSeKyaHoga';
import AiRetreatInsight from '@/components/retreats/AiRetreatInsight';
import RetreatFaq from '@/components/retreats/RetreatFaq';
import RightForYou from '@/components/retreats/RightForYou';
import TrustSection from '@/components/retreats/TrustSection';
import { parseRetreatContent } from '@/lib/retreat-content';
import { buildRetreatJsonLd } from '@/lib/retreat-jsonld';
import BringYourGroupCta from '@/components/retreats/BringYourGroupCta';
import SeatProgress from '@/components/retreats/SeatProgress';

// Rendered per request, like every other public page with live data. With no public
// retreats at build time nothing was prerendered, so the route was treated as static and
// the first visit crashed ("static to dynamic at runtime", P2 2026-10). Data fetches below
// stay cached (fetch-level revalidate), so this costs no extra backend load.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ city: string; retreat: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

async function fetchRaw(id: string): Promise<{ data: any; status: number }> {
  try {
    const data = await apiGet<any>(`/retreats/${id}`, { revalidate: 900 });
    return { data, status: 200 };
  } catch (e) {
    const m = /Backend (\d+)/.exec((e as Error)?.message || '');
    return { data: null, status: m ? Number(m[1]) : 0 };
  }
}

async function getEligibleTeachers(): Promise<Map<string, any>> {
  try {
    const d = await apiGet<{ teachers?: any[] }>('/teachers/directory', { revalidate: 3600 });
    const raw = Array.isArray(d?.teachers) ? d.teachers : [];
    const m = new Map<string, any>();
    for (const t of raw) {
      if (isTeacherActivePublic(t)) {
        m.set(String(t.handle), t);
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

async function getHostReviews(handle: string): Promise<{ items: { rating: number; text: string; name: string; role: string }[]; avg: number; count: number }> {
  try {
    const d = await apiGet<any>(`/public-reviews/${handle}`, { revalidate: 900 });
    const raw = Array.isArray(d?.reviews) ? d.reviews : [];
    const items = raw
      .filter((x: any) => x && x.text)
      .slice(0, 6)
      .map((x: any) => ({
        rating: Math.max(0, Math.min(5, Number(x.rating) || 0)),
        text: String(x.text || ''),
        name: String(x.reviewer_name || 'A seeker'),
        role: String(x.reviewer_role || ''),
      }));
    return { items, avg: Number(d?.stats?.avg) || 0, count: Number(d?.stats?.count) || items.length };
  } catch {
    return { items: [], avg: 0, count: 0 };
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { retreat: retreatParam } = await params;
  const id = retreatIdFromParam(retreatParam);
  if (!id) return { title: 'Page not found', robots: { index: false, follow: false } };
  const seo = await getRetreatSeo(id);
  const raw = await fetchRaw(id);
  const r = raw.data && raw.data.retreat_id ? toPublicRetreat(raw.data) : null;
  const url = canonical(r ? retreatPath(r) : `/retreats/${id}`);
  const mapped = metaToMetadata(seo.meta);
  const title = mapped.title ?? { absolute: 'Yoga Retreat · NOSTOPS' };
  const description = mapped.description ?? 'An immersive yoga retreat hosted through the NOSTOPS cooperative.';
  // Drop any backend-provided og/twitter IMAGE (often a same-origin /bff/media cover
  // that social scrapers cannot fetch). Our file-based opengraph-image / twitter-image
  // routes then supply a real https, per-retreat 1200x630 card (the cover photo under the
  // NOSTOPS gradient + title / hosting teacher / city / dates) that crawlers CAN fetch.
  const { images: _ogImg, ...og } = (mapped.openGraph ?? {}) as Record<string, any>;
  const { images: _twImg, ...tw } = (mapped.twitter ?? {}) as Record<string, any>;
  const ogTitle = og.title ?? (typeof title === 'object' ? (title as any).absolute : title);
  const ogDesc = og.description ?? description;
  const OG_TYPES = new Set(['website', 'article', 'book', 'profile']);
  const ogType = OG_TYPES.has(String(og.type)) ? og.type : 'website';
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: { ...og, type: ogType, siteName: og.siteName ?? 'NOSTOPS', url, title: ogTitle, description: ogDesc },
    twitter: { ...tw, card: tw.card ?? 'summary_large_image', title: ogTitle, description: ogDesc },
  };
}

async function getCohortAgg(id: string): Promise<{ confirmedCount: number; seatsTotal: number } | null> {
  try {
    const d = await apiGet<any>(`/retreats/${id}/cohort`, { revalidate: 300 });
    if (!d) return null;
    return { confirmedCount: Number(d.confirmed_count) || 0, seatsTotal: Number(d.seats_total) || 0 };
  } catch {
    return null;
  }
}

function stripPerformer<T>(nodes: T): T {
  if (Array.isArray(nodes)) return nodes.map(stripPerformer) as T;
  if (nodes && typeof nodes === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nodes)) if (k !== 'performer') out[k] = stripPerformer(v);
    return out as T;
  }
  return nodes;
}

async function load(id: string) {
  const [raw, seo, all, teachers, venue, cohortAgg] = await Promise.all([
    fetchRaw(id),
    getRetreatSeo(id),
    getPublicRetreats(),
    getEligibleTeachers(),
    getVenueEnrichment(id).catch(() => null),
    getCohortAgg(id),
  ]);
  // A backend outage is an error (5xx, retried by crawlers) — never a "not found".
  if (raw.status === 0 || raw.status >= 500) throw new Error(`retreat backend unavailable (${raw.status})`);
  if (raw.status === 404 || seo.status === 404) return null;
  if (!isPublicRetreatRecord(raw.data)) return null;
  const retreat = toPublicRetreat(raw.data);
  if (!retreat) return null;

  // PROMPT 27 — structured AI Retreat Intelligence grounded in the venue's live
  // Google reviews. Best-effort, cached ~24h; never blocks/breaks the page.
  // Google venue content shows only when the retreat's venue is eligible
  // (grandfathered or paid AI-assisted onboarding).
  const googleOk = venue ? await retreatGoogleAllowed(retreat).catch(() => false) : false;
  const venueWithAi = googleOk ? (venue as VenueEnrichment | null) : null;
  const retreatInsight = venueWithAi ? await getRetreatInsight(retreat, venueWithAi).catch(() => null) : null;

  const teacherLinkable = !!(retreat.guruHandle && teachers.has(retreat.guruHandle));
  const hostReviews = teacherLinkable && retreat.guruHandle
    ? await getHostReviews(retreat.guruHandle)
    : { items: [], avg: 0, count: 0 };

  return {
    r: retreat,
    // A retired (demo/test) host is never named — drop the backend's performer node.
    jsonld: retreat.guruName ? normalizeJsonLd(seo.jsonld) : stripPerformer(normalizeJsonLd(seo.jsonld)),
    related: relatedRetreats(retreat, all.retreats, 3),
    teacher: retreat.guruHandle ? teachers.get(retreat.guruHandle) || null : null,
    teacherLinkable,
    hostReviews,
    venue: venueWithAi,
    retreatInsight,
    cohortAgg,
  };
}

function Section({ title, children, id, collapsible }: { title: string; children: React.ReactNode; id?: string; collapsible?: boolean }) {
  if (collapsible) {
    return (
      <details id={id} open className="group scroll-mt-20 rounded-2xl border border-line bg-white/40 open:bg-transparent sm:rounded-none sm:border-0 sm:bg-transparent" data-testid="collapsible-section">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-0 sm:py-0 [&::-webkit-details-marker]:hidden">
          <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">{title}</h2>
          <span aria-hidden className="shrink-0 text-muted transition group-open:rotate-45 sm:hidden">+</span>
        </summary>
        <div className="px-4 pb-4 pt-2 sm:px-0 sm:pb-0 sm:pt-4">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function RetreatDetailPage({ params, searchParams }: Params) {
  const { city: cityParam, retreat: retreatParam } = await params;
  const id = retreatIdFromParam(retreatParam);
  if (!id) notFound();
  const sp = searchParams ? await searchParams : {};
  const cohort = typeof sp.cohort === 'string' ? sp.cohort.slice(0, 120) : undefined;
  const via = typeof sp.via === 'string' ? sp.via.slice(0, 80) : undefined;
  const data = await load(id);
  if (!data) notFound();
  const { r, jsonld, related, teacher, teacherLinkable, hostReviews, venue, retreatInsight, cohortAgg } = data;

  // Self-canonicalise: if the slug/city isn't the current canonical (title,
  // city or dates changed, or arriving via a bare-id / legacy link) → 301 to it.
  const canonicalCity = retreatCitySlug(r.city);
  const canonicalRetreat = retreatSlug(r);
  if (cityParam !== canonicalCity || retreatParam !== canonicalRetreat) {
    const qs = new URLSearchParams();
    if (cohort) qs.set('cohort', cohort);
    if (via) qs.set('via', via);
    const q = qs.toString();
    permanentRedirect(`${retreatPath(r)}${q ? `?${q}` : ''}`);
  }
  const venueVerified = await getVerifiedMatcher().then((m) => m({ venuePartnerId: r.venuePartnerId, name: r.venueName, city: r.city })).catch(() => false);
  // Clean public venue URL (resolve the real venue so the slug always matches;
  // fall back to the legacy id path if it can't be resolved).
  const venueForLink = r.venuePartnerId ? await getVenue(r.venuePartnerId).catch(() => null) : null;
  const venueHref = venueForLink ? venuePath(venueForLink) : r.venuePartnerId ? `/venues/${r.venuePartnerId}` : '';

  const location = [r.venueName, r.city, r.state].filter(Boolean).join(', ');
  const shortLoc = [r.city, r.state].filter(Boolean).join(', ');
  const soldOut = r.status === 'sold_out' || r.seatsRemaining === 0;
  const days = durationDays(r.startDate, r.endDate);
  const dateStr = fmtRange(r.startDate, r.endDate);

  const heroSrc = r.coverImage || r.images[0] || null;
  // PROMPT 26 — keep media sources distinct: teacher-provided vs Google (venue).
  const teacherImages = r.images;
  const googlePhotoUrls = (venue?.photos || []).map(
    (p) => `/bff/retreats/${r.id}/venue-photo?name=${encodeURIComponent(p.name)}&w=1200`,
  );
  const hasVenue = !!(venue && (venue.name || venue.address || venue.rating || venue.reviews.length));
  const teacherAvatar = teacher?.avatar_url || teacher?.photo_url || teacher?.image || null;
  const teacherStyles: string[] = Array.isArray(teacher?.styles) ? teacher.styles.filter(Boolean).slice(0, 4) : [];
  const teacherBio: string | undefined =
    (typeof teacher?.headline === 'string' && teacher.headline) ||
    (typeof teacher?.bio === 'string' && teacher.bio) ||
    undefined;
  const teacherLineage: string | undefined =
    (typeof teacher?.lineage === 'string' && teacher.lineage) ||
    (typeof teacher?.parampara === 'string' && teacher.parampara) ||
    (typeof teacher?.tradition === 'string' && teacher.tradition) ||
    undefined;
  const teacherExperience: string | undefined =
    (typeof teacher?.experience === 'string' && teacher.experience) ||
    (typeof teacher?.experience_years === 'number' && `${teacher.experience_years}+ years teaching`) ||
    (typeof teacher?.years_experience === 'number' && `${teacher.years_experience}+ years teaching`) ||
    undefined;
  // B4.7 — one public trust rule (ID check passed AND empanelled).
  const verifiedTeacher = publicTrust(teacher).verified;
  // B4.7 — the host's number never travels in page data; /bff/retreats/[id]/ask-whatsapp
  // resolves it server-side only when a visitor chooses to send a question.
  const hasTeacherWhatsapp = !!((typeof teacher?.whatsapp === 'string' && teacher.whatsapp) || (typeof teacher?.phone === 'string' && teacher.phone));
  const savedSnapshot = { id: r.id, title: r.title, city: r.city, state: r.state, startDate: r.startDate, endDate: r.endDate, priceInr: typeof r.priceInr === 'number' ? r.priceInr : undefined, coverImage: heroSrc, guruName: r.guruName, status: r.status, theme: r.theme, venuePartnerId: r.venuePartnerId };

  // PROMPT 10 & 11 — extract the structured itinerary and pricing that the wizard
  // wove into the free-text description, so we can render a timeline + breakdown
  // instead of a raw text blob.
  const content = parseRetreatContent(r.description);
  const introText = content.intro || r.description || '';
  // Prompt 3C (founder option B): the authoritative listed price only. Host-listed early-bird,
  // limited-time and cohort offers in the description are never shown or turned into a saving.
  const finalPrice = typeof r.priceInr === 'number' ? r.priceInr : undefined;

  // PROMPT 25 — Stay & Food: prefer the teacher's own words; else derive from
  // inclusions so older retreats still show something meaningful; else hide.
  const inclLower = r.inclusions.map((x) => x.toLowerCase());
  const stayFallback = r.inclusions.filter((_, i) => /accommod|stay|room|cottage|tent|dorm|lodging|night/.test(inclLower[i]));
  const foodFallback = r.inclusions.filter((_, i) => /meal|food|breakfast|lunch|dinner|sattvic|vegetarian|chai|tea|nourish/.test(inclLower[i]));
  const stayText = content.stay || (stayFallback.length ? stayFallback.join(' · ') : undefined);
  const foodText = content.food || (foodFallback.length ? foodFallback.join(' · ') : undefined);

  // PROMPT 27 — FACT block (verified data, built here — never by AI).
  const facts: string[] = [
    days ? `${days}-day retreat${dateStr ? ` · ${dateStr}` : ''}` : dateStr || '',
    location ? `Held at ${location}` : '',
    typeof finalPrice === 'number' ? `₹${inr(finalPrice)} per seat` : '',
    typeof r.seatsRemaining === 'number' ? (soldOut ? 'Currently sold out' : `${r.seatsRemaining} of ${r.seatsTotal} seats available`) : '',
    r.guruName ? `Taught by ${r.guruName}${r.hostType ? ` · ${titleCase(r.hostType.replace('teacher_', ''))}` : ''}` : '',
    typeof venue?.rating === 'number' ? `Venue rated ${venue.rating.toFixed(1)} on Google${venue.reviewCount ? ` (${venue.reviewCount} reviews)` : ''}` : '',
    content.minCohortInfo?.min ? `Runs with a minimum of ${content.minCohortInfo.min} confirmed participants` : '',
  ].filter(Boolean);

  // PROMPT 25 — FAQ built from verified facts only (no AI). Enriched so each
  // retreat can win its own search results: getting-there (route + venue
  // address), a price-specific refund breakdown, and a weather-informed packing
  // answer.
  const gettingThereParts: string[] = [];
  if (r.howToGetThere) gettingThereParts.push(r.howToGetThere.trim());
  else if (venue?.address) gettingThereParts.push(`The retreat is held at ${r.venueName ? `${r.venueName}, ` : ''}${venue.address}.`);
  else if (location) gettingThereParts.push(`The retreat is held at ${r.venueName ? `${r.venueName}, ` : ''}${location}.`);
  const gettingThereText = gettingThereParts.join(' ').trim();

  let refundAnswer = 'Full refund if you cancel 30 or more days before, 50% for 15–29 days, and no refund under 15 days. If the teacher or venue cancels, you receive a full refund.';
  if (typeof finalPrice === 'number' && finalPrice > 0) {
    const half = refundFor(20, finalPrice).refundInr;
    refundAnswer = `Cancel 30 or more days before the start date for a full refund (₹${inr(finalPrice)}); 15–29 days before for 50% (₹${inr(half)}); under 15 days, no refund. If the teacher or venue cancels, you receive a full 100% refund (₹${inr(finalPrice)}).`;
  }
  if (content.cancellation) refundAnswer += ` Host note: ${content.cancellation.trim()}`;

  const carryParts: string[] = [];
  if (r.whatToCarry.length) carryParts.push(r.whatToCarry.map(titleCase).join(', ') + '.');
  if (r.weatherNotes) {
    const w = r.weatherNotes.trim();
    carryParts.push(`Expected weather: ${w}${/[.!?]$/.test(w) ? '' : '.'} Pack accordingly.`);
  }
  const carryText = carryParts.join(' ').trim();

  const faqItems: { q: string; a: string }[] = [
    dateStr || location ? { q: 'When and where does this retreat take place?', a: `${dateStr || 'Dates to be confirmed'}${days ? ` (${days} days)` : ''}${location ? `, at ${location}.` : '.'}` } : { q: '', a: '' },
    typeof finalPrice === 'number' ? { q: 'How much does it cost and what does it include?', a: `₹${inr(finalPrice)} per seat.${r.inclusions.length ? ` Includes: ${r.inclusions.slice(0, 8).join(', ')}.` : ''}${content.taxNote ? ` Taxes: ${content.taxNote}` : ''}` } : { q: '', a: '' },
    { q: 'What is the cancellation & refund policy?', a: refundAnswer },
    gettingThereText ? { q: 'How do I get there?', a: gettingThereText } : { q: '', a: '' },
    carryText ? { q: 'What should I bring?', a: carryText } : { q: '', a: '' },
    r.guruName ? { q: 'Who is teaching this retreat?', a: `${r.guruName}${r.hostType ? `, a ${titleCase(r.hostType.replace('teacher_', ''))} on NOSTOPS` : ''}${teacherLinkable ? '. See their full profile linked above.' : '.'}` } : { q: '', a: '' },
  ].filter((x) => x.q && x.a);

  // PROMPT 32 — complementary structured data (Course/Person/LodgingBusiness/FAQPage
  // + Review/AggregateRating) layered on top of the backend's EducationEvent + breadcrumb.
  const extraJsonLd = normalizeJsonLd(
    buildRetreatJsonLd({
      id: r.id,
      title: r.title,
      description: introText || undefined,
      startDate: r.startDate,
      endDate: r.endDate,
      finalPriceInr: typeof finalPrice === 'number' ? finalPrice : undefined,
      soldOut,
      city: r.city,
      state: r.state,
      venueName: r.venueName,
      guruName: r.guruName,
      guruHandle: teacherLinkable ? r.guruHandle : undefined,
      hostType: r.hostType,
      faqItems,
      hostReviews,
      venue: venue ? { name: venue.name, address: venue.address, rating: venue.rating, reviewCount: venue.reviewCount, mapsUri: venue.mapsUri, reviews: venue.reviews } : null,
    }),
  );

  return (
    <main className="pb-24 md:pb-0">
      {jsonld.length > 0 && <JsonLd data={jsonld} />}
      {extraJsonLd.length > 0 && <JsonLd data={extraJsonLd} />}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/retreats" className="hover:text-brand-700">Retreats</Link>
          {r.city && (<><span aria-hidden>/</span><Link href={`/retreats/in/${citySlug(r.city)}`} className="hover:text-brand-700">{r.city}</Link></>)}
          <span aria-hidden>/</span>
          <span className="line-clamp-1 max-w-[16rem] font-semibold text-ink-soft">{r.title}</span>
        </div>
      </nav>

      {/* Immersive hero — unified public-marketing gradient (photo under overlay) */}
      <PageHero imageSrc={heroSrc}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
              {r.theme ? titleCase(r.theme) : 'Retreat'}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${soldOut ? 'bg-white/20 text-white' : 'bg-accent text-white'}`}>
              {statusLabel(r.status)}
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[1.1] tracking-tight text-white md:text-5xl">{r.title}</h1>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/85">
            {dateStr && (
              <span className="flex items-center gap-2"><span aria-hidden>🗓️</span>{dateStr}{days ? ` · ${days} days` : ''}</span>
            )}
            {shortLoc && <span className="flex items-center gap-2"><span aria-hidden>📍</span>{shortLoc}</span>}
            {r.guruName && (
              <span className="flex items-center gap-2">
                <span aria-hidden>🧘</span>
                {teacherLinkable ? (
                  <Link href={`/teachers/${r.guruHandle}`} className="font-semibold underline decoration-white/40 hover:decoration-white">{r.guruName}</Link>
                ) : r.guruName}
              </span>
            )}
            {typeof venue?.rating === 'number' && (
              <span className="flex items-center gap-2"><span aria-hidden className="text-amber-400">★</span>{venue.rating.toFixed(1)}{venue.reviewCount ? ` · ${venue.reviewCount} Google reviews` : ''}</span>
            )}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            {soldOut ? (
              <span className="rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white">Sold out — join the waitlist below</span>
            ) : (
              <RetreatReserveCta retreatId={r.id} cohort={cohort} via={via} label="Reserve your seat →" className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-accent-600" />
            )}
            <AskTeacher retreatId={r.id} retreatTitle={r.title} teacherName={r.guruName} hasTeacherWhatsapp={hasTeacherWhatsapp} variant="dark" label="Ask the teacher" />
            {!soldOut && <BringYourGroupCta retreatId={r.id} variant="hero" />}
            <SaveRetreatButton retreat={savedSnapshot} variant="button" className="border-white/30 !bg-white/10 !text-white hover:!border-white/60" />
            <ShareButtons path={retreatPath(r)} title={r.title} message={`${r.title}${shortLoc ? ` · ${shortLoc}` : ''}${dateStr ? ` · ${dateStr}` : ''} — a yoga retreat on NOSTOPS`} tone="dark" />
          </div>
      </PageHero>

      {cohort && (
        <div className="border-b border-brand/15 bg-brand-50/60" data-testid="cohort-invite-banner">
          <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
            <span aria-hidden className="text-lg">🧘</span>
            <span className="font-black text-ink">You&apos;re invited to the “{cohort}” cohort{via ? ` by ${via}` : ''}.</span>
            <span className="text-ink-soft">Reserve below to join this group for this retreat — your NOSTOPS account stays independent.</span>
          </div>
        </div>
      )}

      <div className="container-x grid gap-10 py-12 md:grid-cols-3">
        {/* Main column */}
        <div className="space-y-12 md:col-span-2">
          {/* PROMPT 26 — teacher-provided media, kept separate from venue/Google media */}
          {teacherImages.length > 0 && (
            <RetreatGallery images={teacherImages} title={r.title} attribution="Photos by the teacher" />
          )}

          {/* 1 — WHY THIS RETREAT? (teacher's story) */}
          {introText && (
            <Section title="Why this retreat?">
              <p className="whitespace-pre-line text-lg leading-relaxed text-ink-soft">{introText}</p>
            </Section>
          )}

          {/* 2 — YOUR TEACHER (profile, lineage, experience, philosophy) */}
          {r.guruName && (
            <Section title="Your teacher">
              <div className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5">
                {teacherAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={teacherAvatar} alt={r.guruName} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand/10 text-2xl font-black text-brand-700">{r.guruName.charAt(0)}</span>
                )}
                <div className="min-w-0">
                  <p className="text-lg font-black tracking-tight text-ink">{r.guruName}</p>
                  {r.hostType && <p className="text-sm font-semibold text-brand-700">{titleCase(r.hostType.replace('teacher_', ''))}</p>}
                  {(teacherLineage || teacherExperience) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-soft">
                      {teacherLineage && <span>🪔 Lineage: {teacherLineage}</span>}
                      {teacherExperience && <span>⏳ {teacherExperience}</span>}
                    </div>
                  )}
                  {teacherBio && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{teacherBio}</p>}
                  {teacherStyles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {teacherStyles.map((s) => <span key={s} className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium capitalize text-ink-soft">{s}</span>)}
                    </div>
                  )}
                  {teacherLinkable && (
                    <Link href={`/teachers/${r.guruHandle}`} className="mt-3 inline-block text-sm font-bold text-brand-700 hover:underline">View teacher profile →</Link>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm italic text-muted">A teacher is a custodian of a living tradition — this retreat is an invitation into that lineage.</p>
            </Section>
          )}

          {/* 3 — YOGA SE KYA HOGA? (teacher-authored signature; hidden if absent) */}
          <YogaSeKyaHoga text={content.yogaSeKyaHoga || ''} teacherName={r.guruName} teacherHandle={teacherLinkable ? r.guruHandle : null} />

          {/* 4 — WHAT I HOPE YOU CARRY HOME */}
          {content.carryHome && (
            <Section title="What I hope you carry home">
              <p className="whitespace-pre-line text-lg leading-relaxed text-ink-soft">{content.carryHome}</p>
            </Section>
          )}

          {/* 5 — YOUR RETREAT HOME (teacher-selected venue) */}
          {(r.venueName || location) && (
            <Section title="Your retreat home">
              <div className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-black tracking-tight text-ink">{r.venueName || location}</p>
                  {venueVerified && <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white" data-testid="retreat-venue-verified">🛡️ NOSTOPS Verified</span>}
                </div>
                {location && r.venueName && <p className="mt-0.5 text-ink-soft">{[r.city, r.state].filter(Boolean).join(', ')}</p>}
                <p className="mt-2 text-sm text-ink-soft">Chosen by {r.guruName || 'your teacher'} as the home for this retreat.</p>
                {r.venuePartnerId && venueHref && (
                  <Link href={venueHref} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline" data-testid="venue-profile-link">Explore this venue — photos, facilities & reviews →</Link>
                )}
              </div>
            </Section>
          )}

          {/* 6 — WHY I CHOSE THIS PLACE (teacher's voice) */}
          {r.venueDescription && (
            <Section title="Why I chose this place">
              <figure className="relative overflow-hidden rounded-3xl border border-accent/25 bg-accent/5 p-6 sm:p-8" data-testid="why-this-place">
                <span aria-hidden className="absolute left-5 top-3 text-5xl font-black text-accent/25">“</span>
                <blockquote className="relative whitespace-pre-line pl-6 text-lg leading-relaxed text-ink-soft">{r.venueDescription}</blockquote>
                <figcaption className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-sm">
                  {r.guruName && (
                    <span className="font-black text-ink">
                      — {teacherLinkable ? (
                        <Link href={`/teachers/${r.guruHandle}`} className="hover:underline">{r.guruName}</Link>
                      ) : r.guruName}
                    </span>
                  )}
                  {(r.venueName || shortLoc) && (
                    <span className="text-muted">on {[r.venueName, shortLoc].filter(Boolean).join(', ')}</span>
                  )}
                </figcaption>
              </figure>
            </Section>
          )}

          {/* 7 — YOUR EXPERIENCE (itinerary) */}
          {content.itinerary.length > 0 && (
            <Section title="Your experience, day by day" id="itinerary" collapsible>
              <RetreatItineraryTimeline items={content.itinerary} startDate={r.startDate} />
            </Section>
          )}

          {/* 8 — STAY */}
          {stayText && (
            <Section title="Stay" collapsible>
              <p className="whitespace-pre-line leading-relaxed text-ink-soft" data-testid="stay-section">{stayText}</p>
            </Section>
          )}

          {/* 9 — FOOD */}
          {foodText && (
            <Section title="Food" collapsible>
              <p className="whitespace-pre-line leading-relaxed text-ink-soft" data-testid="food-section">{foodText}</p>
            </Section>
          )}

          {/* 10 — VENUE (facilities & environment, via Google) + venue media */}
          {(hasVenue || googlePhotoUrls.length > 0) && (
            <Section title="The venue" collapsible>
              {hasVenue && venue && (
                <div className="rounded-2xl border border-line bg-white p-5">
                  {venue.name && <p className="text-lg font-black tracking-tight text-ink">{venue.name}</p>}
                  {venue.address && <p className="mt-1 text-ink-soft">{venue.address}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    {typeof venue.rating === 'number' && (
                      <span className="font-semibold text-ink"><span aria-hidden className="text-amber-500">★</span> {venue.rating.toFixed(1)}{venue.reviewCount ? ` (${venue.reviewCount})` : ''}</span>
                    )}
                    {venue.mapsUri && <a href={venue.mapsUri} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-brand-700 hover:underline">View on Google Maps ↗</a>}
                    {venue.websiteUri && <a href={venue.websiteUri} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-brand-700 hover:underline">Website ↗</a>}
                    {venue.phone && <a href={`tel:${venue.phone}`} className="font-semibold text-ink-soft hover:text-ink">{venue.phone}</a>}
                  </div>
                  <p className="mt-3 text-[11px] text-muted">Venue information provided by Google.</p>
                </div>
              )}
              {googlePhotoUrls.length > 0 && (
                <div className="mt-5">
                  <RetreatGallery images={googlePhotoUrls} title={`${r.venueName || 'Venue'} photos`} attribution="Venue photos · via Google" />
                </div>
              )}
            </Section>
          )}

          {/* 11 — TRUST (Google reviews · NOSTOPS reviews · verified signals) */}
          <TrustSection
            googleRating={venue?.rating}
            googleReviewCount={venue?.reviewCount}
            googleReviews={venue?.reviews || []}
            mapsUri={venue?.mapsUri}
            hostReviews={hostReviews}
            teacherName={r.guruName}
            verifiedTeacher={verifiedTeacher}
          />

          {/* 12 — WHAT'S INCLUDED (+ what you'll pay) */}
          {(r.inclusions.length > 0 || typeof r.priceInr === 'number') && (
            <Section title="What's included" id="pricing">
              {r.inclusions.length > 0 && (
                <ul className="grid list-none gap-2 p-0 sm:grid-cols-2" data-testid="whats-included">
                  {r.inclusions.map((x) => (
                    <li key={x} className="flex items-start gap-2 text-sm text-ink-soft"><span aria-hidden className="text-emerald-600">✓</span><span className="capitalize">{x}</span></li>
                  ))}
                </ul>
              )}
              {typeof r.priceInr === 'number' && (
                <div className="mt-5">
                  <RetreatPriceBreakdown
                    priceInr={r.priceInr}
                    taxNote={content.taxNote}
                    inclusions={[]}
                    notIncluded={[]}
                  />
                </div>
              )}
              {(content.minCohortInfo?.min || (cohortAgg && cohortAgg.confirmedCount > 0)) && (
                <div className="mt-5">
                  <MinimumCohort variant="public" confirmedCount={cohortAgg?.confirmedCount ?? 0} seatsTotal={cohortAgg?.seatsTotal ?? 0} info={content.minCohortInfo} />
                </div>
              )}
            </Section>
          )}

          {/* 13 — WHAT'S NOT INCLUDED */}
          {content.notIncluded.length > 0 && (
            <Section title="What's not included">
              <ul className="grid list-none gap-2 p-0 sm:grid-cols-2" data-testid="whats-not-included">
                {content.notIncluded.map((x) => (
                  <li key={x} className="flex items-start gap-2 text-sm text-ink-soft"><span aria-hidden className="text-red-400">✕</span><span className="capitalize">{x}</span></li>
                ))}
              </ul>
            </Section>
          )}

          {/* 14 — GETTING THERE (+ practical notes) */}
          {(r.howToGetThere || r.weatherNotes || r.whatToCarry.length > 0) && (
            <Section title="Getting there" collapsible>
              <div className="grid gap-6 sm:grid-cols-2">
                {r.howToGetThere && (
                  <div><h3 className="text-sm font-black uppercase tracking-wide text-muted">How to reach</h3><p className="mt-2 whitespace-pre-line text-ink-soft">{r.howToGetThere}</p></div>
                )}
                {r.weatherNotes && (
                  <div><h3 className="text-sm font-black uppercase tracking-wide text-muted">Weather</h3><p className="mt-2 whitespace-pre-line text-ink-soft">{r.weatherNotes}</p></div>
                )}
                {r.whatToCarry.length > 0 && (
                  <div><h3 className="text-sm font-black uppercase tracking-wide text-muted">What to carry</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{r.whatToCarry.map((x) => <li key={x} className="capitalize">{x}</li>)}</ul></div>
                )}

              </div>
            </Section>
          )}

          {/* 15 — IS THIS RETREAT RIGHT FOR YOU? */}
          <RightForYou audienceTags={r.audienceTags} whoEnjoys={retreatInsight?.whoEnjoys} />

          {/* 16 — AI RETREAT INSIGHT (FACT / REVIEW SIGNAL / AI INTERPRETATION) */}
          <AiRetreatInsight facts={facts} insight={retreatInsight} />

          {/* 17 — CANCELLATION */}
          <Section title="Cancellation" collapsible>
            <CancellationPolicy startDate={r.startDate} pricePaidInr={finalPrice} hostNote={content.cancellation} />
          </Section>

          {/* 18 — FAQ */}
          <RetreatFaq items={faqItems} />
        </div>

        {/* Sticky sidebar */}
        <aside className="md:col-span-1">
          <div className="space-y-6 md:sticky md:top-6">
            <div className="card p-6">
              {typeof r.priceInr === 'number' ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-ink">₹{inr(r.priceInr)}</span>
                    <span className="text-sm text-muted">/ seat</span>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-black text-brand-700">Enquire for pricing</p>
              )}
              <dl className="mt-4 space-y-2 text-sm">
                {dateStr && (<div className="flex justify-between gap-3"><dt className="text-muted">Dates</dt><dd className="text-right font-semibold text-ink">{dateStr}</dd></div>)}
                {days && (<div className="flex justify-between"><dt className="text-muted">Duration</dt><dd className="font-semibold text-ink">{days} days</dd></div>)}
                {location && (<div className="flex justify-between gap-3"><dt className="text-muted">Venue</dt><dd className="text-right font-semibold text-ink">{location}</dd></div>)}
                {r.tier && (<div className="flex justify-between"><dt className="text-muted">Tier</dt><dd className="font-semibold capitalize text-ink">{r.tier}</dd></div>)}
                {typeof r.seatsTotal === 'number' && (<div className="flex justify-between"><dt className="text-muted">Capacity</dt><dd className="font-semibold text-ink">{r.seatsTotal} seats</dd></div>)}
                {typeof r.seatsRemaining === 'number' && (
                  <div className="flex justify-between"><dt className="text-muted">Availability</dt><dd className={`font-semibold ${soldOut ? 'text-ink-soft' : 'text-brand-700'}`}>{soldOut ? 'Sold out' : `${r.seatsRemaining} seats left`}</dd></div>
                )}
              </dl>

              <SeatProgress seatsTotal={r.seatsTotal} seatsRemaining={r.seatsRemaining} className="mt-4" />

              <div className="mt-5">
                {soldOut ? (
                  <div id="waitlist" className="scroll-mt-20">
                    <p className="mb-3 text-sm font-bold text-ink">Join the waitlist</p>
                    <EnquiryForm retreatId={r.id} />
                  </div>
                ) : (
                  <RetreatReserveCta retreatId={r.id} cohort={cohort} via={via} label="Reserve your seat" className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-accent-600" />
                )}
              </div>
              <AskTeacher retreatId={r.id} retreatTitle={r.title} teacherName={r.guruName} hasTeacherWhatsapp={hasTeacherWhatsapp} variant="ghost" label="Ask the teacher" className="mt-3 w-full" />
              {!soldOut && <BringYourGroupCta retreatId={r.id} variant="sidebar" className="mt-3" />}
              <div className="mt-3 flex gap-3">
                <SaveRetreatButton retreat={savedSnapshot} variant="button" className="flex-1" />
                <CopyLinkButton path={retreatPath(r)} label="Share" className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-center text-sm font-bold text-ink-soft transition hover:border-accent hover:text-accent-600" />
              </div>
            </div>

            <Link href="/retreats" className="block text-center text-sm font-bold text-brand-700 hover:underline">← All retreats</Link>
          </div>
        </aside>
      </div>

      {/* 19 — OTHER RETREATS */}
      {related.length > 0 && (
        <section className="border-t border-line bg-cream">
          <div className="container-x py-14">
            <h2 className="text-2xl font-black tracking-tight text-ink">Other retreats</h2>
            <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rel: PublicRetreat) => (
                <li key={rel.id}><RetreatCard r={rel} /></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 20 — FINAL CTA (Reserve Your Place · Ask the Teacher) */}
      <section className="border-t border-line bg-ink" data-testid="final-cta">
        <div className="container-x py-14 text-center">
          <h2 className="mx-auto max-w-2xl text-2xl font-black tracking-tight text-white sm:text-3xl">
            {soldOut ? 'This retreat is sold out — join the waitlist' : 'Ready to reserve your place?'}
          </h2>
          {r.guruName && <p className="mt-2 text-white/70">Step onto the mat with {r.guruName}{shortLoc ? ` in ${shortLoc}` : ''}.</p>}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!soldOut && (
              <RetreatReserveCta retreatId={r.id} cohort={cohort} via={via} label="Reserve your place →" className="rounded-xl bg-accent px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-accent-600" />
            )}
            <AskTeacher retreatId={r.id} retreatTitle={r.title} teacherName={r.guruName} hasTeacherWhatsapp={hasTeacherWhatsapp} variant="dark" label="Ask the teacher" />
          </div>
          <p className="mt-4 text-xs text-white/50">Questions? Reach the teacher via their profile, or reserve now — your seat is only held once you confirm.</p>
        </div>
      </section>

      {/* PROMPT 31 — mobile sticky bar: always-visible price/date/availability + Reserve + Ask */}
      <div className="fixed inset-x-0 bottom-0 z-[61] border-t border-line bg-white px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden" data-testid="mobile-sticky-bar">
        <div className="flex items-center justify-between gap-2 pb-1 text-[11px] text-muted">
          <span className="truncate">
            {typeof r.priceInr === 'number' && <span className="font-black text-ink">₹{inr(r.priceInr)}</span>}
            {dateStr && <span> · {dateStr}</span>}
          </span>
          <span className={`shrink-0 font-bold ${soldOut ? 'text-ink-soft' : r.seatsRemaining <= 3 ? 'text-accent-600' : 'text-emerald-700'}`}>
            {soldOut ? 'Sold out' : `${r.seatsRemaining} seat${r.seatsRemaining === 1 ? '' : 's'} left`}
          </span>
        </div>
        <div className="flex items-center gap-2 pb-2">
          {soldOut ? (
            <a href="#waitlist" className="flex-1 rounded-xl bg-ink px-4 py-3 text-center text-sm font-bold text-white">Join the waitlist</a>
          ) : (
            <RetreatReserveCta retreatId={r.id} cohort={cohort} via={via} label="Reserve" className="flex-1 rounded-xl bg-accent px-4 py-3 text-center text-sm font-bold text-white" />
          )}
          <AskTeacher retreatId={r.id} retreatTitle={r.title} teacherName={r.guruName} hasTeacherWhatsapp={hasTeacherWhatsapp} variant="ghost" label="Ask" className="shrink-0" />
          <SaveRetreatButton retreat={savedSnapshot} className="shrink-0" />
        </div>
      </div>
    </main>
  );
}
