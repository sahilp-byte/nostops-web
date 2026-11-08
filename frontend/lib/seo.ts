import type { Metadata } from 'next';
import { canonical, toWww } from '@/lib/site';

export type BackendMeta = Record<string, string>;

// JSON-LD keys whose *values* are URLs and are therefore safe to normalize to
// the canonical www origin. Free-text keys (name, description, headline, etc.)
// are never touched.
const URL_KEYS = new Set([
  'url',
  '@id',
  'logo',
  'image',
  'contenturl',
  'thumbnailurl',
  'sameas',
  'significantlink',
  'mainentityofpage',
  'item',
  'target',
  'embedurl',
]);

function normalizeUrlValue(v: any): any {
  if (typeof v === 'string') return toWww(v);
  if (Array.isArray(v)) return v.map(normalizeUrlValue);
  if (v && typeof v === 'object') return normalizeJsonLdNode(v);
  return v;
}

function normalizeJsonLdNode(node: any): any {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(normalizeJsonLdNode);
  if (typeof node !== 'object') return node;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(node)) {
    if (URL_KEYS.has(k.toLowerCase())) {
      out[k] = normalizeUrlValue(v);
    } else if (v && typeof v === 'object') {
      out[k] = normalizeJsonLdNode(v); // recurse to reach nested URL keys
    } else {
      out[k] = v; // leave plain strings (descriptions/names) untouched
    }
  }
  return out;
}

/**
 * Normalize every NOSTOPS-origin URL inside one or more JSON-LD blocks to the
 * canonical www origin: `url`, `@id`, breadcrumb `item` URLs, `image`/`logo`
 * URLs, etc. Non-NOSTOPS URLs are left as-is because toWww() only rewrites the
 * bare `nostops.org` host. Free-text fields are never modified.
 */
export function normalizeJsonLd<T = any>(data: T): T {
  return normalizeJsonLdNode(data) as T;
}

/**
 * Convert the backend SEO `meta` object (title, description, canonical, and the
 * og and twitter fields) into a Next.js Metadata object so the document head is
 * populated server-side.
 */
export function metaToMetadata(meta: BackendMeta = {}): Metadata {
  const md: Metadata = {};
  if (meta.title) md.title = { absolute: meta.title };
  if (meta.description) md.description = meta.description;
  if (meta.canonical) md.alternates = { canonical: toWww(meta.canonical) };

  const og: Record<string, any> = {};
  if (meta['og:title']) og.title = meta['og:title'];
  if (meta['og:description']) og.description = meta['og:description'];
  if (meta['og:url']) og.url = toWww(meta['og:url']);
  if (meta['og:type']) og.type = meta['og:type'];
  if (meta['og:site_name']) og.siteName = meta['og:site_name'];
  if (meta['og:image']) og.images = [toWww(meta['og:image'])];
  if (Object.keys(og).length) md.openGraph = og;

  const tw: Record<string, any> = {};
  if (meta['twitter:card']) tw.card = meta['twitter:card'];
  if (meta['twitter:title']) tw.title = meta['twitter:title'];
  if (meta['twitter:description']) tw.description = meta['twitter:description'];
  if (meta['twitter:image']) tw.images = [toWww(meta['twitter:image'])];
  if (Object.keys(tw).length) md.twitter = tw;

  return md;
}

// Default branded Open Graph card (1200×630). IMPORTANT: once a page declares
// its own `openGraph`, Next.js does NOT inherit the root layout's OG image — the
// child must re-supply `images`. Use this helper so every page keeps a relevant
// OG image (pass a page-specific src when one exists, else the branded default).
export const DEFAULT_OG_IMAGE = '/brand/og-card.png';

export function ogImages(
  src?: string,
  alt = 'NOSTOPS — India’s Teacher-First Yoga Cooperative',
): { url: string; width: number; height: number; alt: string }[] {
  return [{ url: src || DEFAULT_OG_IMAGE, width: 1200, height: 630, alt }];
}

// ── Phase 3 page conventions ────────────────────────────────────────────────
// Titles: "Page name · NOSTOPS" (root template). Descriptions: 50–160 chars.
export const DESC_MIN = 50;
export const DESC_MAX = 160;

/**
 * Fit a meta description to 50–160 characters. Text that is too short gets the
 * page-specific `context` sentence appended; text that is too long is cut at a
 * word boundary with an ellipsis. Whitespace is collapsed.
 */
export function fitDescription(text: string | null | undefined, context?: string): string {
  let d = (text || '').replace(/\s+/g, ' ').trim();
  if (d.length < DESC_MIN && context) d = d ? `${d.replace(/[.\s]+$/, '')}. ${context}` : context;
  if (d.length <= DESC_MAX) return d;
  const cut = d.slice(0, DESC_MAX - 1);
  const i = cut.lastIndexOf(' ');
  return `${(i > 80 ? cut.slice(0, i) : cut).replace(/[\s,;:.–—(-]+$/, '')}…`;
}

export type PageSeo = {
  /** Page name; the root template renders "<title> · NOSTOPS". */
  title: string;
  description: string;
  /** Site-relative path. The canonical is ALWAYS the www URL of this path. */
  path: string;
  /** 1200×630 share image + alt text. Defaults to the branded NOSTOPS card. */
  image?: { url: string; alt: string };
  type?: 'website' | 'article';
};

/** Typed metadata for an indexable public page: self www canonical, fitted
 *  description, and og:image + twitter:image (1200×630, with alt) always set. */
export function pageMetadata({ title, description, path, image, type = 'website' }: PageSeo): Metadata {
  const url = canonical(path);
  const desc = fitDescription(description);
  const images = ogImages(image?.url, image?.alt);
  const full = `${title} · NOSTOPS`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { type, siteName: 'NOSTOPS', url, title: full, description: desc, images },
    twitter: { card: 'summary_large_image', title: full, description: desc, images: images.map((i) => i.url) },
  };
}
