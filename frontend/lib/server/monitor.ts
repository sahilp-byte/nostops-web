import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';

// Server-side reporter for the built-in Error Monitor (backend/monitoring.py).
// Fire-and-forget: never awaited by callers' critical path, never throws, and
// never sends credentials or personal data — only where/what failed.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export type MonitorKind = 'page' | 'server' | 'payment' | 'email';

export function reportEvent(
  kind: MonitorKind,
  source: string,
  message: string,
  opts: { path?: string; status?: number | null; context?: Record<string, string | number | boolean | null> } = {},
): void {
  if (!SECRET) return;
  fetch(`${BASE}/api/monitoring/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
    body: JSON.stringify({
      kind,
      source: source.slice(0, 120),
      message: (message || 'error').slice(0, 500),
      path: (opts.path || '').slice(0, 300),
      status: opts.status ?? null,
      context: opts.context || {},
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

/** For payment relays: report when the payment backend failed (5xx) or never answered. */
export function reportPaymentUpstream(route: string, status: number | null, detail = ''): void {
  if (status !== null && status < 500) return;
  reportEvent('payment', `bff ${route}`, status === null ? 'Payment service did not respond' : `Payment service returned HTTP ${status}`, {
    path: route,
    status,
    context: detail ? { detail: detail.slice(0, 200) } : {},
  });
}
