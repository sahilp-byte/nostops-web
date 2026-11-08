// Pure helpers for the public robots.txt and sitemap.xml feeds.
//
// The FastAPI backend emits the non-www origin (https://nostops.org) and points
// robots at the internal /api/seo/sitemap.xml path. The public website must
// serve the canonical www origin and its own /sitemap.xml. We normalize here,
// at the website layer, WITHOUT modifying the backend.
//
// Canonical origin comes from lib/site.ts — we never introduce a competing
// SITE_URL constant.
import { canonical } from '@/lib/site';

// The one and only public sitemap URL advertised in robots.txt.
export const PUBLIC_SITEMAP_URL = canonical('/sitemap.xml'); // https://www.nostops.org/sitemap.xml

/**
 * The public robots.txt is WEBSITE-OWNED (not inherited from the backend).
 * Phase 4 policy:
 *  - preview hosts: `Disallow: /` for everyone (pages also send X-Robots-Tag
 *    noindex there, see next.config.mjs);
 *  - production: search engines and AI search / answer agents may crawl every
 *    public page; only the backend API, the BFF, the app shell and the admin
 *    console are disallowed. Bots and control tokens that only collect
 *    AI-training data are disallowed entirely.
 * A single canonical www Sitemap line is advertised on production.
 */
export function buildRobotsTxt({ preview = false }: { preview?: boolean } = {}): string {
  if (preview) return 'User-agent: *\nDisallow: /\n';
  const DISALLOW = ['/api/', '/bff/', '/app/', '/admin/'];
  // robots.txt groups do NOT inherit, so each allowed agent repeats the
  // private-area Disallows. Agents not listed fall under `*`.
  const ALLOWED = [
    '*', // every other crawler
    // Conventional search
    'Googlebot',
    'Googlebot-Image',
    'Bingbot',
    'DuckDuckBot',
    'Applebot',
    // AI search / answer engines (citation) and user-triggered fetchers
    'OAI-SearchBot',
    'ChatGPT-User',
    'PerplexityBot',
    'Perplexity-User',
    'Claude-SearchBot',
    'Claude-User',
  ];
  // AI-training crawlers and opt-out tokens (Google-Extended / Applebot-Extended
  // do not affect Google Search or Apple search results).
  const TRAINING = [
    'GPTBot',
    'ClaudeBot',
    'Google-Extended',
    'Applebot-Extended',
    'Amazonbot',
    'Meta-ExternalAgent',
    'Bytespider',
    'CCBot',
  ];
  const groups = [
    ...ALLOWED.map((ua) => [`User-agent: ${ua}`, 'Allow: /', ...DISALLOW.map((d) => `Disallow: ${d}`)].join('\n')),
    ...TRAINING.map((ua) => `User-agent: ${ua}\nDisallow: /`),
  ];
  return `${groups.join('\n\n')}\n\nSitemap: ${PUBLIC_SITEMAP_URL}\n`;
}
