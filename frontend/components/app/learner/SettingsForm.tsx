'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

export type Prefs = {
  language: string;
  bookingUpdates: boolean;
  wellnessTips: boolean;
  emailEnabled: boolean;
  marketing: boolean;
  analyticsOptIn: boolean;
};

const LANGUAGES: Array<[string, string]> = [
  ['en', 'English'],
  ['hi', 'हिन्दी (Hindi)'],
  ['ta', 'தமிழ் (Tamil)'],
  ['te', 'తెలుగు (Telugu)'],
  ['kn', 'ಕನ್ನಡ (Kannada)'],
  ['ml', 'മലയാളം (Malayalam)'],
  ['mr', 'मराठी (Marathi)'],
  ['bn', 'বাংলা (Bengali)'],
  ['gu', 'ગુજરાતી (Gujarati)'],
  ['pa', 'ਪੰਜਾਬੀ (Punjabi)'],
];

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {desc && <p className="text-xs text-muted">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

function Banner({ msg }: { msg: { kind: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
        msg.kind === 'ok' ? 'border border-brand/20 bg-brand-50/60 text-brand-700' : 'border border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {msg.text}
    </p>
  );
}

export default function SettingsForm({
  email,
  initialName,
  initialLocation,
  initialPrefs,
}: {
  email: string;
  initialName: string;
  initialLocation: string;
  initialPrefs: Prefs;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [location, setLocation] = useState(initialLocation);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);

  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [prefMsg, setPrefMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    if (name.trim().length < 1) return setProfileMsg({ kind: 'err', text: 'Please enter your name.' });
    setSavingProfile(true);
    const res = await sendBff('/bff/profile', 'PUT', { name: name.trim(), location: location.trim() });
    setSavingProfile(false);
    if (!res.ok) return setProfileMsg({ kind: 'err', text: (res.data as any)?.error || 'Could not save.' });
    setProfileMsg({ kind: 'ok', text: 'Profile saved.' });
    router.refresh();
  }

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    setPrefMsg(null);
    setSavingPrefs(true);
    const res = await sendBff('/bff/settings', 'PATCH', {
      prefs: {
        appearance: { language: prefs.language },
        notifications: {
          booking_updates: prefs.bookingUpdates,
          wellness_tips: prefs.wellnessTips,
          email_enabled: prefs.emailEnabled,
          marketing: prefs.marketing,
        },
        privacy: { analytics_opt_in: prefs.analyticsOptIn },
      },
    });
    setSavingPrefs(false);
    if (!res.ok) return setPrefMsg({ kind: 'err', text: (res.data as any)?.error || 'Could not save.' });
    setPrefMsg({ kind: 'ok', text: 'Preferences saved.' });
  }

  const inputCls =
    'min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50';

  return (
    <div className="space-y-6">
      {/* Profile */}
      <form onSubmit={saveProfile} className="card p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Profile</h2>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">City / location (optional)</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Bengaluru"
            className={inputCls}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Email</span>
          <input type="email" value={email} disabled className={`${inputCls} cursor-not-allowed bg-cream text-muted`} />
        </label>
        <Banner msg={profileMsg} />
        <button
          type="submit"
          disabled={savingProfile}
          className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {savingProfile ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Preferences */}
      <form onSubmit={savePrefs} className="card p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Preferences</h2>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Preferred language</span>
          <select value={prefs.language} onChange={(e) => set('language', e.target.value)} className={inputCls}>
            {LANGUAGES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 divide-y divide-line border-t border-line">
          <h3 className="pt-4 text-xs font-bold uppercase tracking-wider text-muted">Notifications</h3>
          <Toggle label="Booking updates" desc="Session confirmations and reminders" checked={prefs.bookingUpdates} onChange={(v) => set('bookingUpdates', v)} />
          <Toggle label="Wellness tips" desc="Occasional practice guidance" checked={prefs.wellnessTips} onChange={(v) => set('wellnessTips', v)} />
          <Toggle label="Email notifications" checked={prefs.emailEnabled} onChange={(v) => set('emailEnabled', v)} />
          <Toggle label="Offers & marketing" desc="News and promotions" checked={prefs.marketing} onChange={(v) => set('marketing', v)} />
        </div>

        <div className="mt-5 divide-y divide-line border-t border-line">
          <h3 className="pt-4 text-xs font-bold uppercase tracking-wider text-muted">Privacy</h3>
          <Toggle label="Usage analytics" desc="Help us improve NOSTOPS with anonymous usage data" checked={prefs.analyticsOptIn} onChange={(v) => set('analyticsOptIn', v)} />
        </div>

        <Banner msg={prefMsg} />
        <button
          type="submit"
          disabled={savingPrefs}
          className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {savingPrefs ? 'Saving…' : 'Save preferences'}
        </button>
      </form>

      {/* Data */}
      <div className="card p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Your data</h2>
        <p className="mt-2 text-sm text-muted">Download a copy of your NOSTOPS data (profile, bookings, reviews).</p>
        <a
          href="/bff/account/export"
          className="mt-3 inline-block rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700"
        >
          ⬇ Download my data
        </a>
      </div>
    </div>
  );
}
