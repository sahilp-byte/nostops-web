// Server-side RSS 2.0 builder for Teacher Pulse public feeds.
import 'server-only';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export type RssItem = { title: string; link: string; author?: string; category?: string; date?: number; description?: string };

// Resolve the public-facing origin for absolute feed links. Prefers the proxy's
// forwarded host (correct in both preview and production), then NEXT_PUBLIC_SITE_URL,
// then the internal request origin as a last resort.
export function resolveOrigin(headers: Headers, fallbackOrigin: string): string {
  const host = headers.get('x-forwarded-host') || headers.get('host') || '';
  if (host && !/^(0\.0\.0\.0|localhost|127\.|\[::)/.test(host)) {
    const proto = headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`;
  }
  const env = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  return env ? env.replace(/\/$/, '') : fallbackOrigin;
}

export function buildRss(opts: { title: string; description: string; feedUrl: string; siteUrl: string; items: RssItem[] }): string {
  const items = opts.items.map((i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      <guid isPermaLink="true">${esc(i.link)}</guid>${i.author ? `\n      <dc:creator>${esc(i.author)}</dc:creator>` : ''}${i.category ? `\n      <category>${esc(i.category)}</category>` : ''}
      <pubDate>${new Date(i.date || Date.now()).toUTCString()}</pubDate>
      <description>${esc(i.description || '')}</description>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(opts.title)}</title>
    <link>${esc(opts.siteUrl)}</link>
    <atom:link href="${esc(opts.feedUrl)}" rel="self" type="application/rss+xml"/>
    <description>${esc(opts.description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
