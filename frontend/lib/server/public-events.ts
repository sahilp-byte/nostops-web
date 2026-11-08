// Public event list shared by /events and the "similar events" row on each
// event page: the indexable feed + the demonstration showcase, built from each
// event's own public record. Loaded at most once per request.
import { cache } from 'react';
import { getPublicEvent, getShowcase, listPublicIndexableEvents, type PublicEvent } from '@/lib/server/institutional';
import { eventIsPast, todayIST } from '@/lib/events/event-landing';

// Over-fetch so hidden (non-public) records can't push real events out.
const MAX_FETCH = 60;

export const loadPublicEvents = cache(async (): Promise<PublicEvent[]> => {
  const [feed, showcase] = await Promise.all([listPublicIndexableEvents(), getShowcase()]);
  const slugs = new Set<string>();
  for (const e of feed) slugs.add(e.slug);
  for (const c of showcase?.cohorts ?? []) for (const o of c.organisations) for (const e of o.events) if (e.slug) slugs.add(e.slug);
  const events = await Promise.all([...slugs].slice(0, MAX_FETCH).map((s) => getPublicEvent(s).catch(() => null)));
  return events.filter((e): e is PublicEvent => !!e && e.visibility === 'PUBLIC');
});

export const byEventDate = (a: PublicEvent, b: PublicEvent) => (a.event_date || '').localeCompare(b.event_date || '');

/**
 * Up to `limit` upcoming events for the row under an event: events from the
 * same kind of organisation first, topped up with other upcoming events.
 * Empty when nothing else is upcoming (the row is then hidden).
 */
export async function similarEvents(ev: PublicEvent, limit = 3): Promise<PublicEvent[]> {
  const today = todayIST();
  const upcoming = (await loadPublicEvents()).filter((e) => e.slug !== ev.slug && !eventIsPast(e, today)).sort(byEventDate);
  const same = upcoming.filter((e) => e.cohort_type === ev.cohort_type);
  const others = upcoming.filter((e) => e.cohort_type !== ev.cohort_type);
  return [...same, ...others].slice(0, limit);
}
