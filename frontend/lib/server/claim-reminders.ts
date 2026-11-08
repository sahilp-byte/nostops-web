import 'server-only';
import { testTagHeaders } from '@/lib/server/test-tag';

// Server-only client for the finish-your-profile reminders (/api/claim-reminders/*) — shared secret.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export function claimReminderFetch(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  return fetch(`${BASE}/api/claim-reminders${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Pulse-Secret': SECRET,
      ...testTagHeaders(),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function getStopInfo(token: string): Promise<{ name: string; stopped: boolean } | null> {
  if (!token) return null;
  try {
    const r = await claimReminderFetch(`/stop-info?token=${encodeURIComponent(token.slice(0, 400))}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
