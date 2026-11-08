import Link from 'next/link';
import type { User } from '@/lib/roles';
import { getTeacherDashboard, getOnboardingState, getTeacherJourney, isTeacherVerified, computeProfileCompleteness, getTeacherSelfProfile, hasCoreProfile } from '@/lib/server/teacher';
import OnboardingEmptyState from '@/components/app/teacher/OnboardingEmptyState';
import TeacherProgressCards from '@/components/app/teacher/TeacherProgressCards';
import AvailabilityToggle from '@/components/app/teacher/AvailabilityToggle';
import ProfileCompleteness from '@/components/app/teacher/ProfileCompleteness';
import PhotoReminder from '@/components/app/teacher/PhotoReminder';
import CityReminder from '@/components/app/teacher/CityReminder';
import { hasRealCity } from '@/lib/public-teacher';
import TeacherOneOnOneSnapshot from '@/components/app/teacher/TeacherOneOnOneSnapshot';
import TeacherAccessCard from '@/components/app/teacher/TeacherAccessCard';
import TeacherNextStep from '@/components/app/teacher/TeacherNextStep';
import UnlockCelebration from '@/components/app/teacher/UnlockCelebration';
import { deriveTeacherStatus } from '@/lib/teacher-status';
import { getTeacherAccessContext } from '@/lib/server/teacher-access';
import { summarizeFeatureAccess } from '@/lib/teacher-access';
import LevelUpGuide from '@/components/app/teacher/LevelUpGuide';
import LevelTimeline from '@/components/app/teacher/LevelTimeline';
import NextLevelTeaser from '@/components/app/teacher/NextLevelTeaser';
import { getServerT } from '@/lib/i18n/server';
import { LEVELS_ORDERED, TEACHER_LEVELS, badgeColor as levelBadgeColor, getTeacherLevel } from '@/lib/teacher-levels';
import { getUnifiedJourney } from '@/lib/server/verification';
import { UnifiedCtaCard } from '@/components/app/teacher/UnifiedVerification';
import { getMyTrustCase, WITHDRAWN_STATUSES } from '@/lib/server/trust-review';
import TrustChecklist from '@/components/app/teacher/TrustChecklist';
import { isIndiaCountry } from '@/lib/country';
import { markMyClaimProfileComplete } from '@/lib/server/discovery';
import { getFestiveStatus } from '@/lib/server/festive-kyc';
import { festiveView } from '@/lib/festive-view';
import FestiveDashboard from '@/components/app/teacher/festive/FestiveDashboard';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function fmtSlot(ts: number | null): { d: string; m: string; time: string } {
  if (!ts) return { d: '—', m: '', time: '' };
  const dt = new Date(ts);
  return {
    d: dt.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }),
    m: dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }),
    time: dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  };
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>{children}</section>;
}

