import Link from 'next/link';
import type { Metadata } from 'next';
import { getBookingInvite, type InviteTeacher } from '@/lib/server/booking';
import BookingRegister from '@/components/booking/BookingRegister';
import PayNow from '@/components/booking/PayNow';
import ShareInvite from '@/components/booking/ShareInvite';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your yoga program invite', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const DIMENSION_META: Record<string, { label: string; emoji: string; color: string; desc: string }> = {
  body: { label: 'Yoga for the Body', emoji: '💪', color: '#EF4444', desc: 'Physical postures, flexibility & strength training' },
  mind: { label: 'Yoga for the Mind', emoji: '🧠', color: '#1E3A8A', desc: 'Meditation, mindfulness & stress management' },
  special_needs: { label: 'Yoga for Special Needs', emoji: '❤️', color: '#0D9488', desc: 'Adapted yoga for physical limitations, functional needs or circumstances' },
};

const PERKS = [
  'Led by a verified NOSTOPS teacher',
  'Held on-site at the venue shown below',
  'Schedule and session details shared by your organiser',
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-black text-white">N</span>
            <span className="text-sm font-black tracking-tight text-ink">NOSTOPS</span>
          </span>
          <Link href="/" className="text-sm font-bold text-brand-700 hover:underline">Explore NOSTOPS →</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}

function TeacherMini({ t, badge }: { t: InviteTeacher; badge: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-black text-brand-700">{t.name.charAt(0)}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-ink">{t.name}</p>
        <p className="text-xs text-muted">{badge}{t.city ? ` · ${t.city}` : ''}{t.experienceYears ? ` · ${t.experienceYears}+ yrs` : ''}{t.rating ? ` · ${t.rating}★` : ''}</p>
      </div>
    </div>
  );
}

