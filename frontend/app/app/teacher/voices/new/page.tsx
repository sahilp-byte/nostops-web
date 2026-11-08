import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile } from '@/lib/server/teacher';
import { getMyAuthorIdentity, getAuthorFlag } from '@/lib/server/voices';
import VoicesEditor from '@/components/app/teacher/VoicesEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New article · NOSTOPS Voices', robots: { index: false, follow: false } };

function topicsFrom(self: any): string[] {
  const raw = [...(self?.specializations || []), ...(self?.styles || []), self?.parampara].filter(Boolean) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const label = String(t).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (!seen.has(label)) { seen.add(label); out.push(label); }
  }
  return out.slice(0, 30);
}

export default async function NewVoicesArticle() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');

  const me = await getMyAuthorIdentity();
  const isAuthor = me?.teacherId ? await getAuthorFlag(me.teacherId) : false;
  if (!me || !isAuthor) redirect('/app/teacher/voices');

  const { self } = await getTeacherSelfProfile();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app/teacher/voices" className="text-sm font-bold text-brand-700 hover:underline">← Back to my articles</Link>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">New article</h1>
      <p className="mt-1 text-sm text-muted">Publishing as <strong className="text-ink-soft">{me.name}</strong>. Your public profile bio is used as the author bio automatically.</p>
      <div className="mt-6">
        <VoicesEditor initial={{ source_language: 'en' }} topicSuggestions={topicsFrom(self)} />
      </div>
    </div>
  );
}
