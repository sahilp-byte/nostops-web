'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ENQUIRY_ROUTE } from '@/lib/spaces';
import HeaderNav, { SPACES_APP_ROUTE as SP_ROUTE } from '@/components/HeaderNav';
import { HEADER_NAV } from '@/lib/site-nav';
import AccountMenu from '@/components/app/AccountMenu';
import GlobalSearch from '@/components/app/GlobalSearch';
import HeaderLocation from '@/components/app/HeaderLocation';
import LanguageSwitcher from '@/components/app/LanguageSwitcher';
import LanguageSuggestionToast from '@/components/app/LanguageSuggestionToast';
import { useI18n } from '@/components/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/config';
import type { NavItem, NavSection } from '@/components/app/nav-config';

export type LevelBadge = { level: number; label: string; color: string };

// Compact teacher-level pill (L1/L2/L3). `md` = header (label hidden on phones);
// `sm` = sidebar/drawer "Signed in as" block (always shows the full label).
function LevelPill({ badge, size = 'md' }: { badge: LevelBadge; size?: 'sm' | 'md' }) {
  const short = badge.label.replace('Yoga ', '');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'border px-2 py-1 text-xs'}`}
      style={
        size === 'sm'
          ? { backgroundColor: badge.color + '14', color: badge.color }
          : { borderColor: badge.color + '55', backgroundColor: badge.color + '14', color: badge.color }
      }
      title={`${badge.label} · Level ${badge.level}`}
      data-testid="level-badge"
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: badge.color }} aria-hidden="true" />
      <span>L{badge.level}</span>
      <span className={size === 'sm' ? 'inline' : 'hidden sm:inline'}>· {short}</span>
    </span>
  );
}

function NavList({ sections, onNavigate, onLockedTap }: { sections: NavSection[]; onNavigate?: () => void; onLockedTap?: (feature: string) => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const renderItem = (item: NavItem) =>
    item.available && item.href && item.emphasis ? (
      <Link
        key={item.label}
        href={item.href}
        onClick={onNavigate}
        aria-current={pathname === item.href ? 'page' : undefined}
        data-testid="nav-emphasis"
        className="flex items-center justify-between gap-2 rounded-xl border-l-4 border-[#F07A1A] bg-[#FFF1E2] px-3 py-2.5 transition hover:bg-[#FDE7D2]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-black text-[#C2590C]">{t(item.label)}</span>
          {item.emphasis.sub && <span className="mt-0.5 block text-xs text-[#B4530A]">{t(item.emphasis.sub)}</span>}
        </span>
        <span aria-hidden="true" className="text-[#F07A1A]">›</span>
      </Link>
    ) : item.available && item.href && item.promo ? (
      <Link
        key={item.label}
        href={item.href}
        onClick={onNavigate}
        className="block rounded-xl border border-brand/30 bg-brand-50/60 p-3 transition hover:border-brand hover:bg-brand-50"
      >
        <span className="block text-sm font-extrabold leading-snug text-ink">{t(item.label)}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{t(item.promo.sub)}</span>
        <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">
          {t(item.promo.cta)} →
        </span>
      </Link>
    ) : item.available && item.href ? (
      <Link
        key={item.label}
        href={item.href}
        onClick={onNavigate}
        aria-current={pathname === item.href ? 'page' : undefined}
        className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
          pathname === item.href
            ? 'bg-brand-50 text-brand-700'
            : 'text-ink-soft hover:bg-cream hover:text-brand-700'
        }`}
      >
        <span className="flex min-w-0 items-center">
          {item.icon ? <span aria-hidden="true" className="mr-2.5 text-base leading-none">{item.icon}</span> : null}
          <span className="truncate">{t(item.label)}</span>
        </span>
        {typeof item.badge === 'number' && item.badge > 0 && (
          <span
            data-testid={`nav-badge-${item.href}`}
            aria-label={`${item.badge} pending`}
            className="ml-2 grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-accent-600 px-1.5 text-[10px] font-bold text-white"
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    ) : item.lock ? (
      <button
        key={item.label}
        type="button"
        onClick={() => { onLockedTap?.(item.label); onNavigate?.(); }}
        data-testid={`nav-locked-${item.label}`}
        aria-label={`${item.label} — locked. Tap to see how to unlock.`}
        title="Tap to see what's needed to unlock"
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-muted/70 transition hover:bg-cream"
      >
        <span className="flex items-center gap-1.5"><span aria-hidden="true">🔒</span>{t(item.label)}</span>
        <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">{t('Locked')}</span>
      </button>
    ) : (
      <span
        key={item.label}
        aria-disabled="true"
        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-muted/70"
      >
        {t(item.label)}
        <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">{t('Soon')}</span>
      </span>
    );

  return (
    <nav aria-label="Application" className="space-y-4">
      {sections.map((section, i) => (
        <div key={section.title ?? `sec-${i}`} className="space-y-1">
          {section.title && (
            <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted/80">{t(section.title)}</p>
          )}
          {section.items.map(renderItem)}
        </div>
      ))}
    </nav>
  );
}

