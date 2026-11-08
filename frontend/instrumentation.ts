// Next.js instrumentation: report every server-side render / route-handler
// error to the built-in Error Monitor (backend/monitoring.py), which groups them
// and emails an alert. Runs only in the Node.js runtime; never throws.
export async function register() {}

type ErrorContext = { routerKind: string; routePath: string; routeType: string };

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers?: Record<string, string | string[] | undefined> },
  context: ErrorContext,
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const secret = process.env.PULSE_SHARED_SECRET || '';
  if (!secret) return;
  const base = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
  const e = err as { name?: string; message?: string; digest?: string };
  try {
    // Prompt 2F — an error during a signed test request goes to the backend's test log.
    const { testTagFrom, TEST_TAG_HEADER } = await import('./lib/server/test-tag');
    const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
    const tag = testTagFrom({ get: (n: string) => one(request.headers?.[n]) });
    await fetch(`${base}/api/monitoring/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pulse-Secret': secret, ...(tag ? { [TEST_TAG_HEADER]: tag } : {}) },
      body: JSON.stringify({
        kind: /\/bff\/.*(pay|order|reserve|group-book|checkout|venue-onboarding)/.test(request.path) ? 'payment' : 'page',
        source: `next ${context.routeType} ${request.method}`.slice(0, 120),
        message: `${e?.name || 'Error'}: ${e?.message || 'unknown'}`.slice(0, 500),
        path: (context.routePath || request.path || '').slice(0, 300),
        status: 500,
        context: { digest: e?.digest || '', url: (request.path || '').split('?')[0].slice(0, 300) },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* monitoring must never affect the request */
  }
}
