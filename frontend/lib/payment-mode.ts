// B4.7 Workstream D — preview payment isolation (PURE; used by the BFF guard and
// by client components for the test-mode notice).
//
// The Cashfree account this workspace is connected to is LIVE and there are no
// sandbox keys, so a preview / local host must never start a checkout. Production
// hosts (www.nostops.org, *.emergent.host) are unaffected. Unknown host → blocked.
const PREVIEW_SUFFIXES = ['.preview.emergentagent.com', '.preview.emergentcf.cloud'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export const PAYMENTS_DISABLED_MESSAGE =
  'Test mode: payments are turned off in this preview. No order was created and nothing was charged.';

/** Prompt 4D — shown when NEW venue AI-onboarding checkouts are closed (money lock or venue gate). */
export const VENUE_CHECKOUT_UNAVAILABLE_MESSAGE = "Checkout isn't available right now. Your free listing isn't affected.";

export function bareHost(value?: string | null): string {
  const h = String(value || '').split(',')[0].trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1).split(']')[0];
  return (h.match(/:/g) || []).length === 1 ? h.split(':')[0] : h;
}

export function isPreviewSuffix(value?: string | null): boolean {
  const h = bareHost(value);
  return PREVIEW_SUFFIXES.some((s) => h.endsWith(s));
}

/** Preview, local or unknown host — never allowed to start a payment. */
export function isPaymentTestHost(value?: string | null): boolean {
  const h = bareHost(value);
  return !h || LOCAL_HOSTS.has(h) || h.endsWith('.local') || isPreviewSuffix(h);
}

/** Prompt 4F — PayPal's own approval page for each environment (exact host, https only). */
export const PAYPAL_CHECKOUT_HOSTS = { sandbox: 'www.sandbox.paypal.com', production: 'www.paypal.com' } as const;
export function isPayPalApproveUrl(url: unknown, mode: 'sandbox' | 'production'): boolean {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' && u.hostname === PAYPAL_CHECKOUT_HOSTS[mode];
  } catch {
    return false;
  }
}
