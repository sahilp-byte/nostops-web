// Event card used on /events and in the "similar events" row. The whole card
// is clickable (title link stretches over it).
import Image from 'next/image';
import Link from 'next/link';
import type { PublicEvent } from '@/lib/server/institutional';
import { eventCopy, eventDateLabel, eventTimeLabel } from '@/lib/events/event-landing';
import { LineIcon } from '@/components/ui/LineIcon';

export default function EventCard({ ev, past }: { ev: PublicEvent; past: boolean }) {
  const copy = eventCopy(ev);
  const time = eventTimeLabel(ev);
  const status = past ? 'Ended' : ev.registration_open ? (ev.is_full ? 'Waitlist open' : 'Registration open') : (ev.registration_status || 'Registration closed');
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2" data-testid={`event-card-${ev.slug}`}>
      <div className="relative aspect-[16/9] w-full">
        <Image src={copy.heroImg} alt={copy.heroAlt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className={`object-cover ${past ? 'grayscale-[35%]' : ''}`} />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink">{ev.programme?.taxonomy_label}</span>
        {ev.demo && <span className="absolute right-3 top-3 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">{ev.demo_label || 'NOSTOPS Demonstration'}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {ev.event_date && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-600">
            <LineIcon name="calendar" className="h-4 w-4" />
            {eventDateLabel(ev.event_date)}{time ? ` · ${time}` : ''}
          </p>
        )}
        <Link href={`/events/${ev.slug}`} className="mt-2 text-base font-extrabold leading-snug text-ink after:absolute after:inset-0 focus-visible:outline-none" data-testid={`event-link-${ev.slug}`}>
          {ev.title}
        </Link>
        <p className="mt-1 text-sm text-ink-soft">{[ev.organisation?.name, ev.city].filter(Boolean).join(' · ')}</p>
        <p className={`mt-auto pt-3 text-xs font-bold ${past ? 'text-muted' : ev.registration_open ? 'text-emerald-700' : 'text-ink-soft'}`}>{status}</p>
      </div>
    </li>
  );
}
