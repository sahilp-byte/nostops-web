// Multi-draft store for the "Host your retreat" wizard. Teachers can keep
// several in-progress retreat drafts on their device and resume or delete each
// from a single Drafts page. No backend draft API exists, so drafts live in
// localStorage. One-time migrates the earlier single-draft key.
import type { RetreatDraft } from '@/lib/retreat-draft';

export type SavedDraft = RetreatDraft & { id: string; savedAt: number };

const KEY = 'nostops.retreatdrafts.v1';
const LEGACY_KEY = 'nostops.retreatdraft.v1';

function readAll(): Record<string, SavedDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, SavedDraft>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function newDraftId(): string {
  return `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

let migrated = false;
function ensureMigrated(): void {
  if (migrated || typeof window === 'undefined') return;
  migrated = true;
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return;
    const d = JSON.parse(legacyRaw) as RetreatDraft;
    const meaningful = !!(d && (d.title?.trim() || d.shortDesc?.trim() || d.venueName?.trim()));
    if (meaningful) {
      const map = readAll();
      const id = newDraftId();
      map[id] = { ...d, id, savedAt: (d as SavedDraft).savedAt || Date.now() };
      writeAll(map);
    }
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function listDrafts(): SavedDraft[] {
  ensureMigrated();
  return Object.values(readAll()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export function getDraft(id: string): SavedDraft | null {
  ensureMigrated();
  return readAll()[id] || null;
}

export function saveDraft(id: string, d: RetreatDraft): void {
  if (typeof window === 'undefined') return;
  const map = readAll();
  map[id] = { ...d, id, savedAt: Date.now() };
  writeAll(map);
}

export function deleteDraft(id: string): void {
  if (typeof window === 'undefined') return;
  const map = readAll();
  delete map[id];
  writeAll(map);
}
