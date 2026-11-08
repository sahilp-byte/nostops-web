'use client';

// Device-local "shortlist" of favourite venues for anonymous visitors.
// Persisted in localStorage (no account needed) and shared across components
// via a tiny external store so the card buttons, header count and the saved
// page all stay in sync — including across browser tabs.
import { useSyncExternalStore } from 'react';

const KEY = 'nostops:saved-venues';
const EMPTY: string[] = [];

function read(): string[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

let cache: string[] = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function write(ids: string[]) {
  cache = ids;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable (private mode / quota) — keep in-memory only */
  }
  emit();
}

export function getSavedIds(): string[] {
  return cache;
}

export function isSavedId(id: string): boolean {
  return cache.includes(id);
}

export function toggleSaved(id: string) {
  if (!id) return;
  write(cache.includes(id) ? cache.filter((x) => x !== id) : [id, ...cache]);
}

/** Adds every id (e.g. from a shared shortlist) that isn't already saved. */
export function saveMany(add: string[]) {
  const fresh = add.filter((id) => id && !cache.includes(id));
  if (fresh.length) write([...fresh, ...cache]);
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  });
}

export function useSavedVenues() {
  const ids = useSyncExternalStore(subscribe, getSavedIds, () => EMPTY);
  return {
    ids,
    count: ids.length,
    isSaved: (id: string) => ids.includes(id),
    toggle: toggleSaved,
    saveMany,
  };
}
