'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { PulseCategoryLite } from '@/lib/pulse-ui';

// Compose a new discussion. Server enforces the same limits + lifecycle gate.
export default function NewThreadForm({ categories, defaultSlug }: { categories: PulseCategoryLite[]; defaultSlug?: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(defaultSlug || categories[0]?.slug || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const valid = slug && title.trim().length >= 5 && body.trim().length >= 10;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    const r = await postBff<{ thread?: { id: string }; error?: string }>('/bff/pulse/threads', {
      category_slug: slug, title: title.trim(), body: body.trim(),
    });
    if (r.ok && r.data.thread?.id) {
      router.push(`/app/pulse/t/${r.data.thread.id}`);
    } else {
      setErr(r.data?.error || 'Could not post. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <label className="block text-xs font-bold uppercase tracking-wider text-muted">Category</label>
      <select
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        data-testid="pulse-new-category"
        className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
      >
        {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </select>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={140}
        placeholder="What do you want to discuss?"
        data-testid="pulse-new-title"
        className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
      />

      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Your message</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={8000}
        rows={7}
        placeholder="Share your experience, a question, or an observation with fellow teachers…"
        data-testid="pulse-new-body"
        className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:border-brand focus:outline-none"
      />

      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{err}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          data-testid="pulse-new-submit"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Start the conversation'}
        </button>
        <span className="text-xs text-muted">Posting as yourself — teachers speaking with teachers.</span>
      </div>
    </div>
  );
}
