'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import type { EditorialPick, EditorialSlot, TeacherLite } from '@/lib/server/guru';

const SLOT_META: Record<EditorialSlot, { label: string; sub: string; icon: string; color: string }> = {
  teacher_of_month: { label: 'Teacher of the Month', sub: 'A teacher who embodies the tradition this month', icon: '⭐', color: '#F59E0B' },
  featured_teacher_week: { label: 'Featured Teacher of the Week', sub: 'A rising teacher worth watching', icon: '🌟', color: '#0EA5E9' },
};

function fmt(iso: string | null) {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SlotCard({ slot, pick, onPick, onRetire, retiring }: { slot: EditorialSlot; pick: EditorialPick | null; onPick: () => void; onRetire: () => void; retiring: boolean }) {
  const m = SLOT_META[slot];
  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: `${m.color}40`, backgroundColor: `${m.color}0A` }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{m.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-extrabold text-ink">{m.label}</p>
          <p className="text-[11px] text-muted">{m.sub}</p>
        </div>
      </div>
      {pick ? (
        <div className="mt-3 flex items-start gap-3 rounded-xl bg-white p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: m.color }}>{pick.teacherName.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-ink">{pick.teacherName}</p>
            {pick.teacherCity && <p className="truncate text-xs text-muted">{pick.teacherCity}</p>}
            {pick.citation && <p className="mt-1 text-xs italic text-ink-soft">“{pick.citation}”</p>}
            <p className="mt-1 text-[11px] font-semibold text-muted">— {pick.pickedBy}{pick.period ? ` · ${pick.period}` : ''}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-white px-3 py-4 text-center text-sm text-muted">No pick yet for this slot.</p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onPick} className="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: m.color }}>
          {pick ? '↺ Replace pick' : '+ Pick a teacher'}
        </button>
        {pick && (
          <button type="button" onClick={onRetire} disabled={retiring} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ borderColor: '#EF444440', color: '#EF4444' }}>
            {retiring ? '…' : 'Retire'}
          </button>
        )}
      </div>
    </section>
  );
}

function PickerModal({ slot, onClose, onDone }: { slot: EditorialSlot; onClose: () => void; onDone: (msg: string, ok: boolean) => void }) {
  const m = SLOT_META[slot];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeacherLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TeacherLite | null>(null);
  const [citation, setCitation] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/bff/guru/teachers/search?q=${encodeURIComponent(q)}`, { credentials: 'same-origin' });
      const d = await res.json().catch(() => ({ teachers: [] }));
      setResults(Array.isArray(d.teachers) ? d.teachers : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(query), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, search]);

  async function confirm() {
    if (!selected) return;
    if (citation.trim().length < 10) { setErr('Write at least 10 characters explaining your pick.'); return; }
    setSaving(true);
    setErr(null);
    const r = await postBff('/bff/guru/editorial/pick', { type: slot, teacher_id: selected.id, citation: citation.trim() });
    setSaving(false);
    if (r.ok) onDone(`${selected.name} set as ${m.label} ✓`, true);
    else setErr(r.data?.error || 'Could not save pick.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-base font-black text-ink">Pick {m.label}</p>
            <p className="text-xs text-muted">{m.sub}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-lg text-muted">✕</button>
        </div>

        {!selected ? (
          <>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teachers by name or city…" className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink" />
            <div className="mt-3 space-y-1.5">
              {searching ? (
                <p className="py-6 text-center text-sm text-muted">Searching…</p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No teachers found. Try a different search.</p>
              ) : (
                results.map((t) => (
                  <button key={t.id || t.handle || t.name} type="button" onClick={() => setSelected(t)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-white p-2.5 text-left transition hover:bg-brand-50/50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-black text-brand-700">{t.name.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{t.name}</p>
                      {t.city && <p className="truncate text-xs text-muted">{t.city}</p>}
                    </div>
                    <span className="text-muted">›</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-cream/50 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: m.color }}>{selected.name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-ink">{selected.name}</p>
                {selected.city && <p className="truncate text-xs text-muted">{selected.city}</p>}
              </div>
              <button type="button" onClick={() => setSelected(null)} className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink-soft">Change</button>
            </div>
            <label className="mt-3 block text-xs font-bold text-muted">Council citation · why this teacher?</label>
            <textarea value={citation} onChange={(e) => setCitation(e.target.value)} rows={3} placeholder="A few words on what makes this teacher worthy…" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
            {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
            <button type="button" onClick={confirm} disabled={saving} className="mt-3 w-full rounded-lg px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: m.color }}>
              {saving ? 'Saving…' : `Confirm ${m.label}`}
            </button>
          </div>
        )}
        {err && !selected && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
      </div>
    </div>
  );
}

export default function EditorialPicks({ teacherOfMonth, featuredWeek, history }: { teacherOfMonth: EditorialPick | null; featuredWeek: EditorialPick | null; history: EditorialPick[] }) {
  const router = useRouter();
  const [picker, setPicker] = useState<EditorialSlot | null>(null);
  const [retiring, setRetiring] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function done(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setPicker(null);
    router.refresh();
    setTimeout(() => setToast(null), 4000);
  }

  async function retire(pick: EditorialPick) {
    setRetiring(pick.id);
    const r = await sendBff(`/bff/guru/editorial/${pick.id}`, 'DELETE');
    setRetiring(null);
    done(r.ok ? 'Pick retired' : r.data?.error || 'Could not retire pick.', r.ok);
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="sticky top-2 z-10 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: toast.ok ? '#0D948840' : '#EF444440', backgroundColor: toast.ok ? '#0D948812' : '#EF444412', color: toast.ok ? '#0F766E' : '#B91C1C' }}>
          {toast.msg}
        </div>
      )}

      <SlotCard slot="teacher_of_month" pick={teacherOfMonth} onPick={() => setPicker('teacher_of_month')} onRetire={() => teacherOfMonth && retire(teacherOfMonth)} retiring={retiring === teacherOfMonth?.id} />
      <SlotCard slot="featured_teacher_week" pick={featuredWeek} onPick={() => setPicker('featured_teacher_week')} onRetire={() => featuredWeek && retire(featuredWeek)} retiring={retiring === featuredWeek?.id} />

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 mt-6 text-sm font-extrabold text-ink">Past picks</h2>
          <div className="space-y-2">
            {history.slice(0, 12).map((p) => {
              const m = SLOT_META[p.type];
              return (
                <div key={p.id || `${p.teacherName}-${p.createdAt}`} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
                  <span>{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{p.teacherName}</p>
                    <p className="truncate text-xs text-muted">{m.label}{p.period ? ` · ${p.period}` : ''}{p.createdAt ? ` · ${fmt(p.createdAt)}` : ''}</p>
                  </div>
                  {p.active && <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: m.color }}>ACTIVE</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {picker && <PickerModal slot={picker} onClose={() => setPicker(null)} onDone={done} />}
    </div>
  );
}
