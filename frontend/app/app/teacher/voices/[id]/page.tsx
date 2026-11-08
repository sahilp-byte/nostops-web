import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile } from '@/lib/server/teacher';
import { getMyAuthorIdentity, getAuthorFlag, getMyArticle } from '@/lib/server/voices';
import VoicesEditor from '@/components/app/teacher/VoicesEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit article · NOSTOPS Voices', robots: { index: false, follow: false } };

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

export default async function EditVoicesArticle({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');

  const me = await getMyAuthorIdentity();
  const isAuthor = me?.teacherId ? await getAuthorFlag(me.teacherId) : false;
  if (!me || !isAuthor) redirect('/app/teacher/voices');

  const { id } = await params;
  const article = await getMyArticle(me.teacherId, id);
  if (!article) notFound();

  // Only drafts / rejected articles are editable; otherwise send back to the list.
  if (article.status !== 'DRAFT' && article.status !== 'REJECTED') redirect('/app/teacher/voices');

  const { self } = await getTeacherSelfProfile();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app/teacher/voices" className="text-sm font-bold text-brand-700 hover:underline">← Back to my articles</Link>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Edit article</h1>
      {article.status === 'REJECTED' && article.rejection_reason && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><strong>Editor note:</strong> {article.rejection_reason}</p>
      )}
      <div className="mt-6">
        <VoicesEditor
          initial={{
            id: article.id,
            title: article.title,
            type: article.type,
            topic: article.topic,
            source_language: article.source_language,
            content_md: article.content_md,
            summary: article.summary,
            consent: article.consent,
            status: article.status,
          }}
          topicSuggestions={topicsFrom(self)}
        />
      </div>
    </div>
  );
}