export default async function BookingInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getBookingInvite(token);

  if (!invite) {
    return (
      <Shell>
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-4xl">🔗</span>
          <h1 className="mt-3 text-xl font-black text-ink">Link not found</h1>
          <p className="mt-1 text-sm text-ink-soft">This invite link may have expired or is invalid.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white">Explore NOSTOPS</Link>
        </div>
      </Shell>
    );
  }

  // Closed / full states
  if (!invite.enrollmentOpen || invite.isFull) {
    return (
      <Shell>
        <div className="rounded-2xl border border-line bg-white p-6 text-center">
          <span className="inline-grid h-16 w-16 place-items-center rounded-full text-3xl" style={{ backgroundColor: invite.isFull ? '#F59E0B15' : '#0D948815' }}>
            {invite.isFull ? '👥' : '🔒'}
          </span>
          <h1 className="mt-3 text-xl font-black text-ink">{invite.isFull ? 'Batch is full' : 'Enrollment closed · payments open'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {invite.isFull
              ? `All ${invite.batchCapacity} spots for the yoga program at ${invite.companyName} have been filled.`
              : invite.finalPerHead
                ? `The group discount is locked. Each enrolled participant pays ${inr(invite.finalPerHead)}${invite.finalDiscountPct ? ` (${invite.finalDiscountPct}% off)` : ''}. If you enrolled, unlock your Pay-Now link below.`
                : `Enrollment for the yoga program at ${invite.companyName} is closed. If you enrolled, unlock your Pay-Now link below.`}
          </p>
        </div>
        {!invite.isFull && <div className="mt-4"><PayNow token={invite.token} /></div>}
      </Shell>
    );
  }

  const gam = invite.gam;

  return (
    <Shell>
      {/* Hero */}
      <section className="rounded-2xl bg-brand p-6 text-center text-white">
        <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-2xl">🧘</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight">{invite.courseTitle}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/90">
          You&apos;ve been invited to join a yoga programme at <span className="font-bold">{invite.companyName}</span>
        </p>
      </section>

      {/* Focus areas */}
      {invite.dimensions.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Program focus areas</h2>
          <div className="space-y-2">
            {invite.dimensions.map((d) => {
              const m = DIMENSION_META[d];
              if (!m) return null;
              return (
                <div key={d} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3" style={{ borderLeftWidth: 4, borderLeftColor: m.color }}>
                  <span className="text-xl">{m.emoji}</span>
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: m.color }}>{m.label}</p>
                    <p className="text-xs text-muted">{m.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Group discount tiers */}
      {gam && gam.tiers.length > 0 && (
        <section className="mt-5 rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">🌡️ Group pricing unlock</h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">{gam.enrolled}/{gam.capacity} joined</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(gam.capacity ? (gam.enrolled / gam.capacity) * 100 : 0, 100)}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {gam.tiers.map((t) => {
              const reached = gam.enrolled >= t.min;
              return (
                <span
                  key={t.min}
                  className="rounded-full border px-2.5 py-1 text-xs font-bold"
                  style={{ borderColor: t.color, backgroundColor: reached ? t.color : 'transparent', color: reached ? '#fff' : t.color }}
                >
                  {t.min}+ → {t.discountPct}% off
                </span>
              );
            })}
          </div>
          {gam.nextNeeded > 0 && gam.nextDiscountPct > 0 && (
            <p className="mt-3 rounded-xl bg-brand-50/60 px-4 py-3 text-sm text-ink-soft">
              You + {Math.max(0, gam.nextNeeded - 1)} more colleagues unlock{' '}
              <span className="font-bold text-brand-700">{gam.nextDiscountPct}% off</span>
              {gam.nextSaveTotal > 0 ? <> · save <span className="font-bold text-brand-700">{inr(gam.nextSaveTotal)}</span> for the whole batch</> : null}
            </p>
          )}
        </section>
      )}

      {/* Price / perks */}
      <section className="mt-5 rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-muted">Group programme</p>
            <p className="text-lg font-black text-ink">Group pricing</p>
            <p className="text-xs text-muted">Final amount calculated after the batch closes</p>
          </div>
          <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">ON-SITE</span>
        </div>
        <ul className="mt-3 space-y-2 p-0">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-ink-soft"><span className="mt-0.5 text-brand">✓</span>{p}</li>
          ))}
        </ul>
      </section>

      {/* Session details */}
      <section className="mt-5 rounded-2xl border border-line bg-white p-5">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">📍 Venue</dt><dd className="text-right font-semibold text-ink">{invite.venue || invite.venueCity || '—'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">🗓️ Sessions</dt><dd className="text-right font-semibold text-ink">{invite.sessionDates.length} planned</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">👥 Colleagues</dt><dd className="text-right font-semibold text-ink">{invite.registeredCount}/{invite.batchCapacity} joined</dd></div>
          {invite.assignedTeacher?.name && <div className="flex justify-between gap-3"><dt className="text-muted">🌿 Instructor</dt><dd className="text-right font-semibold text-ink">{invite.assignedTeacher.name}</dd></div>}
        </dl>
      </section>

      {/* Teacher pair */}
      {invite.pair && (
        <div className="mt-5 space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Your teaching team</h2>
          {invite.pair.guru && <TeacherMini t={invite.pair.guru} badge="Senior Yoga Guru" />}
          {invite.pair.shikshak && <TeacherMini t={invite.pair.shikshak} badge="Yoga Shikshak" />}
        </div>
      )}

      {/* Register */}
      <div className="mt-6">
        <BookingRegister
          token={invite.token}
          companyName={invite.companyName}
          courseTitle={invite.courseTitle}
          venue={invite.venue}
          sessionCount={invite.sessionDates.length}
          instructorName={invite.assignedTeacher?.name ?? null}
        />
      </div>

      {/* Share */}
      <div className="mt-4">
        <ShareInvite courseTitle={invite.courseTitle} companyName={invite.companyName} />
      </div>
    </Shell>
  );
}
