// Server-only staged-rollout feature flags.
//
// Convention mirrors the existing backend INSTITUTIONAL_ENGINE_ENABLED flag: an
// environment boolean that DEFAULTS OFF. These are read in Server Components /
// route handlers only (never shipped to the client).
function envOn(name: string): boolean {
  const v = (process.env[name] || '').trim().toUpperCase();
  return v === 'TRUE' || v === '1' || v === 'ON';
}

/** Tier 2 AI-Assisted Onboarding — free, open PUBLIC early-access preview. */
export function tier2PreviewEnabled(): boolean {
  return envOn('VENUE_TIER2_PREVIEW');
}

/** Prompt 4D — dedicated gate for NEW venue AI-onboarding checkouts. Open ONLY when the value is
 *  exactly "true"; missing, empty, "false" or any other value keeps new checkouts closed. It is
 *  checked together with the money lock (both must allow a checkout) and is never set by code. */
export function venueCheckoutEnabled(): boolean {
  return process.env.VENUE_CHECKOUT_ENABLED === 'true';
}
