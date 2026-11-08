import { backendFetch } from '@/lib/server/session';

// Admin TOTP 2FA status (auth). Reads GET /api/admin/totp/status. The backend
// owns the secret, enrollment state, lockout and backup codes — the web never
// stores or recomputes any of it.

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export type TotpStatus = {
  isEnabled: boolean;
  isSetupStarted: boolean;
  isLocked: boolean;
  lockedSecondsRemaining: number;
  failedAttempts: number;
  maxAttempts: number;
  backupCodesRemaining: number;
};

export async function getTotpStatus(): Promise<TotpStatus> {
  const res = await backendFetch('/admin/totp/status');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  return {
    isEnabled: !!d.is_enabled,
    isSetupStarted: !!d.is_setup_started,
    isLocked: !!d.is_locked,
    lockedSecondsRemaining: num(d.locked_seconds_remaining),
    failedAttempts: num(d.failed_attempts),
    maxAttempts: num(d.max_attempts) || 5,
    backupCodesRemaining: num(d.backup_codes_remaining),
  };
}
