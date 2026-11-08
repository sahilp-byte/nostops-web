import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical, SITE_URL } from '@/lib/site';
import { normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import { GUIDES, getGuide, GUIDE_REVIEWER } from '@/lib/guides';

export const revalidate = 86400;

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return { title: 'Guide not found · NOSTOPS', robots: { index: false, follow: true } };
  const url = canonical(`/guides/${g.slug}`);
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: url },
    openGraph: { title: g.title, description: g.description, url, type: 'article', siteName: 'NOSTOPS' },
    twitter: { card: 'summary_large_image', title: g.title, description: g.description },
    robots: { index: true, follow: true },
  };
}

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();

  const url = canonical(`/guides/${g.slug}`);
  const updatedLabel = new Date(g.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: g.title,
      description: g.description,
      inLanguage: 'en-IN',
      datePublished: g.updated,
      dateModified: g.updated,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: { '@type': 'Organization', name: GUIDE_REVIEWER, url: SITE_URL },
      publisher: {
        '@type': 'Organization',
        name: 'NOSTOPS',
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/nostops-logo.png` },
      },
      about: g.topic,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: g.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: canonical('/guides') },
        { '@type': 'ListItem', position: 3, name: g.title, item: url },
      ],
    },
  ]);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />
      <PageHero eyebrow={g.eyebrow} title={g.title} subtitle={g.description} />

      <div className="container-x py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden className="px-1.5">/</span>
          <Link href="/guides" className="hover:text-brand-700">Guides</Link>
          <span aria-hidden className="px-1.5">/</span>
          <span className="text-ink-soft">{g.title}</span>
        </nav>

        <article className="mx-auto max-w-3xl">
          {/* Direct answer — answer-first for readers and AI answer engines */}
          <div className="rounded-2xl border border-brand/15 bg-brand-50/50 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-brand-700">Quick answer</p>
            <p className="mt-2 text-lg leading-relaxed text-ink">{g.directAnswer}</p>
          </div>

          {g.sections.map((s) => (
            <section key={s.heading} className="mt-10">
              <h2 className="text-2xl font-black tracking-tight text-ink">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 leading-relaxed text-ink-soft">{p}</p>
              ))}
              {s.bullets && s.bullets.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5 text-ink-soft">
                      <span aria-hidden className="mt-1 text-brand-700">✓</span>
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* FAQ — visible + FAQPage schema above */}
          <section className="mt-12">
            <h2 className="text-2xl font-black tracking-tight text-ink">Frequently asked questions</h2>
            <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
              {g.faqs.map((f) => (
                <details key={f.q} className="group p-5">
                  <summary className="cursor-pointer list-none text-base font-bold text-ink marker:hidden">
                    <span className="flex items-start justify-between gap-4">
                      {f.q}
                      <span aria-hidden className="mt-1 text-brand-700 transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Related — contextual internal links / entity relationships */}
          <section className="mt-12">
            <h2 className="text-2xl font-black tracking-tight text-ink">Related on NOSTOPS</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {g.related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand-700"
                  >
                    {r.label}
                    <span aria-hidden className="text-brand-700">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-10 border-t border-line pt-5 text-sm text-muted">
            Reviewed by the <span className="font-semibold text-ink-soft">{GUIDE_REVIEWER}</span> · Last updated {updatedLabel}
          </p>
        </article>
      </div>
    </main>
  );
}
