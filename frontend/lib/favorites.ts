'use client';

// Client-side saved teachers ("favourites"). The backend has no favourites
// endpoint, so this persists to localStorage in the browser. A snapshot of the
// public-safe teacher card is stored so the Saved page can render without
// re-fetching. Never stores any private data.
import { useCallback, useEffect, useState } from 'react';

export type FavTeacher = {
  handle: string;
  name: string;
  city?: string;
  parampara?: string;
  rating?: number;
  avatarUrl?: string | null;
  avatarB64?: string | null;
};

const KEY = 'nostops.favourites.v1';
const EVT = 'nostops:favourites';

function read(): FavTeacher[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: FavTeacher[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode — ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useFavorites() {
  const [list, setList] = useState<FavTeacher[]>([]);

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

  const isFav = useCallback((handle: string) => list.some((t) => t.handle === handle), [list]);

  const toggle = useCallback((t: FavTeacher) => {
    const cur = read();
    const exists = cur.some((x) => x.handle === t.handle);
    write(exists ? cur.filter((x) => x.handle !== t.handle) : [t, ...cur]);
  }, []);

  return { favorites: list, isFav, toggle };
}
