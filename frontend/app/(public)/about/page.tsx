import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { metaToMetadata, normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';

// Server-rendered with hourly ISR. Content + SEO are in the initial HTML.
export const revalidate = 3600;

const ABOUT_PATH = '/about';
const CANONICAL_URL = canonical(ABOUT_PATH); // https://www.nostops.org/about

type AboutData = { meta?: Record<string, string>; jsonld?: any[] };

// Safe, deterministic fallbacks (used only if the backend is unreachable).
const FALLBACK_TITLE = "About India's Teacher-First Yoga Cooperative · NOSTOPS";
const FALLBACK_DESC =
  'NOSTOPS restores dignity, recognition and economic opportunity for Indian yoga teachers: a teacher-first cooperative rooted in the Guru–Shishya Parampara.';

// Editorial copy (authoritative — provided by NOSTOPS). Rendered into the
// existing layout without changing structure or styling.
const HERO_TITLE = 'About NOSTOPS — The Movement Manifesto';
const HERO_SLOGAN = 'Honouring the Teacher. Preserving the Tradition. Serving the World.';
const MANIFESTO_QUOTE = 'Some things are not meant to be owned. They are meant to be carried.';
const MANIFESTO_P1 =
  "Since 2004, our founder has advocated for fairness in global employment — for the Indian knowledge workers who carry skill, expertise, and innovation into the world's technology economy. NOSTOPS carries that same principle forward, into yoga: restoring dignity, recognition, and economic opportunity for Indian yoga teachers as custodians of the Guru–Shishya Parampara.";
const MANIFESTO_P2 =
  'NOSTOPS is a teacher-first yoga collective built around one question — what do we keep alive? Rooted in the Guru–Shishya Parampara, it exists to protect the dignity, recognition, and livelihood of the teachers who carry one of humanity\u2019s oldest living traditions forward.';
const ORG_NAME = "NOSTOPS · India's Teacher-First Yoga Collective";
const ORG_LEGAL = 'National Organisation for Software and Technology Professionals';
const ORG_FOUNDED = '2024';
const ORG_SERVING = 'India';
const MISSION_TEXT =
  "To restore the recognition and economic opportunity of Indian yoga teachers — the custodians of one of humanity's oldest living knowledge traditions.";
const CARD1_TITLE = 'A collective, not a marketplace';
const CARD1_BODY =
  'NOSTOPS is built teacher-first. Rather than treating teachers as interchangeable gig workers, it operates as a collective — sharing recognition and economic opportunity with the teachers who carry the tradition forward. A teacher cannot sustainably carry knowledge forward if the ecosystem around them cannot sustain the teacher; economic sustainability is part of preserving the tradition, not separate from it.';
const CARD2_TITLE = 'Rooted in the Guru–Shishya Parampara';
const CARD2_BODY =
  'The Guru–Shishya Parampara — the living teacher-to-student lineage at the heart of Indian yoga — treats authentic teachers and Gurus as custodians of knowledge, not owners of it. NOSTOPS honours that relationship as the foundation of everything it does: technology as infrastructure, the teacher as the human centre.';
const STANDS_FOR = [
  'Yoga',
  'Parampara',
  'Guru–Shishya tradition',
  'Yoga teacher livelihood',
  'Collective economics',
  'Indian knowledge workers',
  'Wellness ecosystem',
];

// Single fetch of the existing backend SEO endpoint, server-side only.
async function getAbout(): Promise<{ data: AboutData | null; missing: boolean }> {
  try {
    const data = await apiGet<AboutData>('/seo/about', { revalidate: 3600 });
    return { data, missing: false };
  } catch (e) {
    const msg = (e as Error)?.message || '';
    if (/Backend 404\b/.test(msg)) return { data: null, missing: true };
    // Transient failure -> render with safe fallback instead of crashing.
    return { data: null, missing: false };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await getAbout();
  const mapped = metaToMetadata(data?.meta ?? {});

  // Website-owned title + description (Phase 3: "Page name · NOSTOPS", 50–160 chars).
  const title = { absolute: FALLBACK_TITLE };
  const description = FALLBACK_DESC;
  const og = (mapped.openGraph ?? {}) as Record<string, any>;
  const tw = (mapped.twitter ?? {}) as Record<string, any>;
  const ogTitle = og.title ?? (typeof title === 'object' ? (title as any).absolute : title);
  const ogDesc = og.description ?? description;

  return {
    title,
    description,
    // Deterministic canonical + www origin, independent of backend origin.
    alternates: { canonical: CANONICAL_URL },
    openGraph: {
      ...og,
      type: og.type ?? 'website',
      siteName: og.siteName ?? 'NOSTOPS',
      url: CANONICAL_URL,
      title: ogTitle,
      description: ogDesc,
    },
    twitter: {
      ...tw,
      card: tw.card ?? 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
    },
  };
}

export default async function AboutPage() {
  const { data, missing } = await getAbout();
  if (missing) notFound();

  const jsonldRaw: any[] = Array.isArray(data?.jsonld) ? (data!.jsonld as any[]) : [];
  // Normalize only URL-bearing JSON-LD fields to the www origin (text untouched).
  const jsonld = normalizeJsonLd(jsonldRaw);

  const explore = [
    { href: '/council', title: 'Council of Gurus', desc: 'The senior teachers who steward standards and lineage.' },
    { href: '/paramparas', title: 'Paramparas', desc: 'The living yoga traditions NOSTOPS teachers belong to.' },
  ];

  return (
    <div>
      {/* JSON-LD (server-rendered into the initial HTML) */}
      <JsonLd data={jsonld} />

      {/* Hero — unified public-marketing gradient */}
      <PageHero
        eyebrow="About NOSTOPS"
        title={HERO_TITLE}
        subtitle={<span className="font-semibold text-white">{HERO_SLOGAN}</span>}
      />

      {/* Manifesto */}
      <section className="container-x py-16">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="text-xl leading-relaxed text-ink-soft md:text-2xl">{MANIFESTO_QUOTE}</p>
            <p className="mt-6 text-lg leading-relaxed text-muted">{MANIFESTO_P1}</p>
            <p className="mt-4 text-lg leading-relaxed text-muted">{MANIFESTO_P2}</p>
            <Link href="/philosophy" className="mt-6 inline-block text-sm font-bold text-brand-700 hover:underline">
              Read our full philosophy →
            </Link>
          </div>
          <aside className="md:col-span-1">
            <div className="card p-7">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">The organisation</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-semibold text-ink">Name</dt>
                  <dd className="mt-0.5 text-muted">{ORG_NAME}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Legal name</dt>
                  <dd className="mt-0.5 text-muted">{ORG_LEGAL}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Founded</dt>
                  <dd className="mt-0.5 text-muted">{ORG_FOUNDED}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Serving</dt>
                  <dd className="mt-0.5 text-muted">{ORG_SERVING}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {/* Mission */}
      <section className="border-y border-line bg-white">
        <div className="container-x py-14">
          <h2 className="text-xs font-bold uppercase tracking-wider text-accent-600">Our mission</h2>
          <p className="mt-4 max-w-4xl text-2xl font-extrabold leading-snug tracking-tight text-ink md:text-3xl">
            {MISSION_TEXT}
          </p>
        </div>
      </section>

      {/* Teacher-first collective + Parampara */}
      <section className="container-x py-16">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-8">
            <div className="mb-4 h-1.5 w-12 rounded-full bg-brand" />
            <h3 className="text-xl font-extrabold tracking-tight">{CARD1_TITLE}</h3>
            <p className="mt-3 leading-relaxed text-muted">{CARD1_BODY}</p>
          </div>
          <div className="card p-8">
            <div className="mb-4 h-1.5 w-12 rounded-full bg-royal" />
            <h3 className="text-xl font-extrabold tracking-tight">{CARD2_TITLE}</h3>
            <p className="mt-3 leading-relaxed text-muted">{CARD2_BODY}</p>
          </div>
        </div>
      </section>

      {/* What we stand for */}
      <section className="border-t border-line bg-cream">
        <div className="container-x py-14">
          <h2 className="text-2xl font-extrabold tracking-tight">What NOSTOPS stands for</h2>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {STANDS_FOR.map((k) => (
              <span
                key={k}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Explore / lineage context */}
      <section className="container-x py-16">
        <h2 className="text-2xl font-extrabold tracking-tight">Explore the movement</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {explore.map((e) => (
            <Link key={e.href} href={e.href} className="card group p-7 transition hover:border-brand hover:shadow-md">
              <h3 className="text-lg font-bold group-hover:text-brand-700">{e.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{e.desc}</p>
              <span className="mt-4 inline-block text-sm font-bold text-brand-700">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-x pb-20">
        <div className="overflow-hidden rounded-3xl bg-ink px-8 py-14 text-center text-white md:px-16">
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">Meet the teachers</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/70">
            Discover vetted Indian yoga teachers carrying their paramparas forward.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/teachers" className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
              Explore teachers
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
