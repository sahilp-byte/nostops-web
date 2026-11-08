import { JsonLd } from '@/components/JsonLd';
import { canonical } from '@/lib/site';

export type Crumb = { name: string; path: string };

/**
 * Server-rendered BreadcrumbList structured data (no visual output). Every
 * `path` is resolved to its canonical www URL. Drop this on pages that lack a
 * breadcrumb trail so search engines and AI answer-engines understand where the
 * page sits in the NOSTOPS hierarchy.
 */
export function BreadcrumbJsonLd({ trail }: { trail: Crumb[] }) {
  if (!trail.length) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: canonical(t.path),
    })),
  };
  return <JsonLd data={data} />;
}
