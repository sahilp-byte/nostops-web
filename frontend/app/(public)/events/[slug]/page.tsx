import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { getPublicEvent } from '@/lib/server/institutional';
import { similarEvents } from '@/lib/server/public-events';
import { buildEventJsonLd, eventMetadata } from '@/lib/event-seo';
import EventLanding from '@/components/events/EventLanding';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getPublicEvent(slug).catch(() => null);
  if (!ev) return { title: 'Event', robots: { index: false, follow: false } };
  // The root layout's title template adds " · NOSTOPS" to the tab title.
  // §5 — only PUBLIC + published + verified-org events are indexable;
  // PRIVATE/UNLISTED => noindex + no canonical advertised.
  return eventMetadata(ev, { path: `/events/${ev.slug}`, title: ev.title, indexable: ev.indexable });
}

export default async function PublicEventPage({ params }: Params) {
  const { slug } = await params;
  const ev = await getPublicEvent(slug).catch(() => null);
  if (!ev) notFound();
  // A retired slug (e.g. a demo event's earlier dated URL) → canonical URL.
  if (ev.slug && ev.slug !== slug) permanentRedirect(`/events/${ev.slug}`);

  const path = `/events/${ev.slug}`;
  const url = canonical(path);
  const similar = await similarEvents(ev).catch(() => []);

  // §5 — structured data (only on indexable pages; never thin/noindex pages).
  const eventLd = ev.indexable ? buildEventJsonLd(ev, { url, image: canonical(`/share-card/event/${ev.slug}`) }) : null;
  const breadcrumbLd = ev.indexable ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
      { '@type': 'ListItem', position: 2, name: 'Events', item: canonical('/events') },
      { '@type': 'ListItem', position: 3, name: ev.title, item: url },
    ],
  } : null;

  return (
    <>
      {eventLd && <JsonLd data={eventLd} />}
      {breadcrumbLd && <JsonLd data={breadcrumbLd} />}
      <EventLanding ev={ev} path={path} url={url} similar={similar} />
    </>
  );
}
