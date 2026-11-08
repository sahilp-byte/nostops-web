'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { getBff, postBff } from '@/lib/auth-client';
import type { TotpStatus } from '@/lib/server/admin-totp';

// Admin TOTP 2FA panel (auth). The backend owns the secret, verification,
// lockout and backup codes. This panel only renders provisioning data returned
// to the enrolling admin's own browser and submits 6-digit codes through the
// admin-guarded, CSRF-protected BFF. Nothing is persisted client-side.

type SetupData = { provisioningUri: string; secret: string; backupCodes: string[]; warning: string };

function CodeInput({ value, onChange, testid }: { value: string; onChange: (v: string) => void; testid: string }) {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={11}
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, ''))}
      placeholder="123456"
      data-testid={testid}
      className="w-40 rounded-lg border border-line bg-white px-3 py-2 text-center text-lg font-black tracking-[0.3em] text-ink outline-none focus:border-brand"
    />
  );
}

export default function TotpPanel({ initial }: { initial: TotpStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<TotpStatus>(initial);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const res = await getBff<{ ok: boolean; status: any }>('/bff/admin/totp/status');
    if (res.ok && res.data?.status) {
      const s = res.data.status;
      setStatus({
        isEnabled: !!s.is_enabled,
        isSetupStarted: !!s.is_setup_started,
        isLocked: !!s.is_locked,
        lockedSecondsRemaining: Number(s.locked_seconds_remaining) || 0,
        failedAttempts: Number(s.failed_attempts) || 0,
        maxAttempts: Number(s.max_attempts) || 5,
        backupCodesRemaining: Number(s.backup_codes_remaining) || 0,
      });
    }
  }

  async function startSetup() {
    setError(null); setNotice(null); setBusy(true);
    const res = await postBff<SetupData & { ok: boolean; error?: string }>('/bff/admin/totp/setup', {});
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not start setup.'); return; }
    setSetupData({ provisioningUri: res.data.provisioningUri, secret: res.data.secret, backupCodes: res.data.backupCodes || [], warning: res.data.warning || '' });
  }

  async function verify() {
    setError(null); setBusy(true);
    const res = await postBff('/bff/admin/totp/verify', { code });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'That code was not accepted.'); return; }
    setSetupData(null); setCode(''); setNotice('Two-factor authentication is now enabled.');
    await refresh(); router.refresh();
  }

  async function disable() {
    setError(null); setBusy(true);
    const res = await postBff('/bff/admin/totp/disable', { code });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'That code was not accepted.'); return; }
    setCode(''); setNotice('Two-factor authentication has been disabled.');
    await refresh(); router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="totp-panel">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${status.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <p className="text-sm font-black text-ink" data-testid="totp-status">
          {status.isEnabled ? '2FA is enabled' : 'Two-factor authentication is not enabled'}
        </p>
      </div>
      {status.isEnabled && (
        <p className="mt-1 text-xs text-muted">{status.backupCodesRemaining} backup codes remaining.</p>
      )}
      {status.isLocked && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700" role="alert">
          Locked after too many attempts. Try again in {status.lockedSecondsRemaining}s.
        </p>
      )}

      {notice && <p data-testid="totp-notice" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{notice}</p>}
      {error && <p data-testid="totp-error" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

      {/* Not enabled + not yet in setup → offer to start */}
      {!status.isEnabled && !setupData && (
        <div className="mt-4">
          <p className="text-sm text-ink-soft">
            Protect the operations console with an authenticator app (Google Authenticator, Authy, 1Password). You&apos;ll
            scan a QR code once, then enter a 6-digit code to confirm.
          </p>
          <button type="button" onClick={startSetup} disabled={busy || status.isLocked} data-testid="totp-start" className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {busy ? 'Starting…' : 'Set up 2FA'}
          </button>
        </div>
      )}

      {/* Enrollment in progress */}
      {setupData && (
        <div className="mt-4">
          <h3 className="text-sm font-black text-ink">1 · Scan this QR code</h3>
          {setupData.provisioningUri ? (
            <div className="mt-2 inline-block rounded-xl border border-line bg-white p-3">
              <QRCodeSVG value={setupData.provisioningUri} size={200} includeMargin title="Scan with your authenticator app" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Enter the secret manually below.</p>
          )}
          {setupData.secret && (
            <p className="mt-2 text-xs text-ink-soft">Can&apos;t scan? Enter this key: <code className="rounded bg-cream px-1.5 py-0.5 font-mono text-ink">{setupData.secret}</code></p>
          )}

          <h3 className="mt-4 text-sm font-black text-ink">2 · Save your backup codes</h3>
          <p className="text-xs text-accent-600">{setupData.warning || 'Store these offline. They are shown only once.'}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-cream p-3 sm:grid-cols-5" data-testid="totp-backup-codes">
            {setupData.backupCodes.map((c) => <code key={c} className="text-center font-mono text-xs text-ink">{c}</code>)}
          </div>

          <h3 className="mt-4 text-sm font-black text-ink">3 · Enter the 6-digit code</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CodeInput value={code} onChange={setCode} testid="totp-verify-code" />
            <button type="button" onClick={verify} disabled={busy || code.length < 6} data-testid="totp-verify" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {busy ? 'Verifying…' : 'Verify & enable'}
            </button>
            <button type="button" onClick={() => { setSetupData(null); setCode(''); setError(null); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream">Cancel</button>
          </div>
        </div>
      )}

      {/* Enabled → allow disable */}
      {status.isEnabled && !setupData && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-sm font-black text-ink">Disable 2FA</h3>
          <p className="text-xs text-muted">Enter a current authenticator (or backup) code to turn off 2FA.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CodeInput value={code} onChange={setCode} testid="totp-disable-code" />
            <button type="button" onClick={disable} disabled={busy || code.length < 6 || status.isLocked} data-testid="totp-disable" className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50">
              {busy ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
