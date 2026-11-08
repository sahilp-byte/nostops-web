import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical, SITE_URL } from '@/lib/site';
import { ogImages, DEFAULT_OG_IMAGE } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';

export const revalidate = 3600;
const CANONICAL_URL = canonical('/voices/api');

export const metadata: Metadata = {
  title: { absolute: 'Voices Publisher API · NOSTOPS' },
  description:
    'The read-only NOSTOPS Publisher API lets websites reuse published NOSTOPS Voices articles with author and NOSTOPS attribution. No API key required.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: { type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL, title: 'NOSTOPS Publisher API', description: 'Read-only API to legitimately reuse published NOSTOPS Voices articles, with author + NOSTOPS attribution retained. No account or API key required.', images: ogImages() },
  twitter: { card: 'summary_large_image', title: 'NOSTOPS Publisher API', images: [DEFAULT_OG_IMAGE] },
};

function Code({ children }: { children: React.ReactNode }) {
  return <pre className="overflow-x-auto rounded-xl border border-line bg-ink p-4 text-xs leading-relaxed text-cream"><code>{children}</code></pre>;
}

export default function PublisherApiDocs() {
  const list = `${SITE_URL}/api/voices/public/articles`;
  const single = `${SITE_URL}/api/voices/public/articles/{slug}`;
  return (
    <div>
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'NOSTOPS Voices', path: '/voices' }, { name: 'Publisher API', path: '/voices/api' }]} />
      <PageHero eyebrow="For developers" title="NOSTOPS Publisher API" subtitle="Legitimately reuse NOSTOPS Voices articles — no account, no API key." />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14 space-y-8 text-[15px] leading-relaxed text-ink-soft">
        <section>
          <p>
            The Publisher API is a simple, read-only feed of NOSTOPS Voices articles that are <strong>Published</strong> and
            explicitly marked <strong>Available for Republication</strong> by NOSTOPS. There is no registration, no API key and
            no publisher management. Every article carries the attribution you must retain: the teacher (author), NOSTOPS, and
            the original-source link.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-black text-ink">List eligible articles</h2>
          <p className="mt-1">Returns only Published + Republication-enabled articles.</p>
          <Code>GET {list}</Code>
          <p className="mt-2 text-sm text-muted">Optional query params: <code>lang</code> (en, hi, mr, bn, ta, te — returns a translation when available), <code>topic</code>, <code>type</code>, <code>limit</code> (max 200).</p>
        </section>

        <section>
          <h2 className="text-lg font-black text-ink">Fetch a single article</h2>
          <Code>GET {single}</Code>
          <p className="mt-2 text-sm text-muted">Add <code>?lang=hi</code> for a translated version. The <code>available_for_republication</code> flag tells you whether reuse is permitted.</p>
        </section>

        <section>
          <h2 className="text-lg font-black text-ink">Response fields</h2>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {['id', 'slug', 'title', 'type', 'topic', 'source_language', 'language', 'available_languages', 'content_html', 'content_text', 'published_at', 'author_name', 'author_bio', 'author_handle', 'canonical_url', 'attribution', 'available_for_republication'].map((f) => (
              <li key={f} className="rounded-lg bg-cream px-2.5 py-1 text-xs font-semibold text-ink-soft"><code>{f}</code></li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            The <code>attribution</code> object contains <code>author</code>, <code>originally_published_on</code>,
            <code> original_article_url</code>, <code>teacher_profile_url</code> and a ready-to-use <code>attribution_text</code>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-black text-ink">What is never exposed</h2>
          <p className="mt-1">Drafts, rejected or unpublished articles, private teacher information and any internal moderation data are never returned. Only public, published, republication-enabled content is available.</p>
        </section>

        <section>
          <h2 className="text-lg font-black text-ink">Required attribution</h2>
          <Code>{`Author: {author_name}
Originally published on NOSTOPS
Original article: {canonical_url}
Teacher profile: {teacher_profile_url}`}</Code>
        </section>

        <section className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <h2 className="text-lg font-black text-ink">Prefer copy &amp; paste?</h2>
          <p className="mt-1 text-sm">Every republication-enabled article page offers a live <strong>Embed Code</strong> and a <strong>Copy Article</strong> option. Open any article under <Link href="/voices" className="font-bold text-brand-700 hover:underline">NOSTOPS Voices</Link>.</p>
        </section>
      </div>
    </div>
  );
}
