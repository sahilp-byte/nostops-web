'use client';

import Link from 'next/link';
import { useFavorites } from '@/lib/favorites';
import FavoriteButton from '@/components/app/learner/FavoriteButton';
import { initials } from '@/lib/format';

export default function SavedPage() {
  const { favorites } = useFavorites();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-black tracking-tight text-ink">Saved teachers</h1>
      <p className="mt-2 text-ink-soft">Teachers you&apos;ve bookmarked to come back to.</p>

      {favorites.length === 0 ? (
        <div className="mt-6 card p-8 text-center">
          <p className="font-semibold text-ink">No saved teachers yet</p>
          <p className="mt-1 text-sm text-muted">Tap the ♡ on any teacher to save them here for later.</p>
          <Link
            href="/app/discover"
            className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Discover teachers
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((t) => {
            const src = t.avatarUrl
              ? t.avatarUrl
              : t.avatarB64
                ? t.avatarB64.startsWith('data:')
                  ? t.avatarB64
                  : `data:image/jpeg;base64,${t.avatarB64}`
                : null;
            return (
              <li key={t.handle} className="relative">
                <Link
                  href={`/app/teachers/${t.handle}`}
                  className="card group flex h-full items-center gap-3 p-4 transition hover:border-brand hover:shadow-sm"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={t.name} width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-black text-brand-700">
                      {initials(t.name)}
                    </span>
                  )}
                  <span className="min-w-0 pr-8">
                    <span className="block truncate font-extrabold tracking-tight text-ink group-hover:text-brand-700">{t.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {t.city || 'India'}
                      {t.rating ? ` · ★ ${t.rating.toFixed(1)}` : ''}
                    </span>
                  </span>
                </Link>
                <FavoriteButton className="absolute right-3 top-1/2 z-10 -translate-y-1/2" teacher={t} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
