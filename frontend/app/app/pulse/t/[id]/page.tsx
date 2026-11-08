import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePulseParticipant, getPulseThread } from '@/lib/server/pulse';
import { timeAgo, initials, avatarColor } from '@/lib/pulse-ui';
import ReplyComposer from '@/components/app/pulse/ReplyComposer';
import ReportButton from '@/components/app/pulse/ReportButton';
import OwnPostActions from '@/components/app/pulse/OwnPostActions';
import AuthorName from '@/components/app/pulse/AuthorName';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Discussion · Teacher Pulse', robots: { index: false, follow: false } };

export default async function PulseThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, config } = await requirePulseParticipant();
  const { id } = await params;
  const data = await getPulseThread(actor, id);
  if (!data || !data.thread) notFound();

  const { thread, posts } = data;
  const me = actor.user_id;
  const readOnly = config.status === 'ARCHIVED' || config.status === 'PRE_LAUNCH';
  const locked = thread.status === 'LOCKED';
  const canReply = !readOnly && !locked;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={thread.category_slug ? `/app/pulse/c/${thread.category_slug}` : '/app/pulse'} className="text-xs font-bold uppercase tracking-wider text-brand-700">
        ← {thread.category_name || 'Teacher Pulse'}
      </Link>

      {/* Original post */}
      <article className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {thread.official && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Official · NOSTOPS</span>}
          {thread.pinned && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent-600">📌 Pinned</span>}
          {locked && <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted">🔒 Locked</span>}
        </div>
        <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-tight text-ink">{thread.title}</h1>
        <div className="mt-2 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: avatarColor(thread.author_name) }} aria-hidden="true">{initials(thread.author_name)}</span>
          <div className="text-xs text-muted">
            <AuthorName name={thread.author_name} handle={thread.author_handle} isPublic={thread.author_public} /> · {thread.author_persona} · {timeAgo(thread.created_at)}
            {thread.edited_at ? ' · edited' : ''}
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{thread.body}</p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <OwnPostActions kind="thread" id={thread.id} isOwner={thread.author_id === me} initialTitle={thread.title} initialBody={thread.body} />
          <ReportButton targetType="thread" targetId={thread.id} />
        </div>
      </article>

      {/* Replies */}
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">{thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}</h2>
        <div className="mt-3 space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: avatarColor(p.author_name) }} aria-hidden="true">{initials(p.author_name)}</span>
                <div className="text-xs text-muted">
                  <AuthorName name={p.author_name} handle={p.author_handle} isPublic={p.author_public} /> · {p.author_persona} · {timeAgo(p.created_at)}{p.edited_at ? ' · edited' : ''}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{p.body}</p>
              <div className="mt-2 flex items-center justify-between">
                <OwnPostActions kind="post" id={p.id} isOwner={p.author_id === me} initialBody={p.body} />
                <ReportButton targetType="post" targetId={p.id} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply composer */}
      <ReplyComposer threadId={thread.id} disabled={!canReply} disabledReason={locked ? 'This discussion is locked by a moderator.' : 'This community is read-only right now.'} />
    </div>
  );
}
