// Pure interpretation of a retreat-edit save response. Extracted from
// EditRetreatForm so the "never show a false success" rule can be exercised with
// mocked backend responses. No React, no network — just a decision.

export type SaveBffResult = {
  ok: boolean;
  data?: { error?: string; data?: { venue_partner_id?: unknown } };
};

export type SaveOutcome = { ok: boolean; text: string };

/**
 * @param r            the BFF response (ok flag + parsed JSON body)
 * @param sentVenueId  the venue id we submitted ('' when none was sent)
 */
export function interpretRetreatSave(r: SaveBffResult, sentVenueId: string): SaveOutcome {
  // A non-2xx (backend/BFF failure) must surface as an error, never a success.
  if (!r.ok) {
    return { ok: false, text: r.data?.error || 'Could not save changes.' };
  }
  // The remote PATCH response is untyped; only treat an *explicit, mismatched*
  // echo as a problem. A missing echo is tolerated (we re-fetch to confirm).
  const savedId = r.data?.data?.venue_partner_id;
  if (sentVenueId && typeof savedId === 'string' && savedId && savedId !== sentVenueId) {
    return { ok: false, text: 'Saved, but the venue binding could not be confirmed. Please reload and check.' };
  }
  return { ok: true, text: 'Retreat updated ✓' };
}
