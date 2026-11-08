'use client';

// Browser error reporter for the built-in Error Monitor. Sends a small,
// anonymous beacon (message, page, top of the stack — no form data, no user
// details) to /bff/monitoring/client-error. Capped per page load; known browser
// noise (extensions, ResizeObserver, offline fetches) is ignored.
import { redactClaimTokens } from '@/lib/teacher-claim';

const MAX_PER_PAGE = 5;
let sent = 0;
const seen = new Set<string>();
const NOISE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection|Failed to fetch|Load failed|NetworkError|AbortError|cancelled|chrome-extension:|moz-extension:|safari-extension:/i;

export function reportClientError(err: unknown, where: string): void {
  if (typeof window === 'undefined' || sent >= MAX_PER_PAGE) return;
  const e = err as { name?: string; message?: string; stack?: string; digest?: string } | string;
  const message = redactClaimTokens(typeof e === 'string' ? e : `${e?.name || 'Error'}: ${e?.message || 'unknown'}`);
  const stack = redactClaimTokens(typeof e === 'string' ? '' : String(e?.stack || ''));
  if (NOISE.test(message) || NOISE.test(stack.split('\n').slice(0, 3).join(' '))) return;
  const key = `${where}|${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent += 1;
  const body = JSON.stringify({
    where: where.slice(0, 60),
    message: message.slice(0, 400),
    path: redactClaimTokens(window.location.pathname).slice(0, 300), // never report claim tokens
    stack: stack.split('\n').slice(0, 4).join('\n').slice(0, 600),
    digest: typeof e === 'string' ? '' : String(e?.digest || '').slice(0, 60),
  });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon || !navigator.sendBeacon('/bff/monitoring/client-error', blob)) {
      fetch('/bff/monitoring/client-error', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch {
    /* best-effort */
  }
}
