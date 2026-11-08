import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getMentorView, type Touchpoint } from '@/lib/server/mentor';
import { requireOnboardedTeacher } from '@/lib/server/teacher';
import { initials, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Mentor', robots: { index: false, follow: false } };

const TYPE_ICON: Record<string, string> = {
  call: '📞',
  lineage_transmission: '🕉️',
  feedback: '📝',
  workshop: '🧘',
  in_person: '🤝',
  note: '💬',
};

function fmtDate(s: string | null): string {
  if (!s) return '';
  const t = Date.parse(s);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function TouchpointRow({ t }: { t: Touchpoint }) {
  return (
    <div className="relative pl-8">
      <span className="absolute left-0 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-sm">{TYPE_ICON[t.type] || '💬'}</span>
      <div className="rounded-xl border border-line bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-ink">{titleCase(t.type)}</p>
          <span className="shrink-0 text-xs text-muted">{fmtDate(t.at)}</span>
        </div>
        {t.note && <p className="mt-1 text-sm text-ink-soft">{t.note.replace(/^SEED_/, '')}</p>}
        {t.lineageTransmission && (
          <span className="mt-2 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent-600">Lineage transmission</span>
        )}
      </div>
    </div>
  );
}

export default async function TeacherMentorPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');
  await requireOnboardedTeacher();

  const view = await getMentorView();
  const mentor = view?.mentor ?? null;
  const touchpoints = view?.touchpoints ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">My mentor</h1>
        <p className="mt-1 text-ink-soft">Your place in the Guru–Shishya Parampara — the Council Guru guiding your practice and lineage.</p>
      </div>

      {!view?.hasMentor || !mentor ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🧘</span>
          <p className="mt-2 text-base font-extrabold text-ink">No mentor assigned yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            As you progress through empanelment, a NOSTOPS Council Guru is paired with you for mentorship,
            lineage transmission and periodic check-ins. Keep teaching — your mentor will appear here.
          </p>
          <Link href="/app/teacher/empanelment" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">View empanelment →</Link>
        </div>
      ) : (
        <>
          {/* Mentor card */}
          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start gap-4">
              {mentor.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mentor.avatarUrl} alt={mentor.name} width={64} height={64} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-50 text-xl font-black text-brand-700">{initials(mentor.name)}</div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-black text-ink">{mentor.name}</p>
                {mentor.title && <p className="text-sm font-semibold text-brand-700">{mentor.title}</p>}
                <p className="mt-0.5 text-sm text-muted">{[mentor.lineage, mentor.city].filter(Boolean).join(' · ')}</p>
                {mentor.since && <p className="mt-1 text-xs text-muted">Mentoring you since {fmtDate(mentor.since)}</p>}
              </div>
            </div>
            {mentor.bio && <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">{mentor.bio}</p>}
          </section>

          {/* Touchpoints */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Mentorship touchpoints ({touchpoints.length})</h2>
            {touchpoints.length === 0 ? (
              <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-ink-soft">
                No touchpoints logged yet. Your mentor will record calls, feedback and lineage sessions here.
              </div>
            ) : (
              <div className="space-y-3 border-l border-line pl-0">
                {touchpoints.map((t) => <TouchpointRow key={t.id} t={t} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
