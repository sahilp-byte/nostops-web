// Public event page (founder-approved "Yoga for Stress Resilience — Founders
// Circle Mumbai" layout) used for EVERY event. Server component. Facts (date,
// time, place, status, teacher, registration) come only from the event record;
// framing copy comes from lib/events/event-landing.ts. Registration actions
// appear only while the record says registration is open.
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PublicEvent } from '@/lib/server/institutional';
import { eventCopy, eventDateLabel, eventIsPast, eventTimeLabel } from '@/lib/events/event-landing';
import { formatSessionDate } from '@/lib/org/schedule';
import { PROGRAMME_DEV_NOTE, pendingCouncilReview } from '@/lib/org/programme-status';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import ShareBar from '@/components/app/org/events/ShareBar';
import EventsCta from '@/components/events/EventsCta';
import EventCard from '@/components/events/EventCard';
import OrgLogo from '@/components/events/OrgLogo';
import { LineIcon, type IconKey } from '@/components/ui/LineIcon';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';
const BTN = `inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600 ${FOCUS}`;
const TAG_TINTS = ['bg-royal-50 text-royal', 'bg-brand-50 text-brand-700', 'bg-accent/10 text-accent-600', 'bg-emerald-50 text-emerald-700'];
const BENEFIT_TINTS = [
  { card: 'bg-royal-50/70', icon: 'text-royal' },
  { card: 'bg-accent/10', icon: 'text-accent-600' },
  { card: 'bg-emerald-50/80', icon: 'text-emerald-700' },
];

type Ctx = {
  ev: PublicEvent;
  copy: ReturnType<typeof eventCopy>;
  path: string;
  url: string;
  isDemo: boolean;
  past: boolean;
  recurring: boolean;
  fee: string | null;
};

function Row({ icon, children, testid }: { icon: IconKey; children: ReactNode; testid?: string }) {
  return (
    <div className="flex items-start gap-3 py-3" data-testid={testid}>
      <span className="mt-0.5 shrink-0 text-accent-600"><LineIcon name={icon} className="h-5 w-5" /></span>
      <div className="min-w-0 text-sm text-ink-soft">{children}</div>
    </div>
  );
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <li><Link href="/" className={`inline-flex min-h-11 items-center rounded hover:text-ink ${FOCUS}`}>Home</Link></li>
        <li aria-hidden>›</li>
        <li><Link href="/events" className={`inline-flex min-h-11 items-center rounded hover:text-ink ${FOCUS}`}>Events</Link></li>
        <li aria-hidden>›</li>
        <li aria-current="page" className="font-semibold text-ink-soft">{title}</li>
      </ol>
    </nav>
  );
}

function RegistrationBlock({ ev, path, past, recurring, copy }: Ctx) {
  if (past) {
    return (
      <div data-testid="event-past">
        <div className="flex gap-3 rounded-xl bg-accent/10 p-4">
          <span className="mt-0.5 shrink-0 text-accent-600"><LineIcon name="info" className="h-5 w-5" /></span>
          <div className="text-sm">
            <p className="font-bold text-ink">This event has already taken place.</p>
            <p className="mt-1 text-ink-soft">{copy.pastNote}</p>
          </div>
        </div>
        <Link href="/events" className={`${BTN} mt-4`} data-testid="event-explore-upcoming">
          Explore Upcoming Events <LineIcon name="arrow" className="h-5 w-5" />
        </Link>
      </div>
    );
  }
  if (ev.registration_open) {
    return (
      <div>
        {typeof ev.seats_remaining === 'number' && !ev.is_full && (
          <p className="text-sm font-semibold text-ink">{ev.seats_remaining} seat{ev.seats_remaining === 1 ? '' : 's'} remaining</p>
        )}
        {ev.registration_closing_date && <p className="mt-0.5 text-xs text-muted">Registrations close on {eventDateLabel(ev.registration_closing_date)}</p>}
        <Link href={recurring ? '#sessions' : `${path}/register`} className={`${BTN} mt-4`} data-testid="register-cta">
          {recurring ? 'Choose a session' : ev.is_full ? 'Join the waitlist' : ev.is_free ? 'Register free' : 'Register now'}
          <LineIcon name="arrow" className="h-5 w-5" />
        </Link>
      </div>
    );
  }
  return (
    <div>
      <p className="rounded-xl bg-cream p-4 text-sm font-semibold text-ink" data-testid="register-closed">{ev.registration_status || 'Registration is closed'}</p>
      <Link href="/events" className={`${BTN} mt-4`} data-testid="event-explore-upcoming">
        Explore Upcoming Events <LineIcon name="arrow" className="h-5 w-5" />
      </Link>
    </div>
  );
}

