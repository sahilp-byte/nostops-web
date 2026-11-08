import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { metaToMetadata, normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { inr, initials, titleCase } from '@/lib/format';
import RetreatCard from '@/components/retreats/RetreatCard';
import { getPublicRetreats, type PublicRetreat } from '@/lib/server/retreats';
import { getCities, citySlug } from '@/lib/server/cities';
import { matchCatalogSlug } from '@/lib/paramparas-catalog';
import PublicProfileOwnerEditor from '@/components/app/teacher/PublicProfileOwnerEditor';
import { isTeacherActivePublic, publicTrust } from '@/lib/public-teacher';
import ShareProfileButton from '@/components/teachers/ShareProfileButton';
import MeetTeacherOwnerCta from '@/components/teachers/MeetTeacherOwnerCta';
import { getReviews, type Review, type ReviewStats, type ReviewsData } from '@/lib/server/reviews';
import TeacherYogaTradition from '@/components/teachers/TeacherYogaTradition';
import { getArticlesByTeacher, type TeacherArticle } from '@/lib/server/voices';
import { langLabel } from '@/lib/voices-shared';
import { getStatusOverride, applyOverrideToRaw } from '@/lib/server/teacher-status-override';
import TrustStrip from '@/components/teachers/TrustStrip';

// Public SEO content -> ISR. Short revalidate so profile edits (name, photo,
// experience, expertise) and publish/unpublish reflect automatically.
export const revalidate = 60;

type Params = { params: Promise<{ handle: string }> };

const DIMENSION_META: Record<string, { label: string; emoji: string }> = {
  body: { label: 'Yoga for the Body', emoji: '💪' },
  mind: { label: 'Yoga for the Mind', emoji: '🧠' },
  special_needs: { label: 'Yoga for Special Needs', emoji: '❤️' },
};

// ---------------------------------------------------------------------------
// Low-level fetch that distinguishes 404 (missing) from transient errors.
// ---------------------------------------------------------------------------
async function fetchJson<T = any>(path: string): Promise<{ data: T | null; status: number }> {
  try {
    const data = await apiGet<T>(path, { revalidate: 3600 });
    return { data, status: 200 };
  } catch (e) {
    const m = /Backend (\d+)/.exec((e as Error)?.message || '');
    return { data: null, status: m ? Number(m[1]) : 0 };
  }
}

// PUBLIC visibility policy (Hybrid): any teacher with a PUBLISHED public profile
// — active, visible and not suspended — has a live page. Empanelment/verification
// are shown as badges, not visibility gates. Centralized in lib/public-teacher so
// the directory and the profile page can never disagree (a listed card never 404s).
function publiclyVisible(t: any): boolean {
  return isTeacherActivePublic(t);
}

// Backend-authoritative set of publicly listable handles (directory has the
// real active/suspended flags AND the verified/empanelled state).
async function getEligibleHandles(): Promise<Set<string>> {
  try {
    const data = await apiGet<{ teachers?: any[] }>('/teachers/directory?limit=1000', { revalidate: 60 });
    const raw = Array.isArray(data?.teachers) ? data.teachers : [];
    return new Set(raw.filter(publiclyVisible).map((t) => String(t.handle)));
  } catch {
    return new Set();
  }
}

// Canonical parampara slugs (hyphenated). Teacher `parampara` values sometimes
// use underscores and are NOT valid slugs -> we only link when it matches.
async function getParamparaSlugs(): Promise<Set<string>> {
  try {
    const data = await apiGet<{ paramparas?: any[] }>('/seo/paramparas', { revalidate: 86400 });
    const items = Array.isArray(data?.paramparas) ? data.paramparas : [];
    return new Set(items.map((p) => String(p.slug)).filter(Boolean));
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Public-safe profile projection. Private/admin fields are intentionally
// dropped (email, phone, whatsapp, payout_*, kyc_*, bank_*, user_id, geo, ...).
// ---------------------------------------------------------------------------
type ParamparaRef = { value: string; label: string; slug: string | null };
type TeacherStats = { batchesTaught: number; studentsReached: number; avgNps: number; retentionPct: number };
type EmpanelmentCert = { certId?: string; issuedAt?: string; reviewerName?: string; coSignerName?: string };

type PublicProfile = {
  handle: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  bio?: string;
  experienceYears?: number;
  tier?: string;
  isEmpanelled: boolean;
  isVerified: boolean;
  idChecked: boolean;
  rating?: number;
  reviewsCount?: number;
  styles: string[];
  specializations: string[];
  languages: string[];
  badges: string[];
  yogaDimensions: string[];
  avatarUrl?: string | null;
  avatarB64?: string | null;
  videoUrl?: string | null;
  rootGuruName?: string;
  rootGuruLocation?: string;
  lineageDeclaration?: string;
  lineagePath: string[];
  paramparas: ParamparaRef[];
  stats: TeacherStats | null;
  empanelmentCert: EmpanelmentCert | null;
  social: { instagram?: string; youtube?: string; linkedin?: string; website?: string };
  premium?: { rateInr?: number; durationMin?: number; description?: string } | null;
  offers: { online: boolean; corporate: boolean; group: boolean; privateSession: boolean };
};

function normalizeSocialUrl(kind: string, v?: string): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  switch (kind) {
    case 'instagram':
      return `https://instagram.com/${s.replace(/^@/, '')}`;
    case 'youtube':
      return `https://youtube.com/${s.replace(/^@/, '')}`;
    case 'linkedin':
      return s.includes('/') ? `https://${s}` : `https://linkedin.com/in/${s}`;
    case 'website':
      return `https://${s}`;
    default:
      return `https://${s}`;
  }
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || url.includes('/video/upload/');
}

function toPublicProfile(t: any, slugSet: Set<string>): PublicProfile {
  const specsFull = Array.isArray(t.specializations_full) ? t.specializations_full : [];
  const specializations = specsFull.length
    ? specsFull.map((s: any) => s?.name).filter(Boolean)
    : (Array.isArray(t.specializations) ? t.specializations.map((s: string) => titleCase(s)) : []);

  const primary = String(t.parampara || '');
  const paramList: string[] = Array.isArray(t.paramparas) && t.paramparas.length
    ? t.paramparas.map((p: any) => String(p)).filter(Boolean)
    : (primary ? [primary] : []);
  const seen = new Set<string>();
  const paramparas: ParamparaRef[] = paramList
    .filter((v) => (seen.has(v) ? false : (seen.add(v), true)))
    .map((v) => ({ value: v, label: titleCase(v), slug: slugSet.has(v) ? v : matchCatalogSlug(v) }));

  const rawStats = t.stats || null;
  const stats: TeacherStats | null = rawStats
    ? {
        batchesTaught: Number(rawStats.batches_taught) || 0,
        studentsReached: Number(rawStats.students_reached) || 0,
        avgNps: Number(rawStats.avg_nps) || 0,
        retentionPct: Number(rawStats.retention_pct) || 0,
      }
    : null;
  const hasStats = !!stats && (stats.batchesTaught > 0 || stats.studentsReached > 0 || stats.avgNps > 0 || stats.retentionPct > 0);

  const cert = t.empanelment_cert && typeof t.empanelment_cert === 'object' ? t.empanelment_cert : null;
  const ps = t.premium_session;
  const sm = t.social_media || {};

  const videoUrl =
    (typeof t.sample_video_url === 'string' && t.sample_video_url.trim() ? t.sample_video_url.trim() : null) ||
    (t.video_intro && t.video_intro.status === 'approved' && t.video_intro.secure_url ? String(t.video_intro.secure_url) : null);

  return {
    handle: String(t.handle),
    name: t.name || 'NOSTOPS Teacher',
    city: t.city || undefined,
    state: t.state || undefined,
    country: t.country || undefined,
    bio: typeof t.bio === 'string' && t.bio.trim() ? t.bio.trim() : undefined,
    experienceYears: typeof t.experience_years === 'number' && t.experience_years > 0 ? t.experience_years : undefined,
    tier: t.tier || undefined,
    isEmpanelled: !!t.is_empanelled,
    // B4.7 — one public trust rule: "Verified" = ID check passed AND empanelled
    // (owner decision). Each status is otherwise shown on its own.
    isVerified: publicTrust(t).verified,
    idChecked: publicTrust(t).idChecked,
    rating: typeof t.rating === 'number' && t.rating > 0 ? t.rating : undefined,
    reviewsCount: typeof t.reviews_count === 'number' && t.reviews_count > 0 ? t.reviews_count : undefined,
    styles: Array.isArray(t.styles) ? t.styles.filter(Boolean) : [],
    specializations,
    languages: Array.isArray(t.languages_spoken)
      ? t.languages_spoken.filter(Boolean)
      : (Array.isArray(t.languages) ? t.languages.filter(Boolean) : []),
    badges: Array.isArray(t.badges) ? t.badges.filter(Boolean) : [],
    yogaDimensions: Array.isArray(t.yoga_dimensions) ? t.yoga_dimensions.filter(Boolean) : [],
    avatarUrl: typeof t.avatar_url === 'string' && t.avatar_url ? t.avatar_url : null,
    avatarB64: typeof t.avatar_base64 === 'string' && t.avatar_base64 ? t.avatar_base64 : null,
    videoUrl,
    rootGuruName: t.root_guru_name || undefined,
    rootGuruLocation: t.root_guru_location || undefined,
    lineageDeclaration: typeof t.lineage_declaration === 'string' && t.lineage_declaration.trim() ? t.lineage_declaration.trim() : undefined,
    lineagePath: Array.isArray(t.lineage_path) ? t.lineage_path.filter((x: any) => typeof x === 'string' && x.trim()) : [],
    paramparas,
    stats: hasStats ? stats : null,
    empanelmentCert: cert
      ? {
          certId: cert.cert_id || undefined,
          issuedAt: cert.issued_at || undefined,
          reviewerName: cert.reviewer_name || undefined,
          coSignerName: cert.co_signer_name || undefined,
        }
      : null,
    social: {
      instagram: normalizeSocialUrl('instagram', sm.instagram) || undefined,
      youtube: normalizeSocialUrl('youtube', sm.youtube) || undefined,
      linkedin: normalizeSocialUrl('linkedin', sm.linkedin) || undefined,
      website: normalizeSocialUrl('website', sm.website) || undefined,
    },
    premium: ps && ps.enabled ? { rateInr: ps.rate_inr, durationMin: ps.duration_minutes || ps.duration_min, description: ps.description } : null,
    offers: {
      online: !!t.offers_online,
      corporate: !!t.offers_corporate,
      group: !!t.offers_group_classes,
      privateSession: !!t.offers_private_sessions,
    },
  };
}

type LoadedTeacher = {
  profile: PublicProfile;
  jsonld: any[];
  paramparaLabel?: string;
  paramparaFounder?: string;
  paramparaWords?: string;
  retreats: PublicRetreat[];
  cityLink: { slug: string; label: string } | null;
  reviews: ReviewsData;
  voices: TeacherArticle[];
};

async function loadTeacher(handle: string): Promise<LoadedTeacher | null> {
  const [seo, pub, eligibleSet, slugSet, retreatsAll, cities, reviews, voices] = await Promise.all([
    fetchJson<{ meta?: Record<string, string>; jsonld?: any[] }>(`/seo/teacher/${handle}`),
    fetchJson<{ teacher?: any }>(`/teachers/public/${handle}`),
    getEligibleHandles(),
    getParamparaSlugs(),
    getPublicRetreats(),
    getCities(),
    getReviews(handle, { revalidate: 3600 }),
    getArticlesByTeacher(handle),
  ]);

  // Genuinely missing -> 404.
  if (seo.status === 404 || pub.status === 404) return null;
  const raw = pub.data?.teacher;
  if (!raw) return null;

  // Must have a PUBLISHED public profile (active + visible + not suspended) ->
  // otherwise 404. Empanelment is a badge, not a visibility gate.
  if (!eligibleSet.has(handle)) return null;
  if (!isTeacherActivePublic(raw)) return null;

  // Merge the NOSTOPS admin Verification/Level override onto the raw record so
  // the public profile shows the badge/level the admin set.
  const rawMerged = applyOverrideToRaw(raw, await getStatusOverride(String(raw.teacher_id || '')));

  const pf = rawMerged.parampara_full || {};
  const profile = toPublicProfile(rawMerged, slugSet);

  const slug = profile.city ? citySlug(profile.city) : '';
  const cityRef = slug ? cities.find((c) => c.slug === slug) : undefined;

  return {
    profile,
    jsonld: normalizeJsonLd(Array.isArray(seo.data?.jsonld) ? (seo.data!.jsonld as any[]) : []),
    paramparaLabel: pf.name || (profile.paramparas[0]?.label || undefined),
    paramparaFounder: pf.founder || undefined,
    paramparaWords: pf.lineage_words || undefined,
    retreats: retreatsAll.retreats.filter((rt) => rt.guruHandle === handle),
    cityLink: cityRef ? { slug: cityRef.slug, label: cityRef.label } : null,
    reviews,
    voices,
  };
}

// ---------------------------------------------------------------------------
// generateStaticParams — bounded public set. ISR fills the rest.
// ---------------------------------------------------------------------------
export async function generateStaticParams() {
  try {
    const data = await apiGet<{ teachers?: any[] }>('/teachers/directory?limit=1000', { revalidate: 3600 });
    const raw = Array.isArray(data?.teachers) ? data.teachers : [];
    return raw.filter(publiclyVisible).map((t) => ({ handle: String(t.handle) }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Metadata — teacher-specific; canonical ALWAYS www via lib/site.
// ---------------------------------------------------------------------------
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  // Hidden / unpublished profiles 404 — their metadata must not name the teacher either.
  if (!(await getEligibleHandles()).has(handle)) {
    return { title: 'Teacher not found', robots: { index: false, follow: false } };
  }
  const url = canonical(`/teachers/${handle}`);
  const seo = await fetchJson<{ meta?: Record<string, string> }>(`/seo/teacher/${handle}`);
  const mapped = metaToMetadata(seo.data?.meta ?? {});

  const title = mapped.title ?? { absolute: 'Yoga Teacher · NOSTOPS' };
  const description = mapped.description ?? 'A verified, empanelled NOSTOPS yoga teacher carrying forward a living tradition.';
  // Drop any backend-provided og/twitter IMAGE (some teachers carry a base64
  // data-URI which social scrapers cannot fetch). Our file-based
  // opengraph-image / twitter-image routes then supply a real https, per-teacher
  // image for EVERY teacher (drawing their actual photo when they have one).
  const { images: _ogImg, ...og } = (mapped.openGraph ?? {}) as Record<string, any>;
  const { images: _twImg, ...tw } = (mapped.twitter ?? {}) as Record<string, any>;
  const ogTitle = og.title ?? (typeof title === 'object' ? (title as any).absolute : title);
  const ogDesc = og.description ?? description;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...og,
      type: og.type ?? 'profile',
      siteName: og.siteName ?? 'NOSTOPS',
      url,
      title: ogTitle,
      description: ogDesc,
    },
    twitter: {
      ...tw,
      // We now generate a rich 1200x630 per-teacher card (twitter-image.tsx),
      // so use the large-image card. twitter:image is wired by the file route.
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
    },
  };
}

function Avatar({ name, url, b64 }: { name: string; url?: string | null; b64?: string | null }) {
  const src = url ? url : b64 ? (b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`) : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar URL / data URI, no next/image loader
      <img
        src={src}
        alt={`${name} — NOSTOPS yoga teacher`}
        width={128}
        height={128}
        className="h-28 w-28 shrink-0 rounded-3xl object-cover shadow-xl ring-4 ring-white/30 md:h-32 md:w-32"
      />
    );
  }
  return (
    <div aria-hidden="true" className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl bg-white/15 text-3xl font-black text-white shadow-xl ring-4 ring-white/30 backdrop-blur md:h-32 md:w-32">
      {initials(name)}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span aria-hidden="true" className="text-accent-600">
      {'★'.repeat(Math.max(0, Math.min(5, full)))}
      <span className="text-line">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

// Recent student reviews + a star summary — a strong trust/conversion signal.
// Rendered only when there is real rating data (aggregate or written), so a
// brand-new teacher's page stays clean instead of showing an empty shell.
function ReviewsBlock({
  reviews, stats, fallbackRating, fallbackCount, firstName,
}: { reviews: Review[]; stats: ReviewStats; fallbackRating?: number; fallbackCount?: number; firstName: string }) {
  const avg = stats.avg > 0 ? stats.avg : fallbackRating || 0;
  const count = stats.count > 0 ? stats.count : fallbackCount || 0;
  if (avg <= 0 && count <= 0 && reviews.length === 0) return null;
  const dist: Array<[number, number]> = [
    [5, stats.five],
    [4, stats.four],
    [3, stats.three],
    [2, stats.two],
    [1, stats.one],
  ];
  const distTotal = dist.reduce((n, [, c]) => n + c, 0);

  return (
    <section data-testid="teacher-reviews">
      <h2 className="text-xl font-extrabold tracking-tight">What students say</h2>
      <div className="mt-4 card p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="text-center sm:w-32">
            <div className="text-4xl font-black text-ink">{avg.toFixed(1)}</div>
            <div className="mt-1 text-lg"><Stars value={avg} /></div>
            <div className="mt-1 text-xs font-semibold text-muted">{count} {count === 1 ? 'rating' : 'ratings'}</div>
          </div>
          {distTotal > 0 && (
            <div className="flex-1 space-y-1.5">
              {dist.map(([star, c]) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-8 text-xs font-semibold text-muted">{star}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
                    <span className="block h-full rounded-full bg-accent-600" style={{ width: `${distTotal ? (c / distTotal) * 100 : 0}%` }} />
                  </span>
                  <span className="w-6 text-right text-xs text-muted">{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {reviews.length > 0 ? (
          <ul className="mt-6 list-none space-y-4 p-0">
            {reviews.map((r, i) => (
              <li key={r.id || i} className="border-t border-line pt-4 first:border-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{r.author}</span>
                  {typeof r.rating === 'number' && <span className="text-sm"><Stars value={r.rating} /></span>}
                </div>
                {r.text && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{r.text}</p>}
                {r.reply && (
                  <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-sm text-ink-soft">
                    <span className="font-semibold text-brand-700">{firstName}&apos;s reply:</span> {r.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            Based on {count} verified {count === 1 ? 'rating' : 'ratings'} from students. Written reviews will appear here as students share their experience.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function TeacherProfilePage({ params }: Params) {
  const { handle } = await params;
  const data = await loadTeacher(handle);
  if (!data) notFound();

  const { profile: p, jsonld, paramparaLabel, paramparaFounder, paramparaWords, retreats, cityLink, reviews, voices } = data;
  const location = [p.city, p.state].filter((x) => x && x !== p.country).join(', ') || p.city || p.country;
  const firstName = p.name.split(' ')[0];
  const offerTags = [
    p.offers.online && 'Online',
    p.offers.privateSession && '1:1 Private',
    p.offers.group && 'Group classes',
    p.offers.corporate && 'Corporate',
  ].filter(Boolean) as string[];
  const socialLinks = [
    p.social.instagram && { label: 'Instagram', href: p.social.instagram },
    p.social.youtube && { label: 'YouTube', href: p.social.youtube },
    p.social.linkedin && { label: 'LinkedIn', href: p.social.linkedin },
    p.social.website && { label: 'Website', href: p.social.website },
  ].filter(Boolean) as Array<{ label: string; href: string }>;
  // A 1:1 booking is only possible when the teacher has published pricing —
  // the /book page bounces back to the profile otherwise, so we gate the CTA
  // on `premium` to avoid a dead-end. Middleware routes guests through login.
  const canBook = !!p.premium;
  const bookHref = `/app/teachers/${p.handle}/book`;

  return (
    <div className="pb-24 md:pb-0">
      {/* Authoritative structured data (Person + Org + parampara + Offer + Breadcrumb) */}
      <JsonLd data={jsonld} />
      {/* Intro video (VideoObject) — additive, only when a real video is published. */}
      {p.videoUrl && isDirectVideo(p.videoUrl) && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: `Meet ${p.name} — NOSTOPS yoga teacher`,
            description: `A short introduction from ${p.name}, a NOSTOPS yoga teacher${paramparaLabel ? ` in the ${paramparaLabel} tradition` : ''}.`,
            contentUrl: p.videoUrl,
            ...(p.avatarUrl ? { thumbnailUrl: p.avatarUrl } : {}),
            uploadDate: new Date().toISOString().slice(0, 10),
          }}
        />
      )}

      {/* Owner-only inline editor (renders nothing for visitors / crawlers). */}
      <PublicProfileOwnerEditor handle={p.handle} />

      {/* Breadcrumb (crawlable) */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/teachers" className="hover:text-brand-700">Teachers</Link>
          {cityLink && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`/yoga-teachers/${cityLink.slug}`} className="hover:text-brand-700">{cityLink.label}</Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">{p.name}</span>
        </div>
      </nav>

      {/* Hero — layered gradient, conversion-focused */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="container-x relative py-12 md:py-16">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-start">
            <Avatar name={p.name} url={p.avatarUrl} b64={p.avatarB64} />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">{p.name}</h1>
              <p className="mt-2 text-lg text-white/85">
                {paramparaLabel ? `${paramparaLabel} tradition` : 'Yoga Teacher'}
                {location ? (
                  cityLink ? (
                    <>
                      {' · '}
                      <Link href={`/yoga-teachers/${cityLink.slug}`} className="font-semibold text-white underline-offset-2 hover:underline">{location}</Link>
                    </>
                  ) : (
                    ` · ${location}`
                  )
                ) : ''}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.isEmpanelled && (
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow-sm">★ Empanelled</span>
                )}
                {p.isVerified && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur">✓ Verified</span>
                )}
                {!p.isVerified && p.idChecked && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/90 ring-1 ring-white/20" data-testid="profile-id-checked">ID checked</span>
                )}
                {voices.length > 0 && (
                  <span data-testid="nostops-author-badge" className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur">✍️ NOSTOPS Author</span>
                )}
                {p.badges.map((b) => (
                  <span key={b} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/15">{b}</span>
                ))}
                {p.experienceYears ? (
                  <span className="text-sm font-semibold text-white/75">{p.experienceYears} yrs experience</span>
                ) : null}
                {p.rating ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white ring-1 ring-white/15">★ {p.rating.toFixed(1)}{p.reviewsCount ? ` (${p.reviewsCount} reviews)` : ''}</span>
                ) : null}
              </div>
              {p.yogaDimensions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2" data-testid="yoga-dimensions">
                  {p.yogaDimensions.map((d) => {
                    const m = DIMENSION_META[d] || { label: titleCase(d), emoji: '🧘' };
                    return (
                      <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/90 ring-1 ring-white/15">
                        <span aria-hidden="true">{m.emoji}</span> {m.label}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {canBook && (
                  <Link
                    href={bookHref}
                    data-testid="hero-book-cta"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-ink shadow-lg transition hover:bg-cream"
                  >
                    Book a session
                    {p.premium?.rateInr ? <span className="text-brand-700">· ₹{inr(p.premium.rateInr)}</span> : null}
                  </Link>
                )}
                <ShareProfileButton name={p.name} variant="ghost" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip — consolidated verification signals (Verified/Empanelled only) */}
      {(p.isVerified || p.isEmpanelled || p.idChecked) && (
        <div className="container-x relative z-10 -mt-6">
          <TrustStrip
            isVerified={p.isVerified}
            isEmpanelled={p.isEmpanelled}
            idChecked={p.idChecked}
            experienceYears={p.experienceYears}
            rating={p.rating}
            reviewsCount={p.reviewsCount}
            lineage={paramparaLabel}
            certHref={p.empanelmentCert && (p.empanelmentCert.certId || p.empanelmentCert.reviewerName) ? '#empanelment-certificate' : undefined}
          />
        </div>
      )}

      <div className="container-x grid gap-10 py-14 md:grid-cols-3">
        {/* Main column */}
        <div className="space-y-12 md:col-span-2">
          {/* About the Teacher */}
          <section data-testid="about-meet">
            <h2 className="text-xl font-extrabold tracking-tight">About the Teacher</h2>
            {p.bio ? (
              <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink-soft">{p.bio}</p>
            ) : (
              <p className="mt-4 text-lg leading-relaxed text-muted">
                {firstName} is a NOSTOPS teacher carrying forward a living yoga tradition.
              </p>
            )}
          </section>

          {/* Teaching impact / stats */}
          {p.stats && (
            <section data-testid="teacher-stats">
              <h2 className="text-xl font-extrabold tracking-tight">Teaching impact</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {p.stats.batchesTaught > 0 && <Stat label="Batches taught" value={String(p.stats.batchesTaught)} />}
                {p.stats.studentsReached > 0 && <Stat label="Students reached" value={String(p.stats.studentsReached)} />}
                {p.stats.avgNps > 0 && <Stat label="Avg NPS" value={String(p.stats.avgNps)} />}
                {p.stats.retentionPct > 0 && <Stat label="Retention" value={`${p.stats.retentionPct}%`} />}
              </div>
            </section>
          )}

          {/* What students say */}
          <ReviewsBlock
            reviews={reviews.reviews}
            stats={reviews.stats}
            fallbackRating={p.rating}
            fallbackCount={p.reviewsCount}
            firstName={firstName}
          />

          {/* Author Spotlight — NOSTOPS Voices articles by this teacher */}
          {voices.length > 0 && (
            <section data-testid="teacher-voices">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold tracking-tight">{firstName} on NOSTOPS Voices</h2>
                <Link href="/voices" className="shrink-0 text-sm font-bold text-brand-700 hover:underline">All Voices →</Link>
              </div>
              <p className="mt-2 text-ink-soft">Perspectives and knowledge {firstName} has published with NOSTOPS.</p>
              <ul className="mt-5 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
                {voices.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/voices/${a.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-brand-700">
                        <span>{a.type}</span>
                        {a.topic && <><span aria-hidden="true" className="text-muted">·</span><span className="text-ink-soft">{a.topic}</span></>}
                      </div>
                      <h3 className="mt-2 text-base font-black leading-snug tracking-tight text-ink group-hover:text-brand-700">{a.title}</h3>
                      {a.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{a.excerpt}</p>}
                      <span className="mt-3 text-xs font-semibold text-muted">
                        {[a.published_at ? new Date(a.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '', a.reading_minutes ? `${a.reading_minutes} min read` : '', langLabel(a.language)].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Lineage & tradition */}
          {(paramparaLabel || p.paramparas.length > 0 || p.rootGuruName || p.lineageDeclaration || p.lineagePath.length > 0) && (
            <section data-testid="teacher-lineage">
              <h2 className="text-xl font-extrabold tracking-tight">Lineage &amp; tradition</h2>
              <div className="mt-4 card space-y-4 p-6">
                {p.paramparas.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Paramparas</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.paramparas.map((pp) =>
                        pp.slug ? (
                          <Link key={pp.value} href={`/paramparas/${pp.slug}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 hover:underline">
                            {pp.label}
                          </Link>
                        ) : (
                          <span key={pp.value} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{pp.label}</span>
                        ),
                      )}
                    </div>
                  </div>
                )}
                {(paramparaFounder || paramparaWords) && (
                  <div>
                    {paramparaFounder && <p className="text-sm text-muted">Founder: {paramparaFounder}</p>}
                    {paramparaWords && <p className="mt-1 text-sm text-ink-soft">{paramparaWords}</p>}
                  </div>
                )}
                {p.rootGuruName && (
                  <p className="text-sm text-ink-soft">
                    Root Guru: <span className="font-semibold">{p.rootGuruName}</span>
                    {p.rootGuruLocation ? ` · ${p.rootGuruLocation}` : ''}
                  </p>
                )}
                {p.lineagePath.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Guru–Shishya lineage</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                      {p.lineagePath.map((g, i) => (
                        <span key={`${g}-${i}`} className="flex items-center gap-2">
                          <span className="rounded-lg bg-cream px-2.5 py-1 font-semibold">{g}</span>
                          {i < p.lineagePath.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {p.lineageDeclaration && <p className="text-sm italic text-muted">“{p.lineageDeclaration}”</p>}
                <p className="border-t border-line pt-4 text-sm leading-relaxed text-muted">
                  As a NOSTOPS teacher, {firstName} carries forward a living tradition rooted in the
                  Guru–Shishya Parampara — knowledge passed directly from teacher to student.
                </p>
              </div>
            </section>
          )}

          {/* My Yoga Tradition — additive Knowledge-Graph affiliation (renders nothing if none) */}
          <TeacherYogaTradition handle={p.handle} />

          {/* Teaching & expertise */}
          {(p.styles.length > 0 || p.specializations.length > 0) && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Teaching &amp; expertise</h2>
              {p.styles.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Styles</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.styles.map((s) => (
                      <span key={s} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {p.specializations.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Specialisations</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.specializations.map((s) => (
                      <span key={s} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Empanelment certificate */}
          {p.empanelmentCert && (p.empanelmentCert.certId || p.empanelmentCert.reviewerName) && (
            <section id="empanelment-certificate" data-testid="empanelment-cert">
              <h2 className="text-xl font-extrabold tracking-tight">Empanelment certificate</h2>
              <div className="mt-4 rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-white to-accent/5 p-6">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-2xl">🏅</span>
                  <div>
                    <p className="font-bold text-ink">NOSTOPS Council Empanelment</p>
                    <p className="mt-0.5 text-sm text-muted">Formally reviewed and empanelled by the NOSTOPS Guru Council.</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {p.empanelmentCert.certId && (
                    <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                      <dt className="text-muted">Certificate ID</dt>
                      <dd className="font-semibold text-ink-soft">{p.empanelmentCert.certId}</dd>
                    </div>
                  )}
                  {p.empanelmentCert.issuedAt && (
                    <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                      <dt className="text-muted">Issued</dt>
                      <dd className="font-semibold text-ink-soft">
                        {new Date(p.empanelmentCert.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </dd>
                    </div>
                  )}
                  {p.empanelmentCert.reviewerName && (
                    <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                      <dt className="text-muted">Reviewed by</dt>
                      <dd className="font-semibold text-ink-soft">{p.empanelmentCert.reviewerName}</dd>
                    </div>
                  )}
                  {p.empanelmentCert.coSignerName && (
                    <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                      <dt className="text-muted">Co-signed by</dt>
                      <dd className="font-semibold text-ink-soft">{p.empanelmentCert.coSignerName}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </section>
          )}

          {retreats.length > 0 && (
            <section data-testid="teacher-retreats">
              <h2 className="text-xl font-extrabold tracking-tight">Retreats with {firstName}</h2>
              <p className="mt-2 text-ink-soft">
                Immersive retreats hosted by {firstName} through the NOSTOPS cooperative.
              </p>
              <ul className="mt-5 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2">
                {retreats.map((rt) => (
                  <li key={rt.id}>
                    <RetreatCard r={rt} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 md:sticky md:top-6 md:self-start">
          {/* Meet [Name] — intro video / branded placeholder, above the Sessions card */}
          <div data-testid="meet-teacher" className="text-right">
            <h2 className="text-lg font-extrabold tracking-tight">Meet {firstName}</h2>
            <p className="mt-1 text-sm text-ink-soft">Take a moment to hear directly from the teacher.</p>
            {p.videoUrl ? (
              isDirectVideo(p.videoUrl) ? (
                <div className="mt-3 aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black shadow-sm">
                  <video
                    src={p.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    poster={p.avatarUrl || undefined}
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <a
                  href={p.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex aspect-video w-full items-center justify-center gap-2 rounded-2xl border border-line bg-gradient-to-br from-brand-50 to-royal-50 text-sm font-bold text-brand-700 shadow-sm transition hover:border-brand"
                >
                  <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow">▶</span>
                  Watch {firstName}&apos;s intro
                </a>
              )
            ) : (
              <div
                data-testid="video-placeholder"
                className="mt-3 flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-dashed border-brand/30 bg-gradient-to-br from-brand-50/70 to-royal-50/70 p-6 text-center shadow-sm"
              >
                <span aria-hidden="true" className="text-3xl">🧘</span>
                <p className="mt-2 text-base font-black text-ink">Meet the Teacher</p>
                <p className="mt-1 text-sm text-ink-soft">A 60–90 second introduction will appear here soon.</p>
                <MeetTeacherOwnerCta handle={p.handle} />
              </div>
            )}
          </div>

          {(p.premium || offerTags.length > 0) && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="bg-gradient-to-br from-brand-50 to-royal-50 px-6 py-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700">Sessions</h2>
                {p.premium ? (
                  <div className="mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-ink">₹{inr(p.premium.rateInr)}</span>
                      {p.premium.durationMin ? <span className="text-sm font-semibold text-muted">/ {p.premium.durationMin} min</span> : null}
                    </div>
                    {p.premium.description && <p className="mt-2 text-sm text-muted">{p.premium.description}</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ink-soft">Available for {offerTags.join(', ').toLowerCase()} sessions.</p>
                )}
              </div>
              <div className="p-6 pt-5">
                {canBook && (
                  <Link
                    href={bookHref}
                    data-testid="sidebar-book-cta"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-brand-600"
                  >
                    Book a session →
                  </Link>
                )}
                {offerTags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {offerTags.map((t) => (
                      <span key={t} className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink-soft">{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <ShareProfileButton name={p.name} variant="outline" className="w-full" />
                </div>
              </div>
            </div>
          )}

          {p.languages.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Languages</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.languages.map((l) => (
                  <span key={l} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-ink-soft ring-1 ring-line">{l}</span>
                ))}
              </div>
            </div>
          )}

          {socialLinks.length > 0 && (
            <div className="card p-6" data-testid="teacher-social">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Connect</h2>
              <div className="mt-3 flex flex-col gap-2">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700"
                  >
                    <span>{s.label}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {cityLink && (
            <div className="card p-6" data-testid="teacher-city-links">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Yoga in {cityLink.label}</h2>
              <div className="mt-3 flex flex-col gap-2">
                <Link href={`/yoga-teachers/${cityLink.slug}`} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700">
                  <span>Yoga teachers in {cityLink.label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
                {p.styles[0] && (
                  <Link href={`/yoga-teachers/${cityLink.slug}/${citySlug(p.styles[0])}`} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700">
                    <span>{titleCase(p.styles[0])} teachers in {cityLink.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
                <Link href={`/become-a-teacher/${cityLink.slug}`} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700">
                  <span>Become a teacher in {cityLink.label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          )}

          <Link href="/teachers" className="block text-center text-sm font-bold text-brand-700 hover:underline">
            ← All NOSTOPS teachers
          </Link>
        </aside>
      </div>

      {/* Mobile sticky action bar (conversion) */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 p-3 backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3">
          {canBook ? (
            <Link
              href={bookHref}
              data-testid="mobile-book-cta"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white shadow-sm"
            >
              Book a session{p.premium?.rateInr ? ` · ₹${inr(p.premium.rateInr)}` : ''}
            </Link>
          ) : (
            <span className="flex-1 text-sm font-semibold text-muted">Share this profile</span>
          )}
          <ShareProfileButton name={p.name} variant="bar" />
        </div>
      </div>
    </div>
  );
}
