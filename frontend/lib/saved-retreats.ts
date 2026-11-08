'use client';

// PROMPT 30 — client-side retreat wishlist. The backend has no wishlist endpoint,
// so saved retreats persist to localStorage. A public-safe snapshot is stored so
// the Saved page renders without re-fetching. Mirrors lib/favorites.ts (teachers).
import { useCallback, useEffect, useState } from 'react';

export type SavedRetreat = {
  id: string;
  title: string;
  city?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  priceInr?: number;
  coverImage?: string | null;
  guruName?: string;
  status?: string;
  theme?: string;
  venuePartnerId?: string | null;
};

const KEY = 'nostops.saved-retreats.v1';
const EVT = 'nostops:saved-retreats';

function read(): SavedRetreat[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: SavedRetreat[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode — ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useSavedRetreats() {
  const [list, setList] = useState<SavedRetreat[]>([]);

  useEffect(() => {
    setList(read());
    const sync = () => setList(read());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isSaved = useCallback((id: string) => list.some((r) => r.id === id), [list]);

  const toggle = useCallback((r: SavedRetreat) => {
    const cur = read();
    const exists = cur.some((x) => x.id === r.id);
    write(exists ? cur.filter((x) => x.id !== r.id) : [r, ...cur]);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((x) => x.id !== id));
  }, []);

  return { saved: list, isSaved, toggle, remove };
}
