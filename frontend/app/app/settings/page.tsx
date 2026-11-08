import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, backendFetch } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import SettingsForm, { type Prefs } from '@/components/app/learner/SettingsForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings', robots: { index: false, follow: false } };

async function getPrefs(): Promise<Prefs> {
  const fallback: Prefs = {
    language: 'en',
    bookingUpdates: true,
    wellnessTips: true,
    emailEnabled: true,
    marketing: false,
    analyticsOptIn: true,
  };
  try {
    const r = await backendFetch('/me/settings');
    if (!r.ok) return fallback;
    const d = await r.json();
    const p = d?.prefs || {};
    const n = p.notifications || {};
    const a = p.appearance || {};
    const pr = p.privacy || {};
    return {
      language: a.language || 'en',
      bookingUpdates: n.booking_updates !== false,
      wellnessTips: n.wellness_tips !== false,
      emailEnabled: n.email_enabled !== false,
      marketing: !!n.marketing,
      analyticsOptIn: pr.analytics_opt_in !== false,
    };
  } catch {
    return fallback;
  }
}

export default async function SettingsPage() {
  const [user, prefs] = await Promise.all([getSessionUser(), getPrefs()]);
  if (!user) redirect('/login?next=/app/settings');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-black tracking-tight text-ink">Settings</h1>
      <p className="mt-2 text-ink-soft">Manage your profile, language and preferences.</p>

      <div className="mt-6">
        <SettingsForm
          email={user.email || ''}
          initialName={displayName(user)}
          initialLocation={((user as Record<string, unknown>).location as string) || ''}
          initialPrefs={prefs}
        />
      </div>
    </div>
  );
}