function DetailsCard(c: Ctx) {
  const { ev, isDemo, recurring, fee } = c;
  const org = ev.organisation;
  const time = eventTimeLabel(ev);
  const access = ev.registration_access === 'ORGANISATION_ONLY' && org ? `Open to ${org.name} members only` : null;
  return (
    <div className="relative z-10 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-line" data-testid="event-details-card">
      <div className="flex items-center gap-3">
        <span className="text-accent-600"><LineIcon name="event" className="h-7 w-7" /></span>
        <h2 className="text-base font-bold text-ink">Event details</h2>
        {c.past && <span className="ml-auto rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink-soft ring-1 ring-line" data-testid="event-status-past">Past event</span>}
      </div>
      <div className="mt-2 divide-y divide-line">
        {ev.event_date && (
          <Row icon="calendar" testid="event-date">
            {recurring ? (
              <>
                <p className="font-semibold text-ink">{ev.schedule_label || 'Repeating programme'}</p>
                <p>{formatSessionDate(ev.event_date)}{ev.last_session_date ? ` – ${formatSessionDate(ev.last_session_date)}` : ''}</p>
              </>
            ) : (
              <p className="font-semibold text-ink">{eventDateLabel(ev.event_date)}</p>
            )}
            {time && <p className="mt-0.5" data-testid="event-time">{time}{ev.duration_minutes ? ` · ${ev.duration_minutes} min` : ''}</p>}
          </Row>
        )}
        {(ev.city || ev.venue) && (
          <Row icon="mapPin" testid="event-location">
            <p className="text-base font-bold text-ink">{ev.city || ev.venue}</p>
            {ev.city && ev.venue && <p>{ev.venue}</p>}
          </Row>
        )}
        {org && (
          <Row icon="building" testid="event-organiser">
            <div className="flex items-center gap-2">
              {org.logo_url && <OrgLogo src={org.logo_url} name={org.name} />}
              <p className="font-semibold text-ink">{org.name}</p>
            </div>
            <p className="mt-0.5">
              {isDemo
                ? <span className="font-semibold text-amber-700" data-testid="badge-demo">Demonstration organisation</span>
                : org.verified
                  ? <span className="font-semibold text-emerald-700" data-testid="badge-org-verified">✓ Verified Organisation</span>
                  : 'Organiser'}
              {access ? ` · ${access}` : ''}
            </p>
          </Row>
        )}
        {fee && (
          <Row icon="info">
            <p className="font-semibold text-ink" data-testid="event-fee">{fee} per participant{recurring ? ', per session' : ''}</p>
            <p>Paid online (card or UPI) when you register</p>
          </Row>
        )}
      </div>
      <div className="mt-3">
        <RegistrationBlock {...c} />
      </div>
    </div>
  );
}

