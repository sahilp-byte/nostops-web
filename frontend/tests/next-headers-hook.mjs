// Node resolve hook for route-handler tests (Prompt 2C): `next/headers` only works inside a
// Next.js request, so plain Node gets a stub. Cookies come from globalThis.__qaCookies
// (name → value), set by the test. Request headers (Prompt 2D preview write guard) come from
// globalThis.__qaRequestHeaders. Register it AFTER alias-hooks.mjs (later hooks run first).
const STUB = `
export async function cookies() {
  const m = globalThis.__qaCookies || {};
  return {
    get: (n) => (Object.prototype.hasOwnProperty.call(m, n) ? { name: n, value: m[n] } : undefined),
    getAll: () => Object.entries(m).map(([name, value]) => ({ name, value })),
    has: (n) => Object.prototype.hasOwnProperty.call(m, n),
    set() {},
    delete() {},
  };
}
export async function headers() {
  if (globalThis.__qaNoRequest) throw new Error('headers() called outside a request scope (test)');
  return new Headers(globalThis.__qaRequestHeaders || {});
}
export async function draftMode() { return { isEnabled: false }; }
`;

export async function resolve(spec, ctx, next) {
  if (spec === 'next/headers' || spec === 'next/headers.js') {
    return { url: `data:text/javascript,${encodeURIComponent(STUB)}`, shortCircuit: true };
  }
  return next(spec, ctx);
}
