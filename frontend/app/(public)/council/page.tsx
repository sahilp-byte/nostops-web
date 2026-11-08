import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { metaToMetadata, normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { visibleCouncilMembers, withoutHiddenCouncil } from '@/lib/council-visibility';
import { getCouncilGate } from '@/lib/server/council-gate';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';

// Static, deterministic council roster -> ISR (long revalidate).
export const revalidate = 3600;

const PATH = '/council';
const CANONICAL_URL = canonical(PATH); // https://www.nostops.org/council
// The backend SEO copy carries unverifiable aggregates (combined years of
// practice, students taught), so page meta + JSON-LD use this instead (NST-008).
const CLAIM_FREE_DESC =
  'The invite-only body of empanelled Gurus who attest teacher lineage and safeguard the ethical standards of the NOSTOPS cooperative.';

type CouncilData = { meta?: Record<string, string>; jsonld?: any[]; members_count?: number };

type CouncilMember = {
  slug: string;
  name: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  city?: string;
  alumniOf?: string;
};

function slugFromUrl(u?: string): string | null {
  if (!u || typeof u !== 'string') return null;
  const m = /\/council\/([^/?#"']+)/.exec(u);
  return m ? m[1] : null;
}

async function getCouncil(): Promise<CouncilData | null> {
  try {
    return await apiGet<CouncilData>('/seo/council', { revalidate: 86400 });
  } catch {
    return null;
  }
}

function extractMembers(data: CouncilData | null, gated: ReadonlySet<string>): CouncilMember[] {
  const org = Array.isArray(data?.jsonld)
    ? (data!.jsonld as any[]).find((o) => o?.['@type'] === 'Organization')
    : null;
  const raw: any[] = visibleCouncilMembers(Array.isArray(org?.member) ? org.member : [], gated);
  return raw
    .map((m) => {
      const slug = slugFromUrl(m?.url);
      if (!slug) return null;
      return {
        slug,
        name: String(m?.name || ''),
        jobTitle: m?.jobTitle || undefined,
        description: m?.description || undefined,
        image: typeof m?.image === 'string' ? m.image : undefined,
        city: m?.address?.addressLocality || undefined,
        alumniOf: typeof m?.alumniOf === 'object' ? m?.alumniOf?.name : m?.alumniOf,
      } as CouncilMember;
    })
    .filter((m): m is CouncilMember => !!m && !!m.name);
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getCouncil();
  const mapped = metaToMetadata(data?.meta ?? {});
  const title = mapped.title ?? { absolute: 'Council of Yoga Gurus · NOSTOPS' };
  // Claim-free description (the backend SEO copy carries unverifiable aggregates).
  const description = CLAIM_FREE_DESC;
  const og = (mapped.openGraph ?? {}) as Record<string, any>;
  const tw = (mapped.twitter ?? {}) as Record<string, any>;
  const ogTitle = og.title ?? (typeof title === 'object' ? (title as any).absolute : title);
  const ogDesc = description;
  return {
    title,
    description,
    alternates: { canonical: CANONICAL_URL },
    openGraph: { ...og, type: og.type ?? 'website', siteName: og.siteName ?? 'NOSTOPS', url: CANONICAL_URL, title: ogTitle, description: ogDesc },
    twitter: { ...tw, card: tw.card ?? 'summary_large_image', title: ogTitle, description: ogDesc },
  };
}

export default async function CouncilIndexPage() {
  const data = await getCouncil();
  // Gurus linked to a nomination that is not published yet stay hidden (council-gate).
  const gated = await getCouncilGate();
  // Same claim-free description in structured data (NST-008); hidden members omitted.
  const jsonld = withoutHiddenCouncil(normalizeJsonLd(Array.isArray(data?.jsonld) ? (data!.jsonld as any[]) : []), gated).map((o: any) =>
    o?.['@type'] === 'Organization' ? { ...o, description: CLAIM_FREE_DESC } : o,
  );
  const members = extractMembers(data, gated);
  // Fixed, claim-free lead: the backend SEO copy carries unverifiable aggregates
  // (combined years of practice, students taught), which are not shown (NST-008).
  // The member count below is derived from the live roster.
  const lead = 'Stewards of authentic yoga in India — an invite-only body of empanelled Gurus safeguarding lineage and ethics.';

  return (
    <main>
      {jsonld.length > 0 && <JsonLd data={jsonld} />}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Council</span>
        </div>
      </nav>

      {/* Hero — unified public-marketing gradient */}
      <PageHero
        eyebrow="Council of Gurus"
        title="Council of Yoga Gurus"
        subtitle={lead}
        note={
          <>
            The Council is an invite-only body of empanelled Gurus who attest teacher lineage
            (parampara), review empanelment, and safeguard the ethical standards of NOSTOPS —
            India&apos;s Teacher-First Yoga Cooperative.
          </>
        }
      />

      {/* Roster */}
      <section className="container-x py-14">
        <h2 className="text-2xl font-extrabold tracking-tight">
          {members.length > 0 ? `${members.length} Council Gurus` : 'Council Gurus'}
        </h2>

        {members.length === 0 ? (
          <div className="mt-8 card p-8 text-center">
            <p className="text-lg font-semibold text-ink">The Council roster is temporarily unavailable.</p>
            <p className="mt-2 text-muted">Please try again shortly.</p>
          </div>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/council/${m.slug}`}
                  className="card group flex h-full flex-col p-6 transition hover:border-brand hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    {m.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.image}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-full border border-line bg-cream object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-extrabold tracking-tight group-hover:text-brand-700">{m.name}</h3>
                      {m.jobTitle && <p className="text-sm font-semibold text-brand-700">{m.jobTitle}</p>}
                    </div>
                  </div>
                  {m.description && (
                    <p className="clamp-3 mt-4 text-sm leading-relaxed text-muted">{m.description}</p>
                  )}
                  <dl className="mt-auto pt-4 text-xs text-muted">
                    {m.city && (
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-ink-soft">Based in:</dt>
                        <dd>{m.city}</dd>
                      </div>
                    )}
                    {m.alumniOf && (
                      <div className="mt-0.5 flex gap-1.5">
                        <dt className="font-semibold text-ink-soft">Lineage:</dt>
                        <dd>{m.alumniOf}</dd>
                      </div>
                    )}
                  </dl>
                  <span className="mt-3 inline-block text-sm font-bold text-brand-700">View profile →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Guru Nominations (Phase 1) — signed-in members only */}
      <section className="container-x pb-16" data-testid="council-nominate-cta">
        <div className="card flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Know a living Guru who belongs on the Council?</h2>
            <p className="mt-1 max-w-2xl text-muted">
              Signed-in members can nominate a Guru. The Council decides, and nothing about the Guru is published unless they agree.
            </p>
          </div>
          <Link
            href="/council/nominate"
            data-testid="council-nominate-link"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Nominate a Guru
          </Link>
        </div>
      </section>
    </main>
  );
}