function Hero(c: Ctx) {
  const { ev, copy, isDemo } = c;
  return (
    <section aria-labelledby="event-title" className="relative overflow-hidden bg-cream" data-testid="event-hero">
      <div className="relative h-56 sm:h-80 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[60%]">
        <Image src={copy.heroImg} alt={copy.heroAlt} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover object-[25%_center]" />
        <div aria-hidden className="absolute inset-y-0 left-0 hidden w-2/5 bg-gradient-to-r from-cream via-cream/50 to-transparent lg:block" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-cream to-transparent lg:hidden" />
        <span className="absolute bottom-3 right-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-ink-soft" data-testid="event-photo-note">Illustrative photo</span>
      </div>

      <div className="container-x relative pb-10 lg:pb-12">
        <Breadcrumb title={ev.title} />
        <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="lg:max-w-[480px] lg:pb-4 xl:max-w-[500px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-accent-600" data-testid="event-eyebrow">{copy.eyebrow}</span>
              {isDemo && <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">{ev.demo_label || 'NOSTOPS Demonstration'}</span>}
            </div>
            <h1 id="event-title" className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl xl:text-6xl" data-testid="event-heading">
              {copy.heading}
            </h1>
            {copy.tagline && <p className="mt-4 text-xl leading-snug text-ink">{copy.tagline}</p>}
            {copy.intro && <p className="mt-3 text-base leading-relaxed text-ink-soft">{copy.intro}</p>}
            <ul className="mt-5 flex list-none flex-wrap gap-2 p-0" aria-label="Topics" data-testid="event-tags">
              {copy.tags.map((t, i) => (
                <li key={t} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${TAG_TINTS[i % TAG_TINTS.length]}`}>{t}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {ev.programme?.council_curated && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Council-Curated Programme</span>}
              <ProgrammeDevNote programme={ev.programme} />
            </div>
            {isDemo && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800" data-testid="illustrative-banner" role="note">
                <span className="font-bold">Illustrative example.</span> This organisation and event were created by NOSTOPS to show how a programme works end to end. It is not a real organisation.
              </p>
            )}
          </div>
          <DetailsCard {...c} />
        </div>
      </div>
    </section>
  );
}

function ValueRow({ copy }: Ctx) {
  return (
    <section aria-labelledby="event-value-title" className="bg-white" data-testid="event-value">
      <div className="container-x grid gap-4 py-8 sm:grid-cols-3 lg:grid-cols-[1.9fr_1fr_1fr_1fr] lg:py-10">
        <div className="flex flex-col gap-4 rounded-2xl bg-cream/70 p-6 shadow-sm ring-1 ring-line sm:col-span-3 sm:flex-row lg:col-span-1">
          <span className="shrink-0 text-accent-600"><LineIcon name="teacher" className="h-12 w-12" /></span>
          <div>
            <h2 id="event-value-title" className="font-serif text-2xl font-semibold leading-tight text-ink xl:text-[1.75rem]">{copy.valueHeading}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{copy.valueText}</p>
          </div>
        </div>
        {copy.benefits.map((b, i) => (
          <div key={b.title} className={`rounded-2xl p-5 ring-1 ring-line/60 ${BENEFIT_TINTS[i % 3].card}`} data-testid={`event-benefit-${i + 1}`}>
            <div className="flex items-end gap-3">
              <span className={`shrink-0 ${BENEFIT_TINTS[i % 3].icon}`}><LineIcon name={b.icon} className="h-10 w-10" /></span>
              <div className="min-w-0">
                {b.label && <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{b.label}</p>}
                <h3 className="text-base font-bold leading-snug text-ink">{b.title}</h3>
              </div>
            </div>
            {b.text && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{b.text}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function TeacherLine({ ev, isDemo }: Ctx) {
  const name = ev.teacher?.name;
  if (!isDemo && ev.teacher_verified && name) {
    return <><p className="font-bold text-ink">{name}</p><p className="text-xs font-semibold text-emerald-700" data-testid="badge-teacher-verified">✓ Verified NOSTOPS teacher</p></>;
  }
  if (ev.teacher_confirmed && name) {
    return (
      <>
        <p className="font-bold text-ink" data-testid="badge-teacher-confirmed">{name} · Teacher confirmed</p>
        <p className="text-xs text-muted" data-testid="teacher-confirmed-note">NOSTOPS verification not yet complete{isDemo ? ' · Demonstration event' : ''}</p>
      </>
    );
  }
  return <><p className="font-bold text-ink">{ev.teacher_status || 'Teacher being matched'}</p><p className="text-xs text-muted">A NOSTOPS teacher will be matched to this event.</p></>;
}

function LowerGrid(c: Ctx) {
  const { ev, copy } = c;
  const p = ev.programme;
  const format = [
    ev.duration_minutes ? `${ev.duration_minutes}-minute session` : p?.recommended_duration_label,
    ev.capacity ? `Up to ${ev.capacity} participants${c.recurring ? ' per session' : ''}` : null,
    p?.level,
    (p?.languages?.length ? p.languages.join(', ') : ev.language) || null,
  ].filter(Boolean) as string[];
  const card = 'rounded-2xl bg-white p-6 shadow-sm ring-1 ring-line';
  return (
    <section aria-label="About this session" className="bg-white" data-testid="event-lower">
      <div className="container-x grid gap-5 pb-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1.1fr_1fr]">
        <div className={card} data-testid="event-about-session">
          <h2 className="font-serif text-xl font-semibold text-ink">About the Teacher-Led Session</h2>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
            <span aria-hidden className="grid h-28 w-28 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-600">
              <LineIcon name="teacher" className="h-14 w-14" />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-ink-soft">{copy.about}</p>
              <div className="mt-3 text-sm" data-testid="event-teacher"><TeacherLine {...c} /></div>
              <Link href="/teachers" className={`mt-2 inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-bold text-brand-700 hover:underline ${FOCUS}`}>
                About our Teachers <LineIcon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className={card} data-testid="event-what-to-expect">
          <h2 className="font-serif text-xl font-semibold text-ink">What to Expect</h2>
          <p className="mt-1 text-xs text-muted">From the Council-curated programme “{p?.name}”</p>
          {p?.objectives?.length ? (
            <ol className="relative mt-4 list-none space-y-4 border-l-2 border-accent/25 p-0 pl-5">
              {p.objectives.map((o) => (
                <li key={o} className="relative text-sm text-ink">
                  <span aria-hidden className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-accent-600 ring-4 ring-white" />
                  {o}
                </li>
              ))}
            </ol>
          ) : null}
          {format.length > 0 && (
            <ul className="mt-5 flex list-none flex-wrap gap-1.5 p-0" aria-label="Session format">
              {format.map((f) => <li key={f} className="rounded-md bg-cream px-2.5 py-1 text-xs font-semibold text-ink-soft">{f}</li>)}
            </ul>
          )}
          {pendingCouncilReview(p) && <p className="mt-3 text-xs text-muted">{PROGRAMME_DEV_NOTE}</p>}
        </div>

        <div className={`${card} md:col-span-2 lg:col-span-1`} data-testid="event-audience">
          <h2 className="font-serif text-xl font-semibold text-ink">Who Is This For?</h2>
          <ul className="mt-4 list-none space-y-3.5 p-0">
            {copy.audience.map((a) => (
              <li key={a.text} className="flex items-start gap-3 text-sm text-ink-soft">
                <span className="shrink-0 text-accent-600"><LineIcon name={a.icon} className="h-6 w-6" /></span>
                <span className="pt-0.5">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Sessions({ ev, path }: Ctx) {
  const sessions = ev.sessions || [];
  const upcoming = sessions.filter((s) => !s.is_past);
  const pastCount = sessions.length - upcoming.length;
  const time = eventTimeLabel(ev);
  return (
    <section id="sessions" className="container-x scroll-mt-24 pb-12" data-testid="event-sessions">
      <h2 className="font-serif text-xl font-semibold text-ink">Sessions</h2>
      <p className="mt-1 text-xs text-muted">Register for each session you want to attend — registering for one session doesn&rsquo;t book the others.</p>
      {upcoming.length > 0 ? (
        <ul className="mt-3 list-none overflow-hidden rounded-2xl border border-line bg-white p-0">
          {upcoming.map((s, i) => (
            <li key={s.session_id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`} data-testid={`session-row-${s.seq}`}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Session {s.seq} · {formatSessionDate(s.date)}</p>
                <p className="text-xs text-muted">
                  {time || 'Time TBC'}
                  {s.is_full ? ' · Full' : typeof s.seats_remaining === 'number' ? ` · ${s.seats_remaining} seat${s.seats_remaining === 1 ? '' : 's'} left` : ''}
                </p>
              </div>
              {ev.registration_open ? (
                <Link href={`${path}/register?session=${encodeURIComponent(s.session_id)}`} data-testid={`session-register-${s.seq}`}
                  className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-brand px-4 text-xs font-bold text-white transition hover:bg-brand-700">
                  {s.is_full ? 'Join waitlist' : 'Register'}
                </Link>
              ) : (
                <span className="shrink-0 text-xs font-semibold text-muted">Closed</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-white p-4 text-sm text-muted">All sessions have taken place.</p>
      )}
      {pastCount > 0 && upcoming.length > 0 && (
        <p className="mt-2 text-xs text-muted">{pastCount} earlier session{pastCount === 1 ? ' has' : 's have'} already taken place.</p>
      )}
    </section>
  );
}

function MoreAbout({ ev, url }: Ctx) {
  const org = ev.organisation;
  return (
    <section aria-label="More about this event" className="border-t border-line bg-white">
      <div className="container-x grid gap-6 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {ev.space && (
            <div id="space" data-testid="event-space-host">
              <h2 className="font-serif text-xl font-semibold text-ink">Hosted at a NOSTOPS Space</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {ev.space.name}{ev.space.locality ? `, ${ev.space.locality}` : ''}{ev.space.district ? `, ${ev.space.district}` : ''}{ev.space.state ? `, ${ev.space.state}` : ''}.
                {' '}A NOSTOPS Spaces programme led by a verified NOSTOPS teacher. Any arrangement between the teacher and the Space is private and separate from your registration.
              </p>
              <a href={`/spaces/${ev.space.id}`} className="mt-2 inline-block text-sm font-bold text-brand-700">About this Space</a>
            </div>
          )}
          {org && (
            <div id="organisation" data-testid="event-organisation">
              <h2 className="font-serif text-xl font-semibold text-ink">About the Organisation</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{org.description || `${org.name} is hosting this NOSTOPS programme.`}</p>
            </div>
          )}
          <div id="suitability" className="rounded-2xl border border-line bg-cream/60 p-4" data-testid="suitability-note">
            <h2 className="text-sm font-black text-ink">Is this programme right for you?</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Not every programme suits every participant. If you have pain, an injury, a health condition or are pregnant, check with your healthcare professional first and tell the teacher before the session. Yoga teachers do not replace medical care.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <ShareBar url={url} title={ev.title} />
          <Link href="/programmes" className="block rounded-2xl border border-line bg-cream p-4 text-center text-sm font-bold text-brand-700 hover:bg-brand-50">Explore more NOSTOPS programmes →</Link>
        </div>
      </div>
    </section>
  );
}

const KIND_LABEL: Record<string, string> = {
  COMPANY: 'companies',
  EDUCATIONAL_INSTITUTION: 'campuses',
  STARTUP_NETWORK: 'founder and startup groups',
};

// 2–3 upcoming events: same kind of organisation first, then other upcoming events.
function SimilarEvents({ ev, similar }: { ev: PublicEvent; similar: PublicEvent[] }) {
  if (!similar.length) return null;
  const kind = ev.cohort_type ? KIND_LABEL[ev.cohort_type] : undefined;
  const matches = similar.filter((e) => e.cohort_type === ev.cohort_type).length;
  const note = !kind || !matches
    ? null
    : matches === similar.length
      ? `More upcoming events from ${kind}.`
      : `Events from ${kind} first, then other upcoming NOSTOPS events.`;
  return (
    <section aria-labelledby="similar-title" className="border-t border-line bg-cream/50" data-testid="event-similar">
      <div className="container-x py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="similar-title" className="font-serif text-2xl font-semibold text-ink">{matches ? 'Similar upcoming events' : 'Other upcoming events'}</h2>
            {note && <p className="mt-1 text-sm text-ink-soft" data-testid="event-similar-note">{note}</p>}
          </div>
          <Link href="/events" className={`inline-flex min-h-11 items-center rounded text-sm font-bold text-brand-700 hover:underline ${FOCUS}`} data-testid="event-similar-all">See all events →</Link>
        </div>
        <ul className="mt-5 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {similar.map((e) => <EventCard key={e.slug} ev={e} past={false} />)}
        </ul>
      </div>
    </section>
  );
}

export default function EventLanding({ ev, path, url, similar = [] }: { ev: PublicEvent; path: string; url: string; similar?: PublicEvent[] }) {
  const recurring = ev.schedule?.type === 'RECURRING' && Array.isArray(ev.sessions);
  const c: Ctx = {
    ev,
    copy: eventCopy(ev),
    path,
    url,
    isDemo: !!ev.demo,
    past: eventIsPast(ev),
    recurring,
    // Paid programme: the organiser's per-participant fee (per session when repeating).
    fee: ev.pricing_type === 'PAID' && typeof ev.participant_fee === 'number' && ev.participant_fee > 0
      ? `₹${Math.round(ev.participant_fee).toLocaleString('en-IN')}` : null,
  };
  return (
    <div data-guru-cohort={ev.cohort_type || undefined}>
      <Hero {...c} />
      <ValueRow {...c} />
      <LowerGrid {...c} />
      {recurring && <Sessions {...c} />}
      <MoreAbout {...c} />
      <SimilarEvents ev={ev} similar={similar} />
      <EventsCta />
    </div>
  );
}