export default async function TeacherHome({ user }: { user: User }) {
  const [dash, ob, journey, t, selfRead, unified, festive] = await Promise.all([
    getTeacherDashboard(), getOnboardingState(), getTeacherJourney(), getServerT(), getTeacherSelfProfile(),
    getUnifiedJourney(user), getFestiveStatus(user),
  ]);
  const fullSelf = selfRead.self;
  const festiveUi = festiveView(festive);

  // Not onboarded yet → a gentle "Start Onboarding" empty state (no hard
  // redirect; the teacher reaches their dashboard and chooses to begin).
  const onboarded = (ob?.profileComplete ?? false) || hasCoreProfile(fullSelf);
  if (!onboarded) return <OnboardingEmptyState />;
  // A claimer who is live now gets no more "finish your profile" reminders (idempotent, local, fast).
  await markMyClaimProfileComplete();

  // Profile complete — render the dashboard. Prefer the richer dashboard
  // projection, falling back to the native-profile read.
  const self = dash.self || fullSelf;
  if (!self) return <OnboardingEmptyState />;

  const stats = dash.stats;
  const em = dash.earningsModel;
  // When the unified journey reports the teacher is fully verified+empanelled
  // (incl. grandfathered existing teachers), reflect that in the legacy access
  // card so it never nags an already-empanelled teacher to "Complete InstaKYC".
  const unifiedComplete = unified.complete;
  const effectiveKycVerified = self.kycVerified || unifiedComplete;
  const effectiveKycPaid = self.kycPaid || unifiedComplete;
  const kycComplete = effectiveKycVerified && effectiveKycPaid;
  const [accessCtx, trustCase] = await Promise.all([
    getTeacherAccessContext({ needHostEligibility: true }),
    getMyTrustCase(user, self.handle),
  ]);
  // B4.8 — a reviewer's SUSPEND / REVOKE withdraws "Empanelled" on the website,
  // including what this dashboard shows. Teachers outside India see no InstaKYC price.
  const empanelled = !!self.isEmpanelled && !(trustCase && WITHDRAWN_STATUSES.has(trustCase.status));
  const international = !isIndiaCountry(self.country);
  const isVerifiedTeacher = isTeacherVerified(self);
  const teacherLevel = getTeacherLevel(self);
  const status = deriveTeacherStatus({ ...self, isEmpanelled: empanelled });
  const profilePercent = computeProfileCompleteness(self).percent;
  const featureSummary = summarizeFeatureAccess(accessCtx);
  const levelMeta = TEACHER_LEVELS[teacherLevel];
  // Header + badge use the SAME level as the L-badge (backend tier first), e.g. L3 → Yoga Guru.
  const badge = levelMeta.badgeLabel;
  const badgeColor = levelBadgeColor(badge);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">{badge}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-ink sm:text-3xl">{t('Namaste')}, {self.name} 🙏</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/teacher/profile" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">{t('My profile')}</Link>
          <Link href="/app/teacher/profile/edit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">{t('Edit profile')}</Link>
        </div>
      </div>

      {/* Festive Complimentary InstaKYC (backend-driven; hidden for teachers it doesn't apply to) */}
      {festive && (
        <FestiveDashboard status={festive} view={festiveUi} items={computeProfileCompleteness(fullSelf || self).items} />
      )}

      {/* Read-only authoritative status summary (verification / empanelment / level / profile) */}
      <TeacherAccessCard
        status={status}
        level={teacherLevel}
        profilePercent={profilePercent}
        kycVerified={self.kycVerified}
        kycPaid={self.kycPaid}
        international={international}
        withdrawn={!!self.isEmpanelled && !empanelled}
        summary={featureSummary}
      />

      {/* B4.8 — Trust checklist: status + next action per item, and the
          reviewer's own note after a Council decision. */}
      <TrustChecklist
        profilePercent={profilePercent}
        identityVerified={kycComplete}
        international={international}
        internationalAvailable={unified.international_available === true}
        empanelled={!!self.isEmpanelled}
        levelLabel={`L${levelMeta.level} · ${levelMeta.badgeLabel}`}
        review={trustCase}
      />

      {/* Path to going live. When the unified Verification+Empanelment flow is
          enabled (feature flag) we show the single "GET VERIFIED + EMPANELLED"
          CTA; otherwise the existing InstaKYC → Empanelment progress cards
          remain unchanged (legacy, still fully functional). */}
      {unified.cta.show ? (
        <UnifiedCtaCard journey={unified} />
      ) : (
        <TeacherProgressCards profileComplete kycComplete={kycComplete} empanelled={empanelled} international={international} withdrawn={!!self.isEmpanelled && !empanelled} />
      )}

      {/* Your Next Step — only once the journey is complete (otherwise the
          progress cards above are the single source of the next action). */}
      {kycComplete && empanelled && <TeacherNextStep status={status} kycComplete={kycComplete} />}

      {/* Profile completeness nudge — guides new teachers to finish every section
          (the festive block above already shows the same checklist when it is visible) */}
      {(!festive || ['hidden', 'ended', 'completed'].includes(festiveUi.mode)) && <ProfileCompleteness data={computeProfileCompleteness(self)} />}

      {/* Focused, gentle reminder to add a profile photo (biggest trust signal) */}
      {!(self.avatarUrl && self.avatarUrl.trim()) && <PhotoReminder name={self.name} />}

      {/* City missing or just "India" → invisible in city search */}
      {!hasRealCity(self.city, self.country) && <CityReminder />}

      {/* 1:1 bookings + expected earnings from the NOSTOPS ledger (hidden when none) */}
      <TeacherOneOnOneSnapshot verified={isVerifiedTeacher} />

      {/* One-time unlock celebration (verified teachers) */}
      {isVerifiedTeacher && <UnlockCelebration userId={String(user.user_id || '')} />}

      {/* Hero identity */}
      <SectionCard>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black"
            style={{ backgroundColor: badgeColor + '22', color: badgeColor }}
          >
            {(self.name || 'T').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-ink">{self.name}</p>
            <p className="truncate text-sm text-muted">
              {[self.city, self.experienceYears ? `${self.experienceYears}+ yrs experience` : null].filter(Boolean).join(' · ')}
            </p>
            <span
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ backgroundColor: badgeColor + '20', color: badgeColor }}
            >
              🎗️ {badge}
            </span>
            {kycComplete && (
              <span className="mt-1.5 ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">✓ Identity verified</span>
            )}
            {empanelled && (
              <span className="mt-1.5 ml-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">✓ NOSTOPS Empanelled Teacher</span>
            )}
          </div>
        </div>
        <AvailabilityToggle initial={self.isAvailable} />
      </SectionCard>

      {/* My Widgets — Teacher Growth System entry point */}
      <Link
        href="/app/teacher/widgets"
        className="flex items-center gap-4 rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-50 to-cream p-5 transition hover:border-brand"
        data-testid="dashboard-widgets-cta"
      >
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-xl">🚀</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-ink">My Widgets — grow your NOSTOPS presence</span>
          <span className="block text-xs text-muted">Share your profile, add website badges &amp; a QR, get discovered by students and organisations.</span>
        </span>
        <span aria-hidden="true" className="text-brand-700">›</span>
      </Link>

      {/* Stats KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Sessions')}</p>
          <p className="mt-1 text-2xl font-black text-ink">{stats.totalSessions.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Earnings')}</p>
          <p className="mt-1 text-2xl font-black text-ink">{inr(stats.totalEarnings)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Avg rating')}</p>
          <p className="mt-1 text-2xl font-black text-ink">{stats.avgRating ? `${stats.avgRating.toFixed(1)}★` : '—'}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Companies')}</p>
          <p className="mt-1 text-2xl font-black text-ink">{stats.activeCompanies.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Earnings model */}
      {em && (
        <SectionCard>
          <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Your earnings model')}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Per session')}</p>
              <p className="mt-1 text-lg font-black text-ink">{inr(em.sessionRate)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Take-home')}</p>
              <p className="mt-1 text-lg font-black text-brand-700">{inr(em.takeHomePerSession)}</p>
              <p className="text-[11px] text-muted">{t('Platform fee')} {em.platformFeePct}%</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Monthly cap')}</p>
              <p className="mt-1 text-lg font-black text-ink">{em.monthlyCapSessions} {t('sessions')}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('Max / month')}</p>
              <p className="mt-1 text-lg font-black text-ink">{inr(em.maxMonthlyIncome)}</p>
            </div>
          </div>
          {stats.monthlyProjection > 0 && (
            <p className="mt-4 rounded-xl bg-brand-50/60 px-4 py-3 text-sm font-semibold text-brand-700">
              {t('Projected this month')} · {inr(stats.monthlyProjection)}
            </p>
          )}
        </SectionCard>
      )}

      {/* Progression path */}
      <SectionCard>
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('NOSTOPS teacher progression path')}</h2>
        <p className="mt-1 text-sm text-muted">Merit-based progression — based on teaching hours, student outcomes, and community contribution.</p>
        <div className="mt-4 space-y-3">
          {LEVELS_ORDERED.map((p) => {
            const current = badge === p.badgeLabel;
            return (
              <div
                key={p.level}
                className="rounded-xl border p-4"
                style={{ borderColor: current ? p.color + '55' : '#E2E8F0', backgroundColor: current ? p.color + '0D' : '#fff' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black" style={{ color: p.color }}>{p.levelLabel}</span>
                  {current && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: p.color }}>{t('Current')}</span>}
                </div>
                <p className="mt-0.5 text-sm font-extrabold text-ink">{p.name}</p>
                <p className="text-xs text-muted">{p.sub}</p>
                {current && (
                  <ul className="mt-2 grid grid-cols-1 gap-1 p-0 sm:grid-cols-2">
                    {p.unlocks.map((u) => (
                      <li key={u} className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <span aria-hidden="true" style={{ color: p.color }}>🔓</span> {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Next-level teaser (hook) → journey timeline → how-to guide */}
      <NextLevelTeaser level={teacherLevel} t={t} />
      {journey && <LevelTimeline milestones={journey.milestones} levelLabel={journey.levelLabel} color={journey.color} t={t} />}
      <LevelUpGuide level={teacherLevel} verified={isVerifiedTeacher} sessions={stats.totalSessions} rating={stats.avgRating} reviews={stats.totalReviews} t={t} />

      {/* Upcoming sessions */}
      {dash.upcoming.length > 0 && (
        <SectionCard>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Upcoming sessions')}</h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">{dash.upcoming.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {dash.upcoming.slice(0, 5).map((u) => {
              const s = fmtSlot(u.whenTs);
              return (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-center">
                    <span className="text-base font-black leading-none text-brand-700">{s.d}</span>
                    <span className="text-[10px] font-bold uppercase text-muted">{s.m}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-ink">{u.counterparty || u.title}</p>
                    <p className="truncate text-xs text-muted">
                      {[s.time, u.participants ? `${u.participants} ${t('participants')}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {u.amount != null && <span className="text-sm font-bold text-ink">{inr(u.amount)}</span>}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Recent reviews */}
      {dash.reviews.length > 0 && (
        <SectionCard>
          <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Recent reviews')}</h2>
          <div className="mt-4 space-y-3">
            {dash.reviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <p className="text-sm text-accent-600">{'★'.repeat(Math.round(r.rating || 0))}<span className="text-line">{'★'.repeat(5 - Math.round(r.rating || 0))}</span></p>
                {r.text && <p className="mt-1 text-sm text-ink-soft">{r.text}</p>}
                <p className="mt-1 text-xs font-semibold text-muted">— {r.author}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
