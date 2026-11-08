import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicEvent } from '@/lib/server/institutional';
import { formatSessionDate } from '@/lib/org/schedule';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import { PROGRAMME_DEV_NOTE, pendingCouncilReview } from '@/lib/org/programme-status';
import { getParticipantMe, getMyRegistrations } from '@/lib/server/participant';
import ParticipantAuthForm from '@/components/participant/ParticipantAuthForm';
import ParticipantRegisterForm from '@/components/participant/ParticipantRegisterForm';
import ParticipantPayStep from '@/components/participant/ParticipantPayStep';
import { eventMetadata } from '@/lib/event-seo';
import SpaceRegisterView from '@/components/spaces/SpaceRegisterView';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ session?: string }> };

// Same share preview as the event page; the Register page itself is never indexed.
export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getPublicEvent(slug).catch(() => null);
  if (!ev) return { title: 'Register', robots: { index: false, follow: false } };
  return eventMetadata(ev, { path: `/events/${ev.slug}/register`, title: `Register for ${ev.title}`, indexable: false });
}

function typeForCohort(c?: string): string {
  if (c === 'EDUCATIONAL_INSTITUTION') return 'STUDENT';
  if (c === 'STARTUP_NETWORK') return 'MEMBER';
  if (c === 'COMPANY') return 'EMPLOYEE';
  return 'OTHER';
}

const chip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold';

