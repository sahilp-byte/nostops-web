import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { SITE_URL } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { normalizeJsonLd } from '@/lib/seo';
import { getPublicArticle } from '@/lib/server/voices';
import { langLabel } from '@/lib/voices-shared';
import { titleCase } from '@/lib/format';
import RepublishTools from '@/components/voices/RepublishTools';
import ViewBeacon from '@/components/voices/ViewBeacon';
import ShareButtons from '@/components/share/ShareButtons';

export const dynamic = 'force-dynamic';

function fmt(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicArticle(slug);
  if (!a) return { title: 'Article not found · NOSTOPS Voices', robots: { index: false, follow: false } };
  const url = canonical(`/voices/${a.slug}`);
  const profileUrl = a.author_handle ? canonical(`/teachers/${a.author_handle}`) : undefined;
  const lang = (a.language || a.source_language || 'en').toLowerCase();
  const plain = (a.content_text || '').replace(/\s+/g, ' ').trim();
  const desc =
    (a.summary && a.summary.trim()) ||
    (plain ? plain.slice(0, 155) : `${titleCase(a.type)} by ${a.author_name} on NOSTOPS Voices.`);
  const publishedISO = a.published_at ? new Date(a.published_at).toISOString() : undefined;
  const tags = (a.topic || '')
    .split(/[,·/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    title: { absolute: `${a.title} · NOSTOPS Voices` },
    description: desc,
    keywords: tags.length ? tags : undefined,
    authors: [{ name: a.author_name, ...(profileUrl ? { url: profileUrl } : {}) }],
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    openGraph: {
      // og:image is supplied automatically by ./opengraph-image.tsx (author photo card).
      type: 'article',
      siteName: 'NOSTOPS Voices',
      url,
      title: a.title,
      description: desc,
      locale: `${lang}_IN`,
      authors: profileUrl ? [profileUrl] : [a.author_name],
      publishedTime: publishedISO,
      section: titleCase(a.type),
      ...(tags.length ? { tags } : {}),
    },
    twitter: {
      // twitter:image is supplied automatically by ./twitter-image.tsx.
      card: 'summary_large_image',
      title: a.title,
      description: desc,
    },
  };
}

export default async function VoicesArticlePage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const a = await getPublicArticle(slug, lang);
  if (!a) notFound();

  const url = canonical(`/voices/${a.slug}`);
  const profileUrl = a.author_handle ? canonical(`/teachers/${a.author_handle}`) : '';
  const currentLang = a.language || a.source_language;
  const avatarAbs = a.author_avatar_url && /^https?:\/\//i.test(a.author_avatar_url) ? a.author_avatar_url : undefined;

  const jsonLd = normalizeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: (a.summary || a.content_text || '').replace(/\s+/g, ' ').trim().slice(0, 200) || undefined,
    ...(avatarAbs ? { image: avatarAbs } : {}),
    inLanguage: currentLang,
    datePublished: a.published_at ? new Date(a.published_at).toISOString() : undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: {
      '@type': 'Person',
      name: a.author_name,
      ...(profileUrl ? { url: profileUrl } : {}),
      ...(avatarAbs ? { image: avatarAbs } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'NOSTOPS',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/nostops-logo.png` },
    },
    articleSection: a.type,
    keywords: a.topic || undefined,
  });

  return (
    <div className="bg-cream/30">
      <JsonLd data={jsonLd} />
      <ViewBeacon slug={a.slug} />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <nav className="text-xs font-semibold text-muted">
          <Link href="/voices" className="hover:text-brand-700">NOSTOPS Voices</Link>
          <span aria-hidden className="mx-1.5">/</span>
          <span className="text-ink-soft">{a.type}</span>
        </nav>

        {/* Language switcher */}
        {a.available_languages.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="voices-lang-switcher">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted">Read in</span>
            {a.available_languages.map((l) => {
              const isCur = l.code === currentLang;
              const href = l.code === a.source_language ? `/voices/${a.slug}` : `/voices/${a.slug}?lang=${l.code}`;
              return (
                <Link key={l.code} href={href} data-testid={`lang-${l.code}`} className={`rounded-full px-2.5 py-1 text-xs font-bold ${isCur ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft hover:border-brand'}`}>
                  {l.name}
                </Link>
              );
            })}
          </div>
        )}

        <header className="mt-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-brand-700">
            <span>{a.type}</span>
            {a.topic && <><span aria-hidden className="text-muted">·</span><span className="text-ink-soft">{a.topic}</span></>}
          </div>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">{a.title}</h1>
          {a.summary && <p className="mt-3 text-lg leading-relaxed text-ink-soft" data-testid="voices-article-summary">{a.summary}</p>}
          <div className="mt-4 flex items-center gap-3">
            {a.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.author_avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-brand/10 text-lg font-black text-brand-700">{a.author_name.slice(0, 1).toUpperCase()}</span>
            )}
            <div className="text-sm">
              <p className="font-bold text-ink">
                {profileUrl ? <Link href={`/teachers/${a.author_handle}`} className="hover:text-brand-700">{a.author_name}</Link> : a.author_name}
              </p>
              <p className="text-xs text-muted">{[a.author_city, fmt(a.published_at), a.reading_minutes ? `${a.reading_minutes} min read` : '', `in ${langLabel(currentLang)}`].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted">Share</span>
            <ShareButtons path={`/voices/${a.slug}`} title={a.title} message={`${a.title} — by ${a.author_name} on NOSTOPS Voices`} tone="light" />
          </div>
        </header>

        <div className="voices-prose mt-8 text-[17px] leading-[1.75] text-ink-soft" dangerouslySetInnerHTML={{ __html: a.content_html || '' }} />

        {/* Author bio */}
        <section className="mt-10 rounded-2xl border border-line bg-white p-6">
          <p className="text-xs font-black uppercase tracking-wider text-muted">About the author</p>
          <div className="mt-3 flex items-start gap-4">
            {a.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.author_avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
            ) : (
              <span aria-hidden className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-xl font-black text-brand-700">{a.author_name.slice(0, 1).toUpperCase()}</span>
            )}
            <div className="min-w-0">
              <p className="font-black text-ink">{a.author_name}</p>
              {a.author_bio && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{a.author_bio}</p>}
              {profileUrl && <Link href={`/teachers/${a.author_handle}`} className="mt-2 inline-block text-sm font-bold text-brand-700 hover:underline">View NOSTOPS profile →</Link>}
            </div>
          </div>
        </section>

        {/* Attribution */}
        <section className="mt-6 rounded-2xl border border-line bg-cream/60 p-5 text-sm" data-testid="voices-attribution">
          <p className="text-xs font-black uppercase tracking-wider text-muted">Attribution</p>
          <ul className="mt-2 space-y-1 text-ink-soft">
            <li><strong>Author:</strong> {a.author_name}</li>
            <li><strong>Originally published on</strong> NOSTOPS</li>
            <li className="break-all"><strong>Original article:</strong> <a href={url} className="text-brand-700 hover:underline">{url}</a></li>
            {profileUrl && <li className="break-all"><strong>Teacher profile:</strong> <a href={profileUrl} className="text-brand-700 hover:underline">{profileUrl}</a></li>}
          </ul>
        </section>

        {/* Republication tools — only when enabled by admin */}
        {a.available_for_republication && (
          <div className="mt-6">
            <RepublishTools
              slug={a.slug}
              siteUrl={SITE_URL}
              copy={{
                title: a.title,
                author: a.author_name,
                contentText: a.content_text,
                bio: a.author_bio,
                articleUrl: url,
                profileUrl,
              }}
            />
            <p className="mt-3 text-center text-xs text-muted">
              Developers can also use the read-only <Link href="/voices/api" className="font-bold text-brand-700 hover:underline">NOSTOPS Publisher API</Link>.
            </p>
          </div>
        )}
      </article>
    </div>
  );
}
