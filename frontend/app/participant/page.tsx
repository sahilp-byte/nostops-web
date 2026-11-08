import Link from 'next/link';
import { getParticipantMe, getMyRegistrations, type ParticipantRegistration } from '@/lib/server/participant';
import ParticipantAuthForm from '@/components/participant/ParticipantAuthForm';
import FeedbackForm from '@/components/participant/FeedbackForm';
import SignOutButton from '@/components/participant/SignOutButton';

export const dynamic = 'force-dynamic';

type Params = { searchParams: Promise<{ error?: string; verified?: string; paid?: string }> };

const chip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold';

function statusChip(r: ParticipantRegistration) {
  const b = r.booking_status;
  if (b === 'CONFIRMED') return <span className={`${chip} bg-emerald-50 text-emerald-700`}>✓ Confirmed</span>;
  if (b === 'WAITLISTED') return <span className={`${chip} bg-amber-50 text-amber-800`}>⏳ Waitlisted</span>;
  if (b === 'PENDING_PAYMENT') return <span className={`${chip} bg-amber-50 text-amber-800`}>Payment pending</span>;
  if (b === 'CANCELLED') return <span className={`${chip} bg-cream text-muted`}>Cancelled</span>;
  return <span className={`${chip} bg-cream text-ink-soft`}>{b}</span>;
}

function RegCard({ r }: { r: ParticipantRegistration }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-ink">{r.event_title}</p>
          {r.programme_name && <p className="mt-0.5 text-xs font-semibold text-brand-700">{r.programme_name}{r.programme_taxonomy_label ? ` · ${r.programme_taxonomy_label}` : ''}</p>}
        </div>
        {statusChip(r)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {r.session_id && r.event_date
          ? <span data-testid={`reg-session-${r.registration_id}`}>📅 Session {r.session_seq}{r.session_count ? ` of ${r.session_count}` : ''} · {r.event_date}{r.start_time ? ` · ${r.start_time}` : ''}</span>
          : r.event_date && <span>📅 {r.event_date}{r.start_time ? ` · ${r.start_time}` : ''}</span>}
        {(r.venue || r.city) && <span>📍 {r.venue || r.city}</span>}
        {r.organisation_name && <span>🏢 {r.organisation_name}</span>}
        {r.attendance_status === 'PRESENT' && <span className="font-semibold text-brand-700">✓ Attended</span>}
        {r.pricing_type === 'FREE' && <span className="font-semibold text-emerald-700">Free</span>}
      </div>
    </>
  );
  return (
    <div data-testid={`reg-${r.registration_id}`}>
      {r.event_slug ? (
        <Link href={`/events/${r.event_slug}`} className="block rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-sm">{inner}</Link>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5">{inner}</div>
      )}
      {r.can_feedback && (
        <div className="mt-2"><FeedbackForm eventId={r.event_id} eventTitle={r.event_title} /></div>
      )}
      {r.feedback_given && (
        <p className="mt-2 text-xs font-semibold text-emerald-700" data-testid={`feedback-done-${r.registration_id}`}>
          ★ You rated this {r.feedback_rating}/5 — thank you!
        </p>
      )}
      {r.booking_status === 'PENDING_PAYMENT' && r.event_slug && (
        <Link
          href={`/events/${r.event_slug}/register${r.session_id ? `?session=${encodeURIComponent(r.session_id)}` : ''}`}
          className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
          data-testid={`complete-payment-${r.registration_id}`}
        >
          💳 Complete payment{typeof r.amount === 'number' && r.amount > 0 ? ` · ₹${Math.round(r.amount).toLocaleString('en-IN')}` : ''}
        </Link>
      )}
      {r.can_certificate && (
        <a
          href={`/bff/institutional/participant/certificate/${r.event_id}`}
          className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-brand/40 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50/70"
          data-testid={`certificate-${r.registration_id}`}
        >
          🎓 Download certificate
        </a>
      )}
    </div>
  );
}

export default async function ParticipantDashboard({ searchParams }: Params) {
  const sp = await searchParams;
  const participant = await getParticipantMe();

  if (!participant) {
    return (
      <div className="container-x py-10">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">🧘</div>
            <h1 className="mt-3 text-2xl font-black text-ink">My NOSTOPS Programmes</h1>
            <p className="mt-1 text-sm text-muted">Sign in with your email to see the programmes you&apos;ve registered for.</p>
          </div>
          {sp.error && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700" data-testid="participant-error">
              {sp.error === 'expired' ? 'That link has expired or was already used. Request a new one below.' : 'We could not sign you in. Please request a new link below.'}
            </p>
          )}
          <ParticipantAuthForm heading="Sign in to your programmes" sub="We'll email you a secure one-time link — no password needed." />
        </div>
      </div>
    );
  }

  const regs = await getMyRegistrations();
  const active = regs.filter((r) => r.booking_status !== 'CANCELLED');
  // A session of a repeating programme is "past" once its own day has gone.
  const upcoming = active.filter((r) => (r.session_id
    ? !r.session_past
    : (r.lifecycle_effective || 'PUBLISHED') === 'PUBLISHED' || r.lifecycle_effective === 'LIVE'));
  const past = active.filter((r) => !upcoming.includes(r));

  return (
    <div className="container-x py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-ink">My Programmes</h1>
            <p className="mt-0.5 text-sm text-muted">{participant.name ? `${participant.name} · ` : ''}{participant.email}</p>
          </div>
          <SignOutButton />
        </div>

        {sp.verified && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">✓ Email verified — you&apos;re signed in.</p>
        )}
        {sp.paid && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700" data-testid="paid-banner">✓ Payment received — your registration is confirmed.</p>
        )}

        {active.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center" data-testid="participant-empty">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-3xl">🧘</div>
            <h2 className="mt-3 text-lg font-black text-ink">No registrations yet</h2>
            <p className="mt-1 text-sm text-ink-soft">When you register for a NOSTOPS programme, it will appear here.</p>
            <Link href="/programmes" className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-700">Explore programmes</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-muted">Upcoming</h2>
                <div className="space-y-3">{upcoming.map((r) => <RegCard key={r.registration_id} r={r} />)}</div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-muted">Past</h2>
                <div className="space-y-3">{past.map((r) => <RegCard key={r.registration_id} r={r} />)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
