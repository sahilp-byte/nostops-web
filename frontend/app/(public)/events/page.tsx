// Events directory (/events): upcoming public events first, past events below.
// Sources: the public (indexable) event feed + the permanent demonstration
// showcase; every card is built from the event's own public record.
import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { byEventDate, loadPublicEvents } from '@/lib/server/public-events';
import { eventIsPast, todayIST } from '@/lib/events/event-landing';
import EventCard from '@/components/events/EventCard';
import EventsCta from '@/components/events/EventsCta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Yoga Events',
  description: 'Upcoming NOSTOPS yoga events for companies, campuses and founder communities — Council-curated programmes led by NOSTOPS teachers.',
  path: '/events',
});

const MAX_EVENTS = 24;

export default async function EventsPage() {
  const events = await loadPublicEvents();
  const today = todayIST();
  const upcoming = events.filter((e) => !eventIsPast(e, today)).sort(byEventDate).slice(0, MAX_EVENTS);
  const past = events.filter((e) => eventIsPast(e, today)).sort((a, b) => byEventDate(b, a)).slice(0, MAX_EVENTS);
  const hasDemo = events.some((e) => e.demo);

  return (
    <>
      <section className="bg-cream">
        <div className="container-x pb-10 pt-4">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <li><Link href="/" className="inline-flex min-h-11 items-center rounded hover:text-ink">Home</Link></li>
              <li aria-hidden>›</li>
              <li aria-current="page" className="font-semibold text-ink-soft">Events</li>
            </ol>
          </nav>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-accent-600">NOSTOPS Events</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Yoga Events</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Council-curated yoga programmes hosted by companies, campuses and founder communities, led by NOSTOPS teachers.
          </p>
          {hasDemo && (
            <p className="mt-4 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800" data-testid="events-demo-note">
              Events marked <span className="font-bold">NOSTOPS Demonstration</span> are illustrative examples created by NOSTOPS to show how a programme works end to end.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="upcoming-title" className="container-x py-10" data-testid="events-upcoming">
        <h2 id="upcoming-title" className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Upcoming events</h2>
        {upcoming.length ? (
          <ul className="mt-5 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((ev) => <EventCard key={ev.slug} ev={ev} past={false} />)}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted" data-testid="events-upcoming-empty">
            No upcoming public events right now. Organisations can create one with <Link href="/programmes" className="font-bold text-brand-700 hover:underline">a Council-curated programme</Link>.
          </p>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-title" className="container-x pb-12" data-testid="events-past">
          <h2 id="past-title" className="font-serif text-2xl font-semibold text-ink">Past events</h2>
          <ul className="mt-5 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((ev) => <EventCard key={ev.slug} ev={ev} past />)}
          </ul>
        </section>
      )}

      <EventsCta showAll={false} />
    </>
  );
}
