'use client';

// Device-local pick list (max 3) for the side-by-side programme comparison.
// Persisted in localStorage and shared across components via a tiny external
// store so the card toggles, the tray and other tabs stay in sync.
import { useSyncExternalStore } from 'react';
import { MAX_COMPARE } from '@/lib/programme-compare-url';

export type ComparePick = { slug: string; name: string };

const KEY = 'nostops:compare-programmes';
const EMPTY: ComparePick[] = [];

function read(): ComparePick[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const arr = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr)
      ? arr.filter((x) => x && typeof x.slug === 'string' && typeof x.name === 'string').slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}

let cache: ComparePick[] = read();
const listeners = new Set<() => void>();

function write(next: ComparePick[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  for (const l of listeners) l();
}

export function toggleCompare(pick: ComparePick) {
  if (cache.some((p) => p.slug === pick.slug)) write(cache.filter((p) => p.slug !== pick.slug));
  else if (cache.length < MAX_COMPARE) write([...cache, pick]);
}

/** Replace the pick list (e.g. with the programmes of an opened comparison link). */
export function setCompare(picks: ComparePick[]) {
  write(picks.slice(0, MAX_COMPARE));
}

export function clearCompare() {
  write([]);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = read();
      for (const l of listeners) l();
    }
  });
}

export function useProgrammeCompare() {
  const picks = useSyncExternalStore(subscribe, () => cache, () => EMPTY);
  return {
    picks,
    has: (slug: string) => picks.some((p) => p.slug === slug),
    full: picks.length >= MAX_COMPARE,
  };
}
