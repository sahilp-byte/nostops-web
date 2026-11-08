import Link from 'next/link';
import { timeAgo, initials, avatarColor, type PulseThreadLite } from '@/lib/pulse-ui';

// Presentational discussion row used in the home + category listings.
export default function ThreadCard({ thread }: { thread: PulseThreadLite }) {
  const color = avatarColor(thread.author_name);
  return (
    <Link
      href={`/app/pulse/t/${thread.id}`}
      data-testid="pulse-thread-card"
      className="block rounded-2xl border border-line bg-white p-4 transition hover:border-brand/40 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: color }} aria-hidden="true">
          {initials(thread.author_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {thread.official && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Official</span>}
            {thread.pinned && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent-600">📌 Pinned</span>}
            {thread.status === 'LOCKED' && <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted">🔒 Locked</span>}
            {thread.category_name && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{thread.category_name}</span>}
          </div>
          <h3 className="mt-1 line-clamp-2 text-[15px] font-extrabold leading-snug text-ink">{thread.title}</h3>
          {thread.body && <p className="clamp-2 mt-1 text-sm text-ink-soft">{thread.body}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="font-semibold text-ink-soft">{thread.author_name}</span>
            <span>· {thread.author_persona}</span>
            <span>· {timeAgo(thread.last_activity_at)}</span>
            <span className="ml-auto font-bold text-brand-700">{thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
