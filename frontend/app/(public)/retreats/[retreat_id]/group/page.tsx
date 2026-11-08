import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { canonical } from '@/lib/site';
import { inr } from '@/lib/format';
import { isPublicRetreatRecord, toPublicRetreat, fmtRange, durationDays, type PublicRetreat } from '@/lib/server/retreats';
import { DEFAULT_MIN_GROUP } from '@/lib/pricing';
import GroupTiersReference from '@/components/retreats/GroupTiersReference';
import RetreatReserveCta from '@/components/retreats/RetreatReserveCta';
import CopyLinkButton from '@/components/CopyLinkButton';
import { retreatPath } from '@/lib/retreat-url';
import SeatProgress from '@/components/retreats/SeatProgress';

export const revalidate = 900;

type Params = {
  params: Promise<{ retreat_id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getRetreat(id: string): Promise<PublicRetreat | null> {
  try {
    const d = await apiGet<any>(`/retreats/${id}`, { revalidate: 900 });
    if (!isPublicRetreatRecord(d)) return null;
    return toPublicRetreat(d);
  } catch {
    return null;
  }
}

// Transactional/utility page — the canonical SEO surface is /retreats/{id}, so
// this stays noindex to avoid a thin programmatic duplicate.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { retreat_id } = await params;
  const r = await getRetreat(retreat_id);
  const title = r ? `Bring your group · ${r.title}` : 'Bring your group · NOSTOPS';
  return {
    title,
    description: 'Create or join a group for this retreat — friends, students, family or colleagues — with each seat at the listed price.',
    alternates: { canonical: canonical(r ? retreatPath(r) : `/retreats/${retreat_id}`) },
    robots: { index: false, follow: true },
  };
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{n}</span>
      <div>
        <p className="font-black text-ink">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

export default async function BringYourGroupPage({ params, searchParams }: Params) {
  const { retreat_id } = await params;
  const sp = searchParams ? await searchParams : {};
  const cohort = typeof sp.cohort === 'string' ? sp.cohort.slice(0, 120) : undefined;
  const via = typeof sp.via === 'string' ? sp.via.slice(0, 80) : undefined;

  const r = await getRetreat(retreat_id);
  if (!r) notFound();

  const location = [r.venueName, r.city, r.state].filter(Boolean).join(', ');
  const dateStr = fmtRange(r.startDate, r.endDate);
  const days = durationDays(r.startDate, r.endDate);
  const soldOut = r.status === 'sold_out' || r.seatsRemaining === 0;

  // Prompt 3C: only the listed price (never a host-listed offer from the description).
  const perSeat = typeof r.priceInr === 'number' ? r.priceInr : undefined;

  const retreatUrl = retreatPath(r);
  const shareUrl = canonical(retreatUrl);
  const waHref = `https://wa.me/?text=${encodeURIComponent(`Join me for ${r.title}! Let's book as a group — reserve your seat here: ${shareUrl}`)}`;

  return (
    <main className="pb-20">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/retreats" className="hover:text-brand-700">Retreats</Link>
          <span aria-hidden>/</span>
          <Link href={retreatUrl} className="line-clamp-1 max-w-[12rem] hover:text-brand-700">{r.title}</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">Bring your group</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-ink to-royal">
        <div className="container-x relative py-14 md:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
            <span aria-hidden>👥</span> Group booking
          </span>
          <h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.1] tracking-tight text-white md:text-5xl">Bring your group</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            Already have a group of friends, students, family members or colleagues? Create or join a group for
            <span className="font-bold text-white"> {r.title}</span>.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/80">
            {dateStr && <span className="flex items-center gap-2"><span aria-hidden>🗓️</span>{dateStr}{days ? ` · ${days} days` : ''}</span>}
            {location && <span className="flex items-center gap-2"><span aria-hidden>📍</span>{[r.city, r.state].filter(Boolean).join(', ')}</span>}
            {typeof perSeat === 'number' && <span className="flex items-center gap-2"><span aria-hidden>🎟️</span>From ₹{inr(perSeat)}/seat</span>}
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {/* Invitation banner (when arriving via a group/cohort link) */}
          {cohort && (
            <div className="rounded-2xl border border-brand/25 bg-brand-50/60 p-5" data-testid="group-invite-banner">
              <p className="text-sm font-black text-brand-700">You&apos;re invited to the “{cohort}” group{via ? ` by ${via}` : ''}</p>
              <p className="mt-1 text-sm text-ink-soft">Reserve your own seat to join this group for the retreat. Your NOSTOPS account stays independent.</p>
              <div className="mt-3">
                <RetreatReserveCta
                  retreatId={r.id}
                  cohort={cohort}
                  via={via}
                  label="Join this group — reserve your seat →"
                  className="inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600"
                />
              </div>
            </div>
          )}

          {/* How it works */}
          <section>
            <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">How group booking works</h2>
            <div className="mt-5 space-y-5">
              <Step n={1} title="Create your group">
                Give your group a name and choose how many seats you need (minimum {DEFAULT_MIN_GROUP} for a group).
                You&apos;re the organiser and lead contact.
              </Step>
              <Step n={2} title="Invite your people">
                Share the retreat link with your friends, students, family or colleagues over WhatsApp or a copied link.
              </Step>
              <Step n={3} title="Everyone registers &amp; pays their seat">
                Each member reserves and pays for their own seat, or you reserve all the seats together and settle payment
                with the host. Track invitations and payment status from your reservations.
              </Step>
            </div>
          </section>

          {/* Pricing — Prompt 3C: the listed price only; the tiers are UNAPPROVED reference tiers. */}
          <section data-testid="group-pricing">
            <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Group pricing</h2>
            <p className="mt-3 text-sm text-ink-soft">
              Each seat in a group is at the listed price{typeof perSeat === 'number' ? <> of <span className="font-black text-ink">₹{inr(perSeat)}</span></> : null}. The amount payable is confirmed when a booking is made.
            </p>
            <GroupTiersReference />
          </section>
        </div>

        {/* Action rail */}
        <aside className="lg:col-span-1">
          <div className="space-y-5 lg:sticky lg:top-6">
            {typeof r.seatsTotal === 'number' && typeof r.seatsRemaining === 'number' && (
              <div className="card p-5" data-testid="group-seat-progress">
                <SeatProgress seatsTotal={r.seatsTotal} seatsRemaining={r.seatsRemaining} />
              </div>
            )}
            {soldOut ? (
              <div className="card p-6">
                <p className="text-lg font-black text-ink">This retreat is sold out</p>
                <p className="mt-2 text-sm text-ink-soft">Group booking opens again if seats free up. Join the waitlist on the retreat page.</p>
                <Link href={retreatUrl} className="mt-4 inline-flex rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white">Back to retreat →</Link>
              </div>
            ) : (
              <>
                {/* Create a group */}
                <div className="card p-6" data-testid="group-create-panel">
                  <p className="text-xs font-black uppercase tracking-wider text-muted">Organiser</p>
                  <h3 className="mt-1 text-lg font-black tracking-tight text-ink">Create a group</h3>
                  <p className="mt-1 text-sm text-ink-soft">Name your group, choose your seats and reserve together at the listed price.</p>
                  <RetreatReserveCta
                    retreatId={r.id}
                    mode="group"
                    cohort={cohort}
                    via={via}
                    label="Create your group →"
                    className="mt-4 block rounded-xl bg-accent px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-accent-600"
                  />
                  <div className="mt-4 border-t border-line pt-4">
                    <p className="text-xs font-bold text-ink-soft">Rally your people first</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CopyLinkButton path={retreatUrl} label="Copy invite link" className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:border-brand hover:text-brand-700" />
                      <a href={waHref} target="_blank" rel="noopener noreferrer" data-testid="group-invite-whatsapp" className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-brand-700 transition hover:border-brand">Share on WhatsApp →</a>
                    </div>
                  </div>
                </div>

                {/* Join a group */}
                <div className="card p-6" data-testid="group-join-panel">
                  <p className="text-xs font-black uppercase tracking-wider text-muted">Member</p>
                  <h3 className="mt-1 text-lg font-black tracking-tight text-ink">Join a group</h3>
                  <p className="mt-1 text-sm text-ink-soft">Invited by an organiser? Reserve your own seat — you&apos;ll be counted in their group.</p>
                  <RetreatReserveCta
                    retreatId={r.id}
                    cohort={cohort}
                    via={via}
                    label="Reserve my seat →"
                    className="mt-4 block rounded-xl border border-brand bg-white px-4 py-3 text-center text-sm font-bold text-brand-700 transition hover:bg-brand-50"
                  />
                </div>
              </>
            )}

            {/* Group status */}
            <div className="rounded-2xl border border-line bg-cream/60 p-5" data-testid="group-status">
              <p className="text-sm font-black text-ink">Track your group</p>
              <p className="mt-1 text-sm text-ink-soft">Already started a group? See invitations, seats reserved and payment status.</p>
              <Link href="/app/reservations" className="mt-3 inline-block text-sm font-bold text-brand-700 hover:underline">My reservations →</Link>
            </div>

            <Link href={retreatUrl} className="block text-center text-sm font-bold text-brand-700 hover:underline">← Back to retreat</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
