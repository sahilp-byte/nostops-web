// SINGLE SOURCE OF TRUTH for the PUBLIC teacher-profile policy (Prompt 30).
//
// Both the directory (/teachers) and each profile page (/teachers/[handle]) must
// agree on exactly who is publicly listable, so a card can never link to a page
// that 404s and public "Verified / Empanelled" claims are always authoritative.
//
// FOUNDATIONAL RULE: a teacher must be Verified BEFORE Empanelment. Profiles are
// listed when active + visible + not suspended (Hybrid policy); trust badges come
// from publicTrust() below — never from client state.

// Handles that are HARD-EXCLUDED from every public surface (directory, profile
// page, dynamic OG/Twitter image, and sitemap) regardless of their backend
// flags. The business backend has no user-delete capability, so this is how we
// permanently retire a specific public profile from the website. The underlying
// DB record and the in-app (authenticated) experience are left untouched.
/** A town/city a learner can search for. Many profiles carry only the country
 *  ("India") in the city field — that never matches a city search, so it counts as missing. */
export function hasRealCity(city?: string | null, country?: string | null): boolean {
  const c = String(city || '').trim().toLowerCase();
  if (!c) return false;
  return c !== 'india' && c !== 'bharat' && c !== String(country || '').trim().toLowerCase();
}

export const HIDDEN_PUBLIC_HANDLES = new Set<string>([
  'demo-user-india',
  'yoga-shikshak-demo', // "Anjali Teacher" demo persona
  'anjali-teacher-m', // "Anjali Teacher" demo persona (alt handle)
  'riya-admin-m', // "Riya Admin" test account
  'test-seeker2-de34084e', // "TEST Teacher2"
  'test-seeker-6f4624f8', // "TEST Teacher"
  'test11', // test-style handle; Sarika Kakade's verified profile is sarika-kakade-p (owner: hide)
  'name1', // test-style handle "Neha Thakur" (owner: hide)
  'drishti-ladies-yoga-classes-pune', // project QA teacher account (owner: hide)
  'grace-international-yoga-london', // project QA international teacher account (owner: hide)
]);

// Teachers an admin deleted from the website (Admin › Homepage & Listings). Refreshed on the server
// by every public teacher read (lib/api.ts), so handle-only checks (voices authors, retreat hosts,
// OG images, city coordinators) hide them too. Always empty in the browser.
const removedHandles = new Set<string>();
export function noteRemovedHandles(handles: Iterable<string>): void {
  removedHandles.clear();
  for (const h of handles) removedHandles.add(String(h).toLowerCase());
}

/** True when a handle must never be exposed on any public surface. */
export function isPublicHandleBlocked(handle?: string | null): boolean {
  if (!handle) return false;
  const h = String(handle).toLowerCase();
  return HIDDEN_PUBLIC_HANDLES.has(h) || removedHandles.has(h);
}

/** Active + visible + not suspended + not hidden (has a usable public handle). */
export function isTeacherActivePublic(t: any): boolean {
  return (
    !!t?.handle &&
    !isPublicHandleBlocked(t.handle) &&
    t.public_profile_visible !== false &&
    t.is_active !== false &&
    !t.suspended_at
  );
}

/** B4.7 — the ONE public trust definition (owner decision). "✓ Verified" only when
 *  the identity check passed (kyc_verified) AND the teacher is empanelled; otherwise
 *  each real status is shown on its own. Computed server-side from the backend
 *  record — the raw KYC flag itself never reaches the browser. */
export type PublicTrust = { verified: boolean; empanelled: boolean; idChecked: boolean };

export function publicTrust(t: any): PublicTrust {
  const idChecked = t?.kyc_verified === true;
  const empanelled = t?.is_empanelled === true;
  return { verified: idChecked && empanelled, empanelled, idChecked };
}
