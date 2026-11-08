import type { Metadata } from 'next';
import Link from 'next/link';
import { growthFetch } from '@/lib/server/venue-growth';
import EmailPreference from '@/components/venues/growth/EmailPreference';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'NOSTOPS partner emails', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ t?: string }> };

// Opened from "Stop these monthly emails" in the Venue Partner monthly email. A button press
// (not the link itself) changes the setting, so mail scanners can't unsubscribe anyone.
export default async function EmailPreferencesPage({ searchParams }: Props) {
  const token = ((await searchParams).t || '').trim().slice(0, 400);
  const pref = token
    ? await growthFetch(`/monthly/preference?token=${encodeURIComponent(token)}&kind=pref`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    : null;

  return (
    <main className="container-x mx-auto max-w-lg py-16" data-testid="email-preferences-page">
      {pref ? (
        <>
          <h1 className="text-2xl font-black tracking-tight text-ink">NOSTOPS partner emails</h1>
          <p className="mt-2 text-ink-soft">For <strong className="text-ink">{pref.name}</strong></p>
          <div className="mt-6">
            <EmailPreference token={token} kind="pref" initialEnabled={!!pref.enabled} widgetOnOwnSite={!!pref.widget_on_own_site} />
          </div>
        </>
      ) : (
        <div className="text-center" data-testid="email-preferences-invalid">
          <h1 className="text-2xl font-black tracking-tight text-ink">This link isn&apos;t valid</h1>
          <p className="mt-2 text-ink-soft">Please use the link in your most recent NOSTOPS email, or open your venue toolkit.</p>
          <Link href="/venues/submit/edit" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Get a fresh link</Link>
        </div>
      )}
    </main>
  );
}
