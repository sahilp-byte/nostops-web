import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile, getCodex, requireOnboardedTeacher } from '@/lib/server/teacher';
import { getServerT } from '@/lib/i18n/server';
import ShareCardPreview from '@/components/app/ShareCardPreview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Profile', robots: { index: false, follow: false } };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TagList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="rounded-full border border-line bg-cream px-3 py-1 text-sm font-semibold text-ink-soft">{t}</span>
      ))}
    </div>
  );
}

export default async function TeacherProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');
  await requireOnboardedTeacher();

  const [{ onboarded, self, social }, codex, t] = await Promise.all([getTeacherSelfProfile(), getCodex(), getServerT()]);
  if (!onboarded || !self) redirect('/app/teacher/onboarding');

  const specMap = new Map(codex.specializations.map((s) => [s.id, s.name]));
  const paramName = codex.paramparas.find((p) => p.id === self.parampara)?.name || self.parampara;
  const socialLinks = Object.entries(social).filter(([, v]) => v);
  const badge = self.badgePrimary || 'Yoga Shikshak';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">{t('Your teacher profile')}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-ink sm:text-3xl">{self.name}</h1>
        </div>
        <Link href="/app/teacher/profile/edit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">{t('Edit profile')}</Link>
      </div>

      {self.handle && self.publicVisible && (
        <Link href={`/teachers/${self.handle}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-brand" data-testid="preview-public-profile">
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg">🌐</span>
            <span>
              <span className="block text-sm font-extrabold text-ink">{t('Preview public profile')}</span>
              <span className="block truncate text-xs text-muted">/teachers/{self.handle}</span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-brand-700">{t('View →')}</span>
        </Link>
      )}

      {self.handle && self.publicVisible && (
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="teacher-share-card">
          <ShareCardPreview imagePath={`/share-card/teacher/${self.handle}`} label="profile" />
        </section>
      )}

      <Link href="/app/teacher/profile/media" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-brand" data-testid="manage-media-link">
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg">📸</span>
          <span>
            <span className="block text-sm font-extrabold text-ink">{t('Photo & intro video')}</span>
            <span className="block text-xs text-muted">{t('Update your headshot and 60–90s introduction')}</span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold text-brand-700">{t('Manage →')}</span>
      </Link>

      {/* Identity */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl font-black text-brand-700">
            {(self.name || 'T').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-ink">{self.name}</p>
            <p className="truncate text-sm text-muted">
              {[self.city, self.experienceYears ? `${self.experienceYears}+ yrs experience` : null].filter(Boolean).join(' · ') || '—'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">🎗️ {badge}</span>
              {self.isVerified && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">{t('Verified')}</span>}
              {self.isEmpanelled && <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: '#10B981' }}>{t('Empanelled')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-soft">
          {self.phone && <span>📞 {self.phone}</span>}
          {self.email && <span>✉️ {self.email}</span>}
          {self.country && <span>🌐 {self.country}</span>}
        </div>
      </section>

      <Section title={t('Bio')}>
        {self.bio ? <p className="text-sm leading-relaxed text-ink-soft">{self.bio}</p> : <p className="text-sm text-muted">{t('No bio added yet.')}</p>}
      </Section>

      <Section title={t('Parampara')}>
        <p className="text-sm font-semibold text-ink">{paramName || t('Not specified')}</p>
      </Section>

      <Section title={t('Yoga styles')}><TagList items={self.styles} empty={t('Not added yet.')} /></Section>
      <Section title={t('Specialisations')}><TagList items={self.specializations.map((id) => specMap.get(id) || id)} empty={t('Not added yet.')} /></Section>
      <Section title={t('Languages')}><TagList items={self.languages} empty={t('Not added yet.')} /></Section>

      <Section title={t('1:1 sessions')}>
        {self.premium.rateInr ? (
          <p className="text-sm text-ink-soft">
            <span className="font-black text-ink">₹{self.premium.rateInr.toLocaleString('en-IN')}</span> / {self.premium.durationMin || 60} min ·{' '}
            <span className={self.premium.enabled ? 'font-semibold text-brand-700' : 'font-semibold text-muted'}>
              {self.premium.enabled ? t('Available for booking') : t('Currently disabled')}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted">{t('1:1 pricing not set. Add it from Edit profile.')}</p>
        )}
      </Section>

      {socialLinks.length > 0 && (
        <Section title={t('Social')}>
          <div className="flex flex-wrap gap-2">
            {socialLinks.map(([k, v]) => (
              <span key={k} className="rounded-full border border-line bg-cream px-3 py-1 text-sm text-ink-soft">
                <span className="font-bold capitalize">{k}</span> · {v}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