function Brand({ tagline = false }: { tagline?: boolean }) {
  const { t } = useI18n();
  return (
    <Link href="/app" className="flex flex-col" aria-label="NOSTOPS app home">
      <Image src="/brand/nostops-logo.png" alt="NOSTOPS" width={191} height={55} priority className="h-9 w-auto" />
      {tagline && <span className="mt-1 text-[11px] font-semibold leading-tight tracking-tight text-muted">{t('tagline')}</span>}
    </Link>
  );
}

// Quick "why it's locked" toast shown when a teacher taps a locked menu item —
// names the missing requirement and offers a one-tap path to finish verification.
function LockedFeatureToast({ feature, reason, onClose }: { feature: string; reason: string; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const id = setTimeout(onClose, 7000);
    return () => clearTimeout(id);
  }, [feature, onClose]);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="locked-toast"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-accent/30 bg-white p-4 shadow-xl sm:left-auto sm:right-4 sm:mx-0"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-lg">🔒</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-ink">{t(feature)} {t('is locked')}</p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-accent-600">{t(reason)}</p>
          <p className="mt-1 text-xs text-muted">{t('Finish the quick verification steps to unlock this and start earning.')}</p>
          <Link
            href={`/app/teacher/locked?feature=${encodeURIComponent(feature)}`}
            onClick={onClose}
            data-testid="locked-toast-cta"
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600"
          >
            {t('Finish verification')} →
          </Link>
        </div>
        <button type="button" aria-label={t('Dismiss')} onClick={onClose} className="shrink-0 rounded-lg p-1 text-muted hover:bg-cream">✕</button>
      </div>
    </div>
  );
}

