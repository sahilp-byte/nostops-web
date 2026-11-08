'use client';

import { useEffect, useState } from 'react';
import { sendBff } from '@/lib/auth-client';

// NOSTOPS partner emails (monthly summary + one widget reminder) on/off for the owner. Used in the toolkit (kit token) and on the
// page the email's "Stop these monthly emails" link opens (pref token).
export default function EmailPreference({ token, kind, initialEnabled, widgetOnOwnSite, compact }: {
  token: string; kind: 'kit' | 'pref'; initialEnabled: boolean; widgetOnOwnSite: boolean; compact?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false); // the button works only once the page is interactive
  useEffect(() => setReady(true), []);

  async function toggle() {
    setBusy(true);
    setErr('');
    const r = await sendBff<{ enabled?: boolean; error?: string }>('/bff/venue-growth/monthly-preference', 'POST', { token, kind, enabled: !enabled });
    setBusy(false);
    if (!r.ok) return setErr(r.data?.error || 'Could not update your email preference.');
    setEnabled(!!r.data?.enabled);
  }

  return (
    <div className={compact ? '' : 'rounded-2xl border border-line bg-white p-5'} data-testid="email-preference" data-enabled={enabled ? '1' : '0'}>
      <p className="text-sm font-black text-ink">📬 NOSTOPS partner emails: {enabled ? 'on' : 'off'}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        {enabled
          ? widgetOnOwnSite
            ? 'On the 1st of each month we email you last month’s invitation counts.'
            : 'A monthly summary of your invitation counts once your widget is live on your own website, and one gentle reminder if it isn’t.'
          : 'You won’t receive the monthly summary or the reminder. You can turn them back on at any time.'}
      </p>
      <button
        type="button"
        onClick={toggle}
        disabled={busy || !ready}
        className={`mt-3 min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${enabled ? 'border border-line bg-white text-ink-soft hover:bg-cream' : 'bg-brand text-white hover:bg-brand-600'}`}
        data-testid="email-preference-toggle"
      >
        {busy ? 'Saving…' : enabled ? 'Stop partner emails' : 'Turn partner emails on'}
      </button>
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{err}</p>}
    </div>
  );
}
