import Link from 'next/link';
import type { PublicEvent } from '@/lib/server/institutional';
import { getSessionUser } from '@/lib/server/session';
import { getMySpaceRegistrations } from '@/lib/server/space-registrations';
import { SPACE_MODELS } from '@/lib/spaces';
import SpaceRegisterPanel from '@/components/spaces/SpaceRegisterPanel';
import { fmtDateLong } from '@/lib/format';

// Phase 6 — the register page for a NOSTOPS Spaces programme (individual participants).
export default async function SpaceRegisterView({ ev }: { ev: PublicEvent }) {
  const user = await getSessionUser();
  const mine = user ? await getMySpaceRegistrations() : [];
  const active = mine.find((r) => r.event_id === ev.event_id && (r.status === 'CONFIRMED' || r.status === 'PENDING_PAYMENT'));
  const paid = ev.pricing_type === 'PAID' && typeof ev.participant_fee === 'number' && ev.participant_fee > 0;
  const model = ev.space?.model ? SPACE_MODELS[ev.space.model] : undefined;
  const fact = (icon: string, title: string, sub?: string) => (
    <div className="flex items-start gap-2"><span aria-hidden className="text-xl">{icon}</span><div><p className="text-sm font-bold text-ink">{title}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div></div>
  );
  return (
    <div className="bg-cream/40">
      <div className="container-x py-6 sm:py-10" data-testid="space-register-page">
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
          <Link href="/programmes" className="hover:text-ink">Programmes</Link><span>›</span>
          <Link href={`/events/${ev.slug}`} className="hover:text-ink">{ev.title}</Link><span>›</span>
          <span className="font-semibold text-ink-soft">Register</span>
        </nav>
        <header className="mb-6 flex items-start gap-3">
          <span aria-hidden className="text-4xl">🧘</span>
          <div>
            <h1 className="font-serif text-3xl font-semibold text-brand-700">Register for this Programme</h1>
            <p className="mt-1 text-ink-soft">Join this programme at a verified NOSTOPS Space, led by a verified NOSTOPS teacher.</p>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-line bg-white p-6">
              <h2 className="font-serif text-2xl font-semibold text-brand-700">{ev.title}</h2>
              {ev.subtitle && <p className="mt-1 text-sm text-ink-soft">{ev.subtitle}</p>}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {fact('📅', ev.event_date ? fmtDateLong(ev.event_date) : 'Date to be announced', [ev.start_time, ev.end_time].filter(Boolean).join(' – ') || undefined)}
                {fact('👥', `${ev.seats_remaining ?? 0} places left`, ev.capacity ? `Capacity ${ev.capacity}` : undefined)}
                {fact('📍', ev.space?.name || 'NOSTOPS Space', [ev.space?.locality, ev.space?.district, ev.space?.state].filter(Boolean).join(', '))}
                {fact('🌐', ev.language || 'English', 'Language')}
              </div>
              {ev.programme?.taxonomy_label && <span className="mt-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase text-brand-700">{ev.programme.taxonomy_label}</span>}
            </section>
            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-line bg-white p-5" data-testid="space-register-venue">
                <h3 className="font-serif text-lg font-semibold text-brand-700">Venue & Participation Model</h3>
                <p className="mt-2 font-bold text-ink">{ev.space?.name}</p>
                <p className="text-sm text-ink-soft">{[ev.space?.locality, ev.space?.district, ev.space?.state].filter(Boolean).join(', ')}</p>
                {model && <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${model.tone}`}>{model.label}</span>}
                <p className="mt-3 text-xs text-muted">Hosted at a NOSTOPS Space. Any arrangement between the teacher and the Space is private and is not part of your registration.</p>
              </div>
              <div className="rounded-3xl border border-line bg-white p-5">
                <h3 className="font-serif text-lg font-semibold text-brand-700">Your Teacher</h3>
                <p className="mt-2 font-bold text-ink">{ev.teacher?.name || 'NOSTOPS teacher'}</p>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">✓ Verified Teacher</p>
                {ev.programme?.essence && <p className="mt-3 text-sm text-ink-soft">{ev.programme.essence}</p>}
              </div>
            </section>
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {active ? (
              <div className="rounded-3xl border border-line bg-white p-6 text-center" data-testid="space-register-existing">
                <h2 className="font-serif text-xl font-semibold text-brand-700">{active.status === 'CONFIRMED' ? 'You’re registered' : 'Your payment is pending'}</h2>
                <p className="mt-2 text-sm text-ink-soft">{active.status === 'CONFIRMED' ? 'Your place is confirmed.' : 'Your place is held for a short time while you complete payment.'}</p>
                <Link href={`/app/spaces/registrations/${active.registration_id}`} className="mt-4 inline-flex min-h-[48px] items-center rounded-xl bg-accent px-5 text-sm font-black text-white">View registration</Link>
              </div>
            ) : !ev.registration_open ? (
              <div className="rounded-3xl border border-line bg-white p-6 text-center" data-testid="registration-closed">
                <h2 className="text-lg font-black text-ink">{ev.registration_status || 'Registration is closed'}</h2>
                <Link href="/programmes" className="mt-4 inline-block text-sm font-bold text-brand-700">Explore other programmes →</Link>
              </div>
            ) : (
              <SpaceRegisterPanel eventId={ev.event_id} title={ev.title} paid={paid} fee={paid ? Number(ev.participant_fee) : 0}
                seatsRemaining={ev.seats_remaining ?? 0} signedIn={!!user} name={user?.name as string | undefined}
                email={user?.email as string | undefined} loginHref={`/login?next=/events/${ev.slug}/register`} />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
