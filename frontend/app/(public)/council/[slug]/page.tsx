import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { fitDescription, normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { visibleCouncilMembers } from '@/lib/council-visibility';
import { getCouncilGate } from '@/lib/server/council-gate';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };
type CouncilData = { meta?: Record<string, string>; jsonld?: any[] };

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

function getMembers(data: CouncilData | null, gated: ReadonlySet<string>): any[] {
  const org = Array.isArray(data?.jsonld)
    ? (data!.jsonld as any[]).find((o) => o?.['@type'] === 'Organization')
    : null;
  // Hidden handles (lib/council-visibility) and unpublished nominated Gurus (council-gate) → 404.
  return visibleCouncilMembers(Array.isArray(org?.member) ? org.member : [], gated);
}

function findMember(members: any[], slug: string): any | null {
  return members.find((m) => slugFromUrl(m?.url) === slug) ?? null;
}

export async function generateStaticParams() {
  const members = getMembers(await getCouncil(), await getCouncilGate());
  return members
    .map((m) => slugFromUrl(m?.url))
    .filter((s): s is string => !!s)
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const url = canonical(`/council/${slug}`);
  const member = findMember(getMembers(await getCouncil(), await getCouncilGate()), slug);
  if (!member) {
    return { title: { absolute: 'Council Guru · NOSTOPS' }, alternates: { canonical: url } };
  }
  const name: string = member.name || 'Council Guru';
  const role: string = member.jobTitle || 'Council Guru';
  const title = `${name} · ${role} · NOSTOPS`;
  const description: string = fitDescription(
    member.description,
    `${name} is a ${role} on the NOSTOPS Council of Yoga Gurus, safeguarding lineage and ethical standards.`,
  );
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'profile', siteName: 'NOSTOPS', url, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CouncilMemberPage({ params }: Params) {
  const { slug } = await params;
  const data = await getCouncil();
  const members = getMembers(data, await getCouncilGate());
  const member = findMember(members, slug);
  if (!member) notFound();

  const url = canonical(`/council/${slug}`);
  const name: string = member.name || 'Council Guru';
  const role: string | undefined = member.jobTitle;
  const description: string | undefined = member.description;
  const image: string | undefined = typeof member.image === 'string' ? member.image : undefined;
  const city: string | undefined = member.address?.addressLocality;
  const country: string | undefined = member.address?.addressCountry;
  const lineage: string | undefined =
    typeof member.alumniOf === 'object' ? member.alumniOf?.name : member.alumniOf;

  // Authoritative Person graph, built from the embedded council roster data and
  // pinned to the canonical www origin.
  const personLd = normalizeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': url,
    url,
    name,
    jobTitle: role,
    description,
    image,
    address: member.address,
    affiliation: member.affiliation,
    alumniOf: member.alumniOf,
    memberOf: {
      '@type': 'Organization',
      name: 'NOSTOPS Council of Yoga Gurus',
      url: canonical('/council'),
    },
  });
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
      { '@type': 'ListItem', position: 2, name: 'Council of Gurus', item: canonical('/council') },
      { '@type': 'ListItem', position: 3, name, item: url },
    ],
  };

  const others = members
    .map((m) => ({ slug: slugFromUrl(m?.url), name: String(m?.name || '') }))
    .filter((m) => m.slug && m.slug !== slug);

  return (
    <main>
      <JsonLd data={[personLd, breadcrumbLd]} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/council" className="hover:text-brand-700">Council</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">{name}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-cream">
        <div className="container-x py-12 md:py-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                width={112}
                height={112}
                className="h-24 w-24 shrink-0 rounded-2xl border border-line bg-white object-cover md:h-28 md:w-28"
              />
            )}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
                Council of Gurus
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-ink md:text-4xl">{name}</h1>
              {role && <p className="mt-2 text-lg font-semibold text-brand-700">{role}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {(city || country) && (
              <div>
                <span className="font-bold text-ink">Based in:</span>{' '}
                <span className="text-ink-soft">{[city, country === 'IN' ? 'India' : country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {lineage && (
              <div>
                <span className="font-bold text-ink">Lineage:</span> <span className="text-ink-soft">{lineage}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-12 md:col-span-2">
          {description && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">About {name}</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">{description}</p>
            </section>
          )}

          <section className="card p-6">
            <p className="text-sm leading-relaxed text-muted">
              As a member of the NOSTOPS Council of Yoga Gurus, {name} helps attest teacher lineage
              (parampara), reviews empanelment, and safeguards the ethical standards of the cooperative —
              honouring the living Guru–Shishya tradition at the heart of Indian yoga.
            </p>
          </section>
        </div>

        {/* Sidebar: other council members */}
        <aside>
          <div className="card p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Other Council Gurus</h2>
            <ul className="mt-3 list-none space-y-2 p-0 text-sm">
              {others.map((m) => (
                <li key={m.slug}>
                  <Link href={`/council/${m.slug}`} className="text-ink-soft hover:text-brand-700">{m.name}</Link>
                </li>
              ))}
            </ul>
            <Link href="/council" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">
              ← Full Council
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
