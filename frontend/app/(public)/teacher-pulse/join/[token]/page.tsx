import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { PULSE_ROLES, resolveInvitePublic } from '@/lib/server/pulse';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your Teacher Pulse invitation', robots: { index: false, follow: false } };

export default async function PulseJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([
    resolveInvitePublic(token).catch(() => null),
    getSessionUser().catch(() => null),
  ]);

  const isParticipant = !!user && PULSE_ROLES.has(normalizeRole(user.role));
  const next = `/app/pulse?invite=${encodeURIComponent(token)}`;

  return (
    <main className="bg-gradient-to-br from-brand-50 to-cream">
      <div className="container-x flex min-h-[70vh] items-center py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
          <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-3xl">🙏</span>
          {!invite ? (
            <>
              <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">Invitation not found</h1>
              <p className="mt-2 text-ink-soft">This invitation link is invalid or has expired. Ask your colleague to send a fresh one.</p>
              <Link href="/teacher-pulse" className="mt-6 inline-flex rounded-xl border border-line px-5 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">About Teacher Pulse</Link>
            </>
          ) : (
            <>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-700">Teacher Pulse invitation</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">{invite.inviter_name} invited you</h1>
              <p className="mx-auto mt-2 max-w-md text-ink-soft">
                Join a conversation among yoga teachers about the profession, the market and the future of Yoga.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {isParticipant ? (
                  <Link href={next} data-testid="pulse-invite-accept" className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Accept &amp; enter Teacher Pulse →</Link>
                ) : (
                  <>
                    <Link href={`/login?next=${encodeURIComponent(next)}`} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Sign in to accept</Link>
                    <Link href={`/join?next=${encodeURIComponent(next)}`} className="rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">New here? Join as a teacher</Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
