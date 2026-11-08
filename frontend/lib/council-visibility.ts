// Reversible, website-only exclusion of Council records from PUBLIC surfaces:
// the /council roster + its JSON-LD, /council/{slug} (404s), the share cards,
// the public stats count and /sitemap.xml. Nothing is deleted and the main
// backend is never touched — removing a handle from the set restores the
// record everywhere on the next render.
//
// Currently EMPTY on purpose. /council/swami-guru-demo was investigated
// (Oct 2026) and is NOT confirmed test data: the backend marks it
// is_placeholder=false, it is linked to a real user account (user_a22afef7d418,
// self-edited 2026-07-28), and the owner previously ruled it "real — keep
// public" (LAUNCH_FIX_CHANGELOG NST-011). Its content does read like test data
// ("test bio", "Work 1", "Work 2"). To hide it, add 'swami-guru-demo' below.
export const HIDDEN_COUNCIL_HANDLES = new Set<string>([]);

/** The /council/{slug} slug from a roster member URL, or null. */
export function councilSlugFromUrl(u?: unknown): string | null {
  if (typeof u !== 'string') return null;
  const m = /\/council\/([^/?#"']+)/.exec(u);
  return m ? m[1] : null;
}

/** True when a Council handle must not appear on any public surface. `gated` = handles linked
 *  to a Guru nomination that is not published yet (lib/server/council-gate.ts). */
export function isCouncilHandleHidden(slug?: string | null, gated?: ReadonlySet<string>): boolean {
  if (!slug) return false;
  const s = slug.toLowerCase();
  return HIDDEN_COUNCIL_HANDLES.has(s) || !!gated?.has(s);
}

/** Roster members minus any hidden handle (members are the /seo/council Person objects). */
export function visibleCouncilMembers<T extends { url?: unknown }>(members: T[], gated?: ReadonlySet<string>): T[] {
  return members.filter((m) => !isCouncilHandleHidden(councilSlugFromUrl(m?.url), gated));
}

/** /seo/council JSON-LD with hidden members removed from the Organization roster
 *  and from the ItemList (positions renumbered). */
export function withoutHiddenCouncil(jsonld: any[], gated?: ReadonlySet<string>): any[] {
  return jsonld.map((o) => {
    if (o?.['@type'] === 'Organization' && Array.isArray(o.member)) return { ...o, member: visibleCouncilMembers(o.member, gated) };
    if (o?.['@type'] === 'ItemList' && Array.isArray(o.itemListElement)) {
      const items = o.itemListElement
        .filter((li: any) => !isCouncilHandleHidden(councilSlugFromUrl(li?.url ?? li?.item?.url), gated))
        .map((li: any, i: number) => ({ ...li, position: i + 1 }));
      return { ...o, itemListElement: items, ...(o.numberOfItems != null ? { numberOfItems: items.length } : {}) };
    }
    return o;
  });
}