export default function AppShell({
  name,
  personaLabel,
  initial,
  avatarUrl,
  nav,
  pages,
  unreadCount = 0,
  suggestedLocale = null,
  levelBadge = null,
  lockReason,
  children,
}: {
  name: string;
  personaLabel: string;
  initial: string;
  avatarUrl?: string | null;
  nav: NavSection[];
  pages: { label: string; href: string }[];
  unreadCount?: number;
  suggestedLocale?: Locale | null;
  levelBadge?: LevelBadge | null;
  lockReason?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [drawer, setDrawer] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  // Reserve room at the end of the sidebar for the docked Ask AI Guru launcher on Spaces enquiry pages.
  const pathname = usePathname() || '';
  const guruDock = ENQUIRY_ROUTE.test(pathname);
  // NOSTOPS Spaces screens (owner, teacher, participant, Community Partner, admin) use the Spaces
  // visual system: full-width NOSTOPS header with the global navigation, warm sidebar below it.
  const sp = SP_ROUTE.test(pathname);

  return (
    <div className={`min-h-screen ${sp ? 'sp-page' : 'bg-cream'}`} data-testid={sp ? 'sp-shell' : undefined}>
      {/* Desktop sidebar */}
      <aside className={`fixed bottom-0 left-0 z-30 hidden w-64 flex-col border-r md:flex ${sp ? 'sp-shell-aside top-[72px]' : 'top-0 border-line bg-white'}`}>
        {!sp && (
          <div className="flex h-16 items-center border-b border-line px-5">
            <Brand tagline />
          </div>
        )}
        <div className={`px-5 py-4 ${sp ? 'mx-3 mt-3 rounded-2xl bg-white/80 shadow-sm' : 'border-b border-line'}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Signed in as</p>
          <p className="mt-1 truncate text-sm font-bold text-ink">{name}</p>
          <p className="text-xs font-semibold text-brand-700">{personaLabel}</p>
          {levelBadge && <div className="mt-1.5"><LevelPill badge={levelBadge} size="sm" /></div>}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList sections={nav} onLockedTap={setLockedFeature} />
        </div>
        {/* Reserved footer: the Ask AI Guru launcher docks here on Spaces enquiry pages, so no sidebar link sits under it. */}
        {guruDock && <div className="h-20 shrink-0 border-t border-line" aria-hidden data-testid="guru-dock-reserve" />}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <Brand tagline />
              <button aria-label="Close menu" onClick={() => setDrawer(false)} className="rounded-lg p-2 text-ink-soft hover:bg-cream">✕</button>
            </div>
            <div className="border-b border-line px-5 py-4">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="text-xs font-semibold text-brand-700">{personaLabel}</p>
              {levelBadge && <div className="mt-1.5"><LevelPill badge={levelBadge} size="sm" /></div>}
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavList sections={nav} onNavigate={() => setDrawer(false)} onLockedTap={setLockedFeature} />
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="md:pl-64">
        <header className={`sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6 ${sp ? 'h-[72px] border-[#EEDFC8] bg-[#FFFAF2]/95 md:-ml-64 md:pl-6' : 'h-16 border-line bg-white/85'}`}>
          <div className="flex min-w-0 items-center gap-2 xl:gap-6">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setDrawer(true)}
              className="rounded-lg p-2 text-ink-soft hover:bg-cream md:hidden"
            >
              ☰
            </button>
            {/* Below ~460px there is no room for the full logo beside the header actions. */}
            <div className={sp ? 'hidden shrink-0 min-[460px]:block' : 'hidden min-[460px]:block md:hidden'}><Brand tagline={sp} /></div>
            {sp && <HeaderNav items={HEADER_NAV} />}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Spaces header carries the full global navigation, so secondary controls show only on wide screens. */}
            <div className={sp ? 'hidden min-[1560px]:block' : undefined}><HeaderLocation /></div>
            {levelBadge && <div className={sp ? 'hidden min-[1700px]:block' : 'hidden sm:block'}><LevelPill badge={levelBadge} /></div>}
            <GlobalSearch pages={pages} />
            <div className={sp ? 'hidden min-[1440px]:block' : undefined}><LanguageSwitcher /></div>
            <Link
              href="/app/notifications"
              aria-label={unreadCount > 0 ? `${t('Notifications')}, ${unreadCount}` : t('Notifications')}
              data-testid="header-bell"
              className="relative grid h-11 w-11 place-items-center rounded-full border border-line text-ink-soft transition hover:bg-cream"
            >
              <span aria-hidden="true">🔔</span>
              {unreadCount > 0 && (
                <span data-testid="bell-badge" className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <AccountMenu name={name} personaLabel={personaLabel} initial={initial} avatarUrl={avatarUrl} />
          </div>
        </header>
        {/* pb-24 on phones keeps the last call-to-action clear of the floating Ask AI Guru launcher. */}
        <main className={`px-4 pt-6 sm:px-6 lg:px-8 ${sp ? 'pb-28' : guruDock ? 'pb-24 md:pb-6' : 'pb-24 sm:pb-6'}`}>{children}</main>
      </div>

      {suggestedLocale && <LanguageSuggestionToast suggested={suggestedLocale} />}
      {lockedFeature && (
        <LockedFeatureToast feature={lockedFeature} reason={lockReason ?? 'Verification required'} onClose={() => setLockedFeature(null)} />
      )}
    </div>
  );
}
