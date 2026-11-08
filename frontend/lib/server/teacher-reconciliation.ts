import { HIDDEN_PUBLIC_HANDLES } from '@/lib/public-teacher';
import type { RosterTeacher } from '@/lib/server/admin-teachers';

// READ-ONLY classification of the registered-teacher roster (Teacher Record Reconciliation).
// Uses ONLY the fields GET /admin/people/teachers returns, plus the website's own hidden-handle
// list and site removals. Nothing is changed, published, deleted or messaged.
//
// The roster does NOT return: an onboarding draft, KYC status, a claimed-listing flag,
// profile completeness or public_profile_visible. Categories that need them are reported as
// "not determinable" rather than guessed.
export type CategoryKey = 'no_profile' | 'draft' | 'claimed_kyc' | 'listed' | 'hidden' | 'removed' | 'other';

export const CATEGORIES: { key: CategoryKey; label: string; rule: string; determinable: boolean }[] = [
  { key: 'no_profile', label: '1 · Registered, no public profile', rule: 'No handle. The roster does not say whether a server draft exists.', determinable: true },
  { key: 'draft', label: '2 · Server draft in progress', rule: 'Not determinable: the roster does not return the onboarding draft or its last screen.', determinable: false },
  { key: 'claimed_kyc', label: '3 · Claimed listing awaiting KYC', rule: 'Not determinable: the roster does not return KYC status or a claimed-listing flag.', determinable: false },
  { key: 'listed', label: '4 · Active with a public handle', rule: 'Has a handle, active, not suspended or deleted, not hidden or removed. Profile completeness and public_profile_visible are not returned.', determinable: true },
  { key: 'hidden', label: '5 · Hidden by HIDDEN_PUBLIC_HANDLES', rule: 'Handle is on the website’s hidden list (lib/public-teacher.ts).', determinable: true },
  { key: 'removed', label: '6 · Removed via site removals', rule: 'Handle or teacher id is on the Homepage & Listings removals list.', determinable: true },
  { key: 'other', label: '7 · Other / inconsistent', rule: 'Deleted, suspended, inactive, a non-active status, or a duplicate email / account / handle.', determinable: true },
];

export type ClassifiedRow = {
  ref: string;
  teacher: RosterTeacher;
  category: CategoryKey;
  flags: string[];
};

function dupes(items: RosterTeacher[], key: (t: RosterTeacher) => string | null): Set<string> {
  const seen = new Map<string, number>();
  for (const t of items) {
    const k = key(t);
    if (k) seen.set(k, (seen.get(k) || 0) + 1);
  }
  return new Set([...seen].filter(([, c]) => c > 1).map(([k]) => k));
}

export function classifyRoster(items: RosterTeacher[], removed: ReadonlySet<string>, now = Date.now()): ClassifiedRow[] {
  const email = (t: RosterTeacher) => (t.email ? t.email.trim().toLowerCase() : null);
  const handle = (t: RosterTeacher) => (t.handle ? t.handle.trim().toLowerCase() : null);
  const dEmail = dupes(items, email);
  const dUser = dupes(items, (t) => t.user_id);
  const dHandle = dupes(items, handle);
  const dId = dupes(items, (t) => t.teacher_id || null);

  return items.map((t, i) => {
    const h = handle(t);
    const flags: string[] = [];
    if (t.deleted_at) flags.push('deleted_at set');
    if (t.suspended_until && Date.parse(t.suspended_until) > now) flags.push('suspended');
    if (t.is_active === false) flags.push('inactive');
    if (t.status && t.status !== 'active') flags.push(`status “${t.status}”`);
    if (!t.teacher_id) flags.push('no teacher id');
    if (t.teacher_id && dId.has(t.teacher_id)) flags.push('duplicate teacher id');
    if (email(t) && dEmail.has(email(t)!)) flags.push('duplicate email');
    if (t.user_id && dUser.has(t.user_id)) flags.push('duplicate account');
    if (h && dHandle.has(h)) flags.push('duplicate handle');

    let category: CategoryKey;
    if ((h && removed.has(h)) || (t.teacher_id && removed.has(t.teacher_id.toLowerCase()))) category = 'removed';
    else if (h && HIDDEN_PUBLIC_HANDLES.has(h)) category = 'hidden';
    else if (flags.length > 0) category = 'other';
    else if (!h) category = 'no_profile';
    else category = 'listed';
    return { ref: `T-${String(i + 1).padStart(3, '0')}`, teacher: t, category, flags };
  });
}

/** "jane.doe@gmail.com" → "j•••@gmail.com" */
export function maskEmail(e: string | null): string {
  if (!e || !e.includes('@')) return '—';
  const [u, d] = e.split('@');
  return `${u.slice(0, 1)}•••@${d}`;
}
