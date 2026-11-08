import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getTeacherSelfProfile } from '@/lib/server/teacher';
import { syncTeacherDirectory, getTeacherAssignments, type TeacherAssignment } from '@/lib/server/institutional';
import EscalateButton from '@/components/app/EscalateButton';
import AssignmentResponseInline from '@/components/app/teacher/AssignmentResponseInline';
import { tierToLevel, badgeToLevel } from '@/lib/teacher-levels';

const PATHWAY_LABEL: Record<string, string> = { MIND: 'Mind', BODY: 'Body', SPECIAL_NEEDS: 'Special Needs' };

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Institutional Events', robots: { index: false, follow: false } };

const chip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold';

function Card({ a }: { a: TeacherAssignment }) {
  const offered = a.status === 'PROPOSED' || a.status === 'ASSIGNED';
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-brand hover:shadow" data-testid={`ta-${a.event_id}`}>
      <Link href={`/app/teacher/institutional/${a.event_id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-ink">{a.event_title}</p>
            <p className="mt-0.5 text-xs text-muted">{a.programme_name}{a.programme_taxonomy_label ? ` · ${a.programme_taxonomy_label}` : ''}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`${chip} ${a.lifecycle_effective === 'LIVE' ? 'bg-emerald-50 text-emerald-700' : a.lifecycle_effective === 'COMPLETED' ? 'bg-cream text-ink-soft' : 'bg-brand-50 text-brand-700'}`}>{a.lifecycle_effective}</span>
            {offered && (
              <span className={`${chip} bg-amber-100 text-amber-800`} data-testid={`ta-respond-${a.event_id}`}>● Offer</span>
            )}
            {a.status === 'ACCEPTED' && (
              <span className={`${chip} bg-emerald-50 text-emerald-700`} data-testid={`ta-accepted-${a.event_id}`}>✓ Accepted</span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {a.event_date && <span>📅 {a.event_date}{a.start_time ? ` · ${a.start_time}` : ''}</span>}
          {(a.venue || a.city) && <span>📍 {a.venue || a.city}</span>}
          {a.organisation_name && <span>🏢 {a.organisation_name}</span>}
          <span>👥 {a.roster_count ?? 0} registered</span>
        </div>
      </Link>
      {offered && (
        <div className="mt-3 border-t border-line pt-3">
          <AssignmentResponseInline eventId={a.event_id} />
        </div>
      )}
    </div>
  );
}

export default async function TeacherInstitutionalPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  // Register/refresh this teacher in the matchable directory (city from profile),
  // which also auto-matches them to still-unmatched upcoming events. The declared
  // pathways, languages, specialisations, experience and level are sent too so
  // matching uses them (the backend only overwrites fields that are sent, and
  // rejects anything that is not MIND / BODY / SPECIAL_NEEDS).
  const profile = await getTeacherSelfProfile().catch(() => null);
  const self = profile?.self || null;
  const lvl = self ? (tierToLevel(self.tier) ?? badgeToLevel(self.badgePrimary)) : null;
  const sync = await syncTeacherDirectory(user, {
    name: self?.name || (user.name as string) || undefined,
    handle: self?.handle || undefined,
    city: self?.city || undefined,
    ...(self ? {
      taxonomies: self.yogaDimensions.map((d) => String(d).trim().toUpperCase().replace(/[\s-]+/g, '_')),
      languages: self.languages,
      specializations: self.specializations,
      experience_years: self.experienceYears,
      level: lvl ? `L${lvl}` : undefined,
      // B4.7 — the main backend's OWN status (read server-side from the teacher's
      // record). Opening this page never grants empanelment or verification.
      empanelled: self.isEmpanelled,
      id_verified: self.kycVerified,
    } : {}),
  });
  const declared = sync?.profile?.taxonomies || [];
  const adaptiveVerified = !!sync?.profile?.adaptive_practice_verified;
  const assignments = await getTeacherAssignments(user);
  const upcoming = assignments.filter((a) => a.lifecycle_effective === 'PUBLISHED' || a.lifecycle_effective === 'LIVE');
  const past = assignments.filter((a) => !upcoming.includes(a));

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">Institutional Events</h1>
            <p className="mt-1 text-sm text-ink-soft">Council-curated programmes you&rsquo;ve been matched to deliver. We match you to events near your city.</p>
          </div>
          <EscalateButton />
        </div>

        <div className="mt-4 rounded-xl border border-line bg-cream/60 px-4 py-3 text-xs leading-relaxed text-ink-soft" data-testid="teacher-pathways">
          <span className="font-bold text-ink">Pathways used for matching:</span>{' '}
          {declared.length ? declared.map((k) => PATHWAY_LABEL[k] || k).join(' · ') : 'none declared yet — add them in your profile'}
          {sync?.rejected_pathways?.length ? <span className="ml-1 text-amber-700" data-testid="teacher-pathways-rejected">(ignored: {sync.rejected_pathways.join(', ')})</span> : null}
          <br />
          <span className="font-bold text-ink">Special Needs:</span>{' '}
          {adaptiveVerified
            ? <span className="font-semibold text-emerald-700" data-testid="teacher-adaptive-verified">✓ Adaptive-practice competence verified by NOSTOPS</span>
            : <span data-testid="teacher-adaptive-unverified">offered only after NOSTOPS verifies your adaptive-practice competence. Declaring the pathway alone does not verify it.</span>}
        </div>

        {assignments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-10 text-center" data-testid="teacher-inst-empty">
            <p className="text-3xl">🧘</p>
            <p className="mt-2 text-base font-extrabold text-ink">No matched events yet</p>
            <p className="mt-1 text-sm text-ink-soft">When an organisation near you publishes a programme, we&rsquo;ll match it to you and it will appear here.</p>
            {!self?.city && <p className="mt-3 text-xs font-semibold text-amber-700">Tip: add your city in your teacher profile so we can match you to nearby events.</p>}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Upcoming <span className="text-muted">({upcoming.length})</span></h2>
                <div className="space-y-3">{upcoming.map((a) => <Card key={a.assignment_id} a={a} />)}</div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Past <span className="text-muted">({past.length})</span></h2>
                <div className="space-y-3">{past.map((a) => <Card key={a.assignment_id} a={a} />)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
