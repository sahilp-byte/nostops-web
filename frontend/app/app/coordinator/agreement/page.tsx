import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { guardTeacherFeature } from '@/lib/server/teacher-access';
import { getCoordinatorMe } from '@/lib/server/coordinator';
import AcceptCoordinator from '@/components/app/coordinator/AcceptCoordinator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'City Coordinator', robots: { index: false, follow: false } };

const REVENUE_TIERS = [
  { months: '3 months', label: 'Pilot program', teacher: 70, nostops: 30, bonus: false, color: '#EF4444' },
  { months: '6 months', label: 'Engagement', teacher: 80, nostops: 20, bonus: true, color: '#0F766E' },
  { months: '12 months', label: 'Engagement', teacher: 85, nostops: 15, bonus: true, color: '#0F766E' },
];

const RESPONSIBILITIES = [
  { n: 1, title: 'Grow the teacher community', color: '#0D9488', bullets: ['Identify & invite experienced yoga teachers', 'Guide onboarding, verification & profile completion', 'Help teachers understand platform benefits & AI tools', 'Encourage ethical & professional conduct'] },
  { n: 2, title: 'Build a connected community', color: '#0F766E', bullets: ['Welcome new teachers & make them feel at home', 'Nurture city WhatsApp / communication groups', 'Encourage collaboration over competition', 'Celebrate achievements & share opportunities'] },
  { n: 3, title: 'Build relationships across the city', color: '#14B8A6', bullets: ['Connect with companies, institutions, startups, RWAs & studios', 'Represent NOSTOPS with integrity & authenticity', 'Position NOSTOPS as the trusted yoga cooperative'] },
  { n: 4, title: 'Facilitate opportunities', color: '#0F766E', bullets: ['Understand needs of institutions & connect the right teachers', 'Support smooth start of programs', 'Ensure a great experience for both sides'] },
  { n: 5, title: 'Support long-term relationships', color: '#EF4444', bullets: ['Regular follow-ups & feedback', 'Encourage renewals & program expansion', 'Help teachers deliver consistent value', 'Strengthen long-term trust'] },
  { n: 6, title: 'Protect quality & values', color: '#0F766E', bullets: ['Uphold quality standards of the cooperative', 'Encourage complete, honest profiles', 'Help resolve concerns & escalate when needed', 'Protect the dignity & reputation of the platform'] },
  { n: 7, title: 'Share local intelligence', color: '#0891B2', bullets: ['Share insights on demand, trends & opportunities', 'Identify new pockets of potential', 'Inform us about local events & initiatives'] },
  { n: 8, title: 'Be a brand ambassador', color: '#0F766E', bullets: ['Represent NOSTOPS at events & community meets', 'Spread awareness about the teacher-first vision', 'Inspire others to join the movement'] },
];

const COMMITMENTS = [
  'I will serve the teachers first.',
  'I will build trust, not chase transactions.',
  'I will nurture long-term relationships.',
  'I will uphold the values of the cooperative.',
  'I will work in collaboration, not competition.',
  'I will strengthen the yoga ecosystem in my city.',
];

export default async function CoordinatorAgreementPage() {
  const denied = await guardTeacherFeature('coordinator');
  if (denied) redirect(denied);
  const { coordinator } = await getCoordinatorMe();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app/coordinator" className="text-sm font-bold text-brand-700 hover:underline">‹ Coordinator Hub</Link>

      {/* Header */}
      <section className="rounded-2xl border border-brand/20 bg-brand-50/50 p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Your City Coordinator</p>
        <p className="mt-1 text-sm italic text-ink-soft">Serve the teachers. Build the ecosystem. Earn with impact.</p>
        {coordinator && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-white p-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-lg font-black text-white">{coordinator.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink">{coordinator.name}</p>
              <p className="truncate text-xs text-muted">📍 {coordinator.city} · {coordinator.assignedTeacherCount} teachers · {coordinator.corporatePartnerships} group partnerships</p>
            </div>
            {coordinator.whatsapp && (
              <a href={`https://wa.me/${coordinator.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">WhatsApp</a>
            )}
          </div>
        )}
      </section>

      {/* Revenue model */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">The NOSTOPS teacher-first revenue model</h2>
        <p className="mt-1 text-sm text-muted">Your share increases with commitment — the teacher&apos;s share is never touched.</p>
        <div className="mt-3 space-y-2">
          {REVENUE_TIERS.map((t, i) => (
            <div key={i} className="relative flex items-center gap-3 rounded-xl border border-line p-3">
              <div className="min-w-[90px] rounded-lg px-2.5 py-1.5" style={{ backgroundColor: t.color + '18' }}>
                <p className="text-xs font-black" style={{ color: t.color }}>{t.months}</p>
                <p className="text-xs font-bold" style={{ color: t.color }}>{t.label}</p>
              </div>
              <div className="flex-1 text-center"><p className="text-lg font-black text-brand-700">{t.teacher}%</p><p className="text-xs font-bold text-muted">Teacher</p></div>
              <div className="flex-1 text-center"><p className="text-lg font-black text-muted">{t.nostops}%</p><p className="text-xs font-bold text-muted">NOSTOPS</p></div>
              {t.bonus && <span className="absolute -bottom-2 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">+ Renewal bonus</span>}
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-brand-50/70 px-3 py-2 text-xs font-semibold text-brand-700">🛡️ All City Coordinator rewards come from NOSTOPS&apos; share only.</p>
      </section>

      {/* Responsibilities */}
      <div>
        <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink">Your role &amp; responsibilities</h2>
        <p className="mb-3 text-sm text-muted">As the City Coordinator, you are the custodian of the NOSTOPS ecosystem in your city.</p>
        <div className="space-y-3">
          {RESPONSIBILITIES.map((r) => (
            <div key={r.n} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: r.color }}>{r.n}</span>
                <p className="flex-1 text-sm font-extrabold" style={{ color: r.color }}>{r.title}</p>
                <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">5% of NOSTOPS&apos; share</span>
              </div>
              <ul className="mt-2 space-y-1.5 p-0 pl-9">
                {r.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-ink-soft"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Commitments */}
      <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">Your commitment</h2>
        <ul className="mt-3 space-y-2 p-0">
          {COMMITMENTS.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="text-brand">✓</span>{c}</li>
          ))}
        </ul>
        <div className="mt-4">
          <AcceptCoordinator active={!!coordinator?.active} />
        </div>
      </section>

      <p className="text-center text-sm font-bold italic text-ink-soft">“Alone, we can make a difference. Together, we can create a movement.”</p>
    </div>
  );
}
