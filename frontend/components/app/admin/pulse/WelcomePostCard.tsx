'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

const DEFAULT_TITLE = 'Welcome to Teacher Pulse — start here 🙏';
const DEFAULT_BODY = `Namaste, and welcome to Teacher Pulse — a conversation among yoga teachers about the profession, the market and the future of Yoga.

A few gentle notes to get started:
• Speak as yourself — this is a space of teachers speaking with teachers.
• Pick a topic and start a discussion, or reply to a colleague.
• Be respectful. Disagree with ideas, never with people.
• Invite a fellow teacher you trust — the richer the room, the richer the learning.

We're here to listen. Tell us what's on your mind: the challenges, the opportunities, and what you'd like NOSTOPS to build for you.`;

type Cat = { slug: string; name: string };
type Existing = { id: string; title: string } | null;

export default function WelcomePostCard({ existing, categories }: { existing: Existing; categories: Cat[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [slug, setSlug] = useState(categories[0]?.slug || '');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Existing>(existing);

  if (live) {
    return (
      <section className="rounded-2xl border border-brand/25 bg-brand-50/50 p-5" data-testid="welcome-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-ink">Welcome post is live 🎉</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Your pinned “start here” post greets every teacher: “{live.title}”.</p>
          </div>
          <Link href={`/app/admin/pulse/threads/${live.id}`} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">View / edit</Link>
        </div>
      </section>
    );
  }

  async function publish() {
    if (busy) return;
    setBusy(true);
    const r = await postBff<{ thread?: { id: string; title: string } }>('/bff/admin/pulse/welcome', { title: title.trim(), body: body.trim(), category_slug: slug });
    setBusy(false);
    if (r.ok && r.data.thread) { setLive({ id: r.data.thread.id, title: r.data.thread.title }); router.refresh(); }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="welcome-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-ink">Publish a “start here” welcome post</h2>
          <p className="mt-0.5 text-sm text-ink-soft">A friendly pinned post so the first teachers know how to join in.</p>
        </div>
        {!open && <button onClick={() => setOpen(true)} data-testid="welcome-open" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Write welcome post</button>}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} maxLength={8000} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm leading-relaxed text-ink focus:border-brand focus:outline-none" />
          <div className="flex flex-wrap items-center gap-3">
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft">
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <button onClick={publish} disabled={busy || title.trim().length < 5} data-testid="welcome-publish" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy ? 'Publishing…' : 'Publish & pin'}</button>
            <button onClick={() => setOpen(false)} className="text-sm font-semibold text-muted">Cancel</button>
          </div>
          <p className="text-xs text-muted">Posted as an official NOSTOPS message and pinned to the top. This is an announcement, not manufactured discussion.</p>
        </div>
      )}
    </section>
  );
}
