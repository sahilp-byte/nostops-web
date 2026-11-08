import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getEmpanelmentProgress, getTeacherSelfProfile, requireOnboardedTeacher } from '@/lib/server/teacher';
import { getMyStanding } from '@/lib/server/empanelment-policy';
import { FREE_PATH_STEPS } from '@/lib/empanelment-policy';
import MeritProgress from '@/components/app/teacher/MeritProgress';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Empanelment', robots: { index: false, follow: false } };

const WHO = [
  'Teachers who have undergone formal yoga training',
  'Those with meaningful teaching experience',
  'Committed to individuals, communities and organisations',
  'See yoga as a pathway to awareness, balance and resilience',
  'Interested in educational, community and corporate wellness',
];

const BENEFITS = [
  { icon: '🏅', title: 'Professional Recognition', desc: 'Validation of your teaching experience and commitment.' },
  { icon: '🏢', title: 'Corporate Opportunities', desc: 'On-site programmes, workshops and wellness initiatives.' },
  { icon: '👥', title: 'Professional Network', desc: 'A community of experienced teachers and practitioners.' },
  { icon: '🛡️', title: 'Credibility & Visibility', desc: 'Strengthen your professional standing.' },
  { icon: '🌐', title: 'Digital Presence', desc: 'A verified NOSTOPS profile to share across networks.' },
  { icon: '📚', title: 'Continuing Learning', desc: 'Dialogues, training and knowledge-sharing.' },
];

export default async function TeacherEmpanelmentPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');

  await requireOnboardedTeacher();
  const [prog, { self }] = await Promise.all([getEmpanelmentProgress(), getTeacherSelfProfile()]);
  const empanelled = prog?.isEmpanelled ?? false;
  // Policy V2: the free-path standing is evaluated by the policy engine from the
  // teacher's own main-backend sessions and reviews (never the old 4.0★ rule).
  const standing = !empanelled && self ? await getMyStanding(user, { teacherId: self.teacherId, handle: self.handle, name: self.name }) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>

      {/* Hero */}
      <section className="rounded-2xl bg-brand p-6 text-center text-white sm:p-8">
        <span className="inline-grid h-16 w-16 place-items-center rounded-full bg-white/15 text-3xl">🏅</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Empanelled Teacher</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/90">
          Empanelment acknowledges teachers who bring not only technical competence but also integrity, discipline
          and respect for the deeper philosophy of yoga.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {['🛡️ Council Reviewed', '💸 No Fee', '🏢 Corporate Access'].map((p) => (
            <span key={p} className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{p}</span>
          ))}
        </div>
      </section>

      {/* Status */}
      {empanelled ? (
        <div className="flex items-center gap-3 rounded-2xl border-l-4 border-brand bg-brand-50/60 p-4">
          <span className="text-xl">✅</span>
          <div>
            <p className="text-sm font-extrabold text-brand-700">You are Empanelled</p>
            <p className="text-xs text-ink-soft">Your NOSTOPS Empanelled Teacher status is active{prog?.path ? ` · ${prog.path}-track` : ''}.</p>
          </div>
        </div>
      ) : (
        <MeritProgress standing={standing} />
      )}

      {/* Who should apply */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Who should apply?</h2>
        <ul className="mt-3 space-y-2.5 p-0">
          {WHO.map((w) => (
            <li key={w} className="flex items-start gap-2.5 text-sm text-ink-soft"><span className="mt-0.5 text-brand">✓</span>{w}</li>
          ))}
        </ul>
      </section>

      {/* Benefits */}
      <div>
        <h2 className="mb-3 text-base font-extrabold text-ink">Benefits of being empanelled</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border border-line bg-white p-4">
              <p className="text-xl">{b.icon}</p>
              <p className="mt-1.5 text-sm font-extrabold text-ink">{b.title}</p>
              <p className="text-xs text-muted">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Process */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">💸 No fee required · Merit-based</span>
        <h2 className="mt-3 text-base font-extrabold text-ink">How can I get empanelled?</h2>
        <div className="mt-4 space-y-4" data-testid="free-path-steps">
          {FREE_PATH_STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{i + 1}</span>
              <div>
                <p className="text-sm font-extrabold text-ink">{s.title}</p>
                <p className="text-xs text-muted">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTAs */}
      <div className="space-y-3">
        <Link href="/app/teacher/empanelment/fast-track" className="flex items-center justify-center gap-2 rounded-xl border-2 border-accent px-5 py-3 text-sm font-bold text-accent-600 transition hover:bg-accent/5">
          ⚡ Apply for Fast-Track Empanelment · ₹4,999
        </Link>
      </div>

      <p className="text-center text-xs leading-relaxed text-muted">
        NOSTOPS reserves the right to review or withdraw empanelment where professional or ethical standards are
        violated. Enquiries: nostops.org@gmail.com
      </p>
    </div>
  );
}
