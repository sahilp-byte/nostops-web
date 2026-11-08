'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { AdminNote } from '@/lib/venue-review-shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmt(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// PROMPT 29 — internal-only admin notes (never public). Wired to the intended
// backend; honest empty/disabled states until it ships.
export default function VenueAdminNotes({ id, notes, backendReady }: { id: string; notes: AdminNote[]; backendReady: boolean }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/notes`, { text: text.trim() });
    setBusy(false);
    if (res.ok) {
      setText('');
      setMsg({ kind: 'ok', text: 'Note saved.' });
      router.refresh();
    } else {
      setMsg({ kind: 'err', text: (res.data && (res.data.error as string)) || 'Could not save note.' });
    }
  }

  return (
    <section className="mt-8" data-testid="admin-notes">
      <h2 className="text-xl font-black tracking-tight text-ink">Admin notes</h2>
      <p className="mt-1 text-sm text-muted">Internal only — never shown publicly.</p>

      {notes.length > 0 ? (
        <ul className="mt-4 list-none space-y-3 p-0">
          {notes.map((n, i) => (
            <li key={n.id || i} className="rounded-xl border border-line bg-white p-4">
              <p className="whitespace-pre-line text-sm text-ink-soft">{n.text}</p>
              <p className="mt-2 text-[11px] font-semibold text-muted">{[n.author, fmt(n.created_at)].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted">No notes yet.</p>
      )}

      <div className="mt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          disabled={!backendReady || busy}
          placeholder={backendReady ? 'Add an internal note (e.g. “Contacted owner, waiting for photos”)…' : 'Notes activate once the backend ships.'}
          data-testid="admin-note-input"
          className="w-full rounded-xl border border-line bg-white p-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={!backendReady || busy || !text.trim()}
            onClick={add}
            data-testid="admin-note-add"
            className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add note
          </button>
          {msg && <span className={`text-sm font-semibold ${msg.kind === 'ok' ? 'text-brand-700' : 'text-red-700'}`}>{msg.text}</span>}
        </div>
      </div>
    </section>
  );
}
