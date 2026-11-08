'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';

type Cat = { id: string; slug: string; name: string; description: string; order: number; archived: boolean; thread_count: number };

export default function CategoryManager({ initial }: { initial: Cat[] }) {
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>(initial);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  async function add() {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    const r = await postBff<{ category?: Cat }>('/bff/admin/pulse/categories', { name: name.trim(), description: desc.trim() });
    setBusy(false);
    if (r.ok && r.data.category) { setCats((p) => [...p, r.data.category as Cat]); setName(''); setDesc(''); }
  }

  async function saveEdit(id: string) {
    setBusy(true);
    const r = await sendBff(`/bff/admin/pulse/categories/${id}`, 'PATCH', { name: editName.trim(), description: editDesc.trim() });
    setBusy(false);
    if (r.ok) {
      setCats((p) => p.map((c) => (c.id === id ? { ...c, name: editName.trim(), description: editDesc.trim() } : c)));
      setEditId('');
    }
  }

  async function toggleArchive(c: Cat) {
    setBusy(true);
    const r = await sendBff(`/bff/admin/pulse/categories/${c.id}`, 'PATCH', { archived: !c.archived });
    setBusy(false);
    if (r.ok) setCats((p) => p.map((x) => (x.id === c.id ? { ...x, archived: !c.archived } : x)));
  }

  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= cats.length || busy) return;
    const next = [...cats];
    [next[idx], next[j]] = [next[j], next[idx]];
    setCats(next);
    setBusy(true);
    await postBff('/bff/admin/pulse/categories/reorder', { ordered_ids: next.map((c) => c.id) });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Add */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Add a topic</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Topic name" data-testid="cat-new-name" className="rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} placeholder="Short description (optional)" className="rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
          <button onClick={add} disabled={name.trim().length < 2 || busy} data-testid="cat-add" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add topic</button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {cats.map((c, idx) => (
          <div key={c.id} className={`rounded-2xl border p-4 ${c.archived ? 'border-line bg-cream/60' : 'border-line bg-white'}`} data-testid="cat-row">
            {editId === c.id ? (
              <div className="space-y-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} className="w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink focus:border-brand focus:outline-none" />
                <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={200} className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(c.id)} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Save</button>
                  <button onClick={() => setEditId('')} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">{c.name} {c.archived && <span className="ml-1 rounded-full bg-line px-2 py-0.5 text-[10px] font-black uppercase text-muted">Archived</span>}</p>
                  <p className="text-xs text-muted">{c.description || 'No description'} · {c.thread_count} discussions</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0 || busy} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-soft disabled:opacity-30" aria-label="Move up">↑</button>
                  <button onClick={() => move(idx, 1)} disabled={idx === cats.length - 1 || busy} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-soft disabled:opacity-30" aria-label="Move down">↓</button>
                  <button onClick={() => { setEditId(c.id); setEditName(c.name); setEditDesc(c.description); }} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream">Rename</button>
                  <button onClick={() => toggleArchive(c)} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">{c.archived ? 'Restore' : 'Archive'}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Archived topics are hidden from teachers but keep their discussions. Reordering changes the display order teachers see.</p>
    </div>
  );
}