export default async function EventRegisterPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { session: sessionParam } = await searchParams;
  const ev = await getPublicEvent(slug).catch(() => null);
  if (!ev) notFound();
  // Phase 6 — NOSTOPS Spaces programmes use their own individual registration (signed-in NOSTOPS account).
  if ((ev as { host_kind?: string }).host_kind === 'SPACE') {
    if (ev.slug && ev.slug !== slug) permanentRedirect(`/events/${ev.slug}/register`);
    return <SpaceRegisterView ev={ev} />;
  }
  if (ev.slug && ev.slug !== slug) {
    permanentRedirect(`/events/${ev.slug}/register${sessionParam ? `?session=${encodeURIComponent(sessionParam)}` : ''}`);
  }

  // B2.2 — a repeating programme is booked one session at a time.
  const recurring = ev.schedule?.type === 'RECURRING' && Array.isArray(ev.sessions);
  const upcoming = (ev.sessions || []).filter((s) => !s.is_past);
  const session = recurring ? upcoming.find((s) => s.session_id === sessionParam) || null : null;
  const needsSession = recurring && !session;
  const sessionLabel = session
    ? `Session ${session.seq} of ${ev.sessions!.length} · ${formatSessionDate(session.date)}${ev.start_time ? ` · ${ev.start_time}` : ''}`
    : null;

  const participant = await getParticipantMe();
  let existing = null;
  if (participant && !needsSession) {
    const regs = await getMyRegistrations();
    existing = regs.find((r) => r.event_id === ev.event_id && (r.session_id || null) === (session?.session_id || null)) || null;
  }
  const alreadyRegistered = !!existing && existing.booking_status !== 'CANCELLED' && existing.booking_status !== 'PENDING_PAYMENT';
  const pendingPayment = !!existing && existing.booking_status === 'PENDING_PAYMENT';
  const regOpen = ev.registration_open !== false;

  return (
    <div className="container-x py-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
          <Link href="/programmes" className="hover:text-ink">Programmes</Link><span>/</span>
          <Link href={`/events/${ev.slug}`} className="hover:text-ink">{ev.title}</Link><span>/</span>
          <span className="font-semibold text-ink-soft">Register</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Event summary */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-line bg-gradient-to-br from-brand/10 via-cream to-white p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${chip} bg-brand-50 text-brand-700`}>✓ Council-Curated</span>
                {ev.programme?.taxonomy_label && <span className={`${chip} bg-cream text-ink-soft`}>{ev.programme.taxonomy_label}</span>}
                <ProgrammeDevNote programme={ev.programme} />
                {ev.is_free && <span className={`${chip} bg-emerald-50 text-emerald-700`}>Free</span>}
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Register for {ev.title}</h1>
              {ev.organisation && (
                <p className="mt-1 text-sm text-ink-soft">
                  Organised by <span className="font-bold text-ink">{ev.organisation.name}</span> · Powered by <span className="font-bold text-brand-700">NOSTOPS</span>
                </p>
              )}
            </div>

            <div className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
              <Fact icon="📅"
                title={session ? formatSessionDate(session.date) : recurring ? (ev.schedule_label || 'Repeating programme') : (ev.event_date || 'Date to be announced')}
                sub={[ev.start_time, ev.end_time].filter(Boolean).join(' – ') || 'Timing TBC'} />
              <Fact icon="📍" title={ev.venue || ev.city || '—'} sub={ev.city || undefined} />
              <Fact icon="🌐" title={ev.language || 'English'} sub="Language" />
              {ev.pricing_type === 'PAID' && typeof ev.participant_fee === 'number' && ev.participant_fee > 0 && (
                <Fact icon="💳" title={`₹${Math.round(ev.participant_fee).toLocaleString('en-IN')}${recurring ? ' per session' : ''}`}
                  sub="Paid online (card or UPI) when you register" />
              )}
              <Fact
                icon="👥"
                title={session
                  ? (typeof session.seats_remaining === 'number' ? `${session.seats_remaining} seats left` : 'Open capacity')
                  : typeof ev.seats_remaining === 'number' ? `${ev.seats_remaining} seats left` : (ev.capacity ? `${ev.capacity} participants` : 'Open capacity')}
                sub={ev.capacity ? `Capacity ${ev.capacity}${recurring ? ' per session' : ''}` : undefined}
              />
            </div>

            {ev.programme?.essence && (
              <div className="rounded-2xl border border-line bg-white p-5">
                <h2 className="text-sm font-black uppercase tracking-wider text-muted">About the programme</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{ev.programme.essence}</p>
              </div>
            )}

            <p className="text-center text-xs text-muted sm:text-left">
              ✓ Council-Curated programme{pendingCouncilReview(ev.programme) ? ` · ${PROGRAMME_DEV_NOTE}` : ''}.{' '}
              <Link href="/trust" className="font-semibold text-brand-700 hover:underline">See how NOSTOPS verifies teachers &amp; organisations →</Link>
            </p>
          </div>

          {/* Action card */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {pendingPayment ? (
              <ParticipantPayStep
                registrationId={existing!.registration_id}
                eventTitle={ev.title}
                amount={existing!.amount ?? ev.participant_fee}
                currency={existing!.currency || 'INR'}
              />
            ) : alreadyRegistered ? (
              <div className="rounded-2xl border border-line bg-white p-6 text-center" data-testid="already-registered">
                <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-3xl ${existing!.booking_status === 'WAITLISTED' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  {existing!.booking_status === 'WAITLISTED' ? '⏳' : '✓'}
                </div>
                <h3 className="mt-3 text-lg font-black text-ink">
                  {existing!.booking_status === 'WAITLISTED' ? "You're on the waitlist" : "You're already registered"}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {sessionLabel ? `${sessionLabel} is saved to your NOSTOPS account.` : <>We&apos;ve saved this programme to your NOSTOPS account.</>}
                </p>
                <Link href="/participant" className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-700" data-testid="go-dashboard">
                  View my programmes
                </Link>
                {recurring && (
                  <Link href={`/events/${ev.slug}#sessions`} className="mt-3 block text-sm font-bold text-brand-700 hover:underline" data-testid="book-another-session">
                    Book another session →
                  </Link>
                )}
              </div>
            ) : !regOpen ? (
              <div className="rounded-2xl border border-line bg-white p-6 text-center" data-testid="registration-closed">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cream text-2xl">🔒</div>
                <h3 className="mt-3 text-lg font-black text-ink">{ev.registration_status || 'Registration is closed'}</h3>
                <p className="mt-1 text-sm text-ink-soft">Registration for this event is not open right now.</p>
                <Link href="/programmes" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">Explore other programmes →</Link>
              </div>
            ) : needsSession ? (
              <div className="rounded-2xl border border-line bg-white p-6" data-testid="session-picker">
                <h3 className="text-lg font-black text-ink">Choose a session</h3>
                <p className="mt-1 text-sm text-ink-soft">This programme repeats — register for each session you want to attend.</p>
                {upcoming.length > 0 ? (
                  <ul className="mt-4 space-y-2 p-0">
                    {upcoming.map((s) => (
                      <li key={s.session_id}>
                        <Link href={`/events/${ev.slug}/register?session=${encodeURIComponent(s.session_id)}`} data-testid={`pick-session-${s.seq}`}
                          className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-line px-4 py-2 text-sm transition hover:border-brand hover:bg-brand-50">
                          <span className="font-bold text-ink">Session {s.seq} · {formatSessionDate(s.date)}</span>
                          <span className="shrink-0 text-xs text-muted">{s.is_full ? 'Full · waitlist' : typeof s.seats_remaining === 'number' ? `${s.seats_remaining} left` : 'Open'}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted">There are no upcoming sessions.</p>
                )}
              </div>
            ) : participant ? (
              <ParticipantRegisterForm
                event={{
                  slug: ev.slug, title: ev.title, is_free: ev.is_free, is_full: session ? session.is_full : ev.is_full,
                  pricing_type: ev.pricing_type, participant_fee: ev.participant_fee,
                  session_id: session?.session_id || null, session_label: sessionLabel,
                }}
                participantName={participant.name}
                participantEmail={participant.email}
                defaultType={typeForCohort(ev.cohort_type)}
              />
            ) : (
              <ParticipantAuthForm
                eventSlug={ev.slug}
                sessionId={session?.session_id || null}
                heading={sessionLabel ? `Register for ${sessionLabel}` : `Register for ${ev.title}`}
                sub="Enter your email and we'll send a secure one-time link to confirm — no password needed."
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden className="text-lg">{icon}</span>
      <div><p className="text-sm font-bold text-ink">{title || '—'}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
    </div>
  );
}
