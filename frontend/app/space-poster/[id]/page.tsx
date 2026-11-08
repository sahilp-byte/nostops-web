import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getMySpace } from '@/lib/server/spaces';
import { SPACE_MODELS, SPACE_TYPES } from '@/lib/spaces';
import { canonical } from '@/lib/site';
import SpacePoster from '@/components/spaces/SpacePoster';

// Printable A4 poster for an owner's APPROVED Space (owner-only; outside the app shell so it prints cleanly).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Space poster', robots: { index: false, follow: false } };

export default async function SpacePosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/space-poster/${encodeURIComponent(id)}`);
  const s = await getMySpace(id);
  if (!s || s.status !== 'approved') notFound();
  return (
    <SpacePoster
      url={canonical(`/spaces/${encodeURIComponent(s.id)}`)}
      name={s.name || 'NOSTOPS Space'}
      place={[s.location?.locality, s.location?.district].filter(Boolean).join(', ') + (s.location?.pin ? ` · PIN ${s.location.pin}` : '')}
      model={SPACE_MODELS[s.model || '']?.label || ''}
      type={SPACE_TYPES[s.space_type || ''] || ''}
      capacity={s.capacity || 0}
      photo={s.photos?.[0] || ''}
    />
  );
}
