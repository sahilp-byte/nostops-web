import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { getSessionUser } from '@/lib/server/session';
import { getUnreadCount, getSuggestedCard } from '@/lib/server/learner';
import { getTeacherSelfProfile } from '@/lib/server/teacher';
import { getAuthorFlag } from '@/lib/server/voices';
import { getTeacherAccessContext } from '@/lib/server/teacher-access';
import { normalizeRole, personaLabel, displayName } from '@/lib/roles';
import { getTeacherLevel, levelMeta } from '@/lib/teacher-levels';
import { navSectionsFor, buildTeacherNav, flattenNav } from '@/components/app/nav-config';
import { getAdminNavBadges, decorateNavWithBadges } from '@/lib/server/admin-nav-badges';
import { getFestiveStatus } from '@/lib/server/festive-kyc';
import { getActivityAlerts } from '@/lib/server/activity-alerts';
import { festiveView } from '@/lib/festive-view';
import AppShell from '@/components/app/AppShell';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { LOCALE_COOKIE, coerceLocale, detectLocaleFromAcceptLanguage, type Locale } from '@/lib/i18n/config';
import { CSRF_META, CSRF_SSR_HEADER } from '@/lib/session-cookie';

// The authenticated application. Session is validated server-side on every
// request; only sanitized, non-sensitive fields are passed to the client shell.
export const metadata: Metadata = {
  title: { default: 'Workspace', template: '%s · NOSTOPS' },
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const role = normalizeRole(user.role);
  const name = displayName(user);
  const initial = (name.charAt(0) || 'M').toUpperCase();
  const avatarUrl = (user.avatar_url as string | null) || null;
  const unreadCount = await getUnreadCount();
  const localeCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = coerceLocale(localeCookie);
  // First visit (no saved choice): offer the browser's language if we support it.
  let suggestedLocale: Locale | null = null;
  if (!localeCookie) {
    const detected = detectLocaleFromAcceptLanguage((await headers()).get('accept-language'));
    if (detected && detected !== 'en') suggestedLocale = detected;
  }

  // Teachers who aren't yet verified (InstaKYC + payment + empanelment) get a
  // browse/read-only shell: operating features are locked in the menu. See §5.4.
  let nav = navSectionsFor(role);
  let levelBadge: { level: number; label: string; color: string } | null = null;
  let lockReason: string | undefined;
  if (role === 'learner') {
    // "Suggested for you" — the SAME backend-personalized recommendation the mobile
    // app shows (next-best-action). Conditional: only rendered when a card exists.
    const card = await getSuggestedCard();
    if (card) {
      nav = [
        { title: 'Suggested for you', items: [{ label: card.title, href: card.href, available: true, promo: { sub: card.subtitle, cta: card.cta } }] },
        ...nav,
      ];
    }
  }
  if (role === 'teacher') {
    const [ctx, { self }] = await Promise.all([
      getTeacherAccessContext({ needHostEligibility: true }),
      getTeacherSelfProfile(),
    ]);
    const kycDone = !!self && self.kycVerified && self.kycPaid;
    const empanelled = !!self?.isEmpanelled;
    const isAuthor = self?.teacherId ? await getAuthorFlag(self.teacherId) : false;
    nav = buildTeacherNav(nav, ctx, { handle: self?.handle, publicVisible: self?.publicVisible, kycComplete: kycDone, empanelled, isAuthor });
    // Festive InstaKYC: one highlighted, backend-driven item at the top of the menu.
    const festiveNav = festiveView(await getFestiveStatus(user)).nav;
    if (festiveNav) {
      nav = [{ title: null, items: [{ label: festiveNav.label, href: festiveNav.href, available: true, emphasis: { sub: festiveNav.sub } }] }, ...nav];
    }
    if (self) {
      const lvl = getTeacherLevel(self);
      const m = levelMeta(lvl);
      levelBadge = { level: lvl, label: m.badgeLabel, color: m.color };
      // The single next requirement a locked earning feature needs (same logic as
      // the /locked page). Powers the "why it's locked" tap toast in the menu.
      lockReason = !kycDone ? 'Verification required' : !self.isEmpanelled ? 'Empanelment required' : 'Verification approval pending';
    }
  }
  let adminBadges: Record<string, number> | undefined;
  if (role === 'admin') {
    // Live backlog badges (KYC / Video / Empanelment / Payouts) on the sidebar.
    adminBadges = await getAdminNavBadges();
    nav = decorateNavWithBadges(nav, adminBadges);
  }
  const activity = await getActivityAlerts(role, adminBadges);
  const activityCount = activity.reduce((sum, a) => sum + a.count, 0);
  const pages = flattenNav(nav)
    .filter((n) => n.available && n.href)
    .map((n) => ({ label: n.label, href: n.href as string }));

  const csrf = (await headers()).get(CSRF_SSR_HEADER) ?? '';

  return (
    <I18nProvider initialLocale={locale}>
      {csrf && <meta name={CSRF_META} content={csrf} />}
      <AppShell
        name={name}
        personaLabel={personaLabel(user)}
        initial={initial}
        avatarUrl={avatarUrl}
        nav={nav}
        pages={pages}
        unreadCount={unreadCount + activityCount}
        suggestedLocale={suggestedLocale}
        levelBadge={levelBadge}
        lockReason={lockReason}
      >
        {children}
      </AppShell>
    </I18nProvider>
  );
}
