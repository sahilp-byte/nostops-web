'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

type Prog = { programme_id: string; name: string; taxonomy: string };
type Init = { id?: string; space_id?: string; space_enquiry_id?: string; programme_id?: string; title?: string; subtitle?: string | null;
  event_date?: string | null; start_time?: string | null; end_time?: string | null; duration_minutes?: number; capacity?: number;
  language?: string; visibility?: string };

// Phase 5B — Space programme draft form. No price, fee or payment fields exist here (or on the server).
export default function SpaceProgrammeForm({ init, programmes, maxCapacity }: { init: Init; programmes: Prog[]; maxCapacity?: number }) {
  const router = useRouter();
  const [f, setF] = useState({
    programme_id: init.programme_id || programmes[0]?.programme_id || '', title: init.title || '', subtitle: init.subtitle || '',
    event_date: init.event_date || '', start_time: init.start_time || '', end_time: init.end_time || '',
    duration_minutes: String(init.duration_minutes || 60), capacity: String(init.capacity || ''), language: init.language || 'English',
    visibility: init.visibility || 'PRIVATE',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true); setErr(null);
    const body: Record<string, unknown> = { ...f, duration_minutes: Number(f.duration_minutes) || 60, capacity: Number(f.capacity) || 0 };
    for (const k of ['subtitle', 'start_time', 'end_time', 'event_date']) if (!body[k]) delete body[k];
    if (!init.id) Object.assign(body, { space_id: init.space_id, space_enquiry_id: init.space_enquiry_id });
    const r = await sendBff(init.id ? `/bff/spaces/programmes/${init.id}` : '/bff/spaces/programmes', init.id ? 'PATCH' : 'POST', body);  // CSRF header required by badOrigin
    const d = r.data || {};
    setBusy(false);
    if (!r.ok) return setErr(d.error || 'Could not save.');
    router.push(`/app/spaces/programmes/${d.programme.event_id}`);
    router.refresh();
  }

  const inp = 'mt-1 w-full min-h-[44px] rounded-xl border border-line bg-white px-3 text-sm text-ink';
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5" data-testid="sp-form">
      <label className="block text-sm font-bold text-ink">Council programme
        <select className={inp} value={f.programme_id} onChange={set('programme_id')} data-testid="sp-programme">
          {programmes.map((p) => <option key={p.programme_id} value={p.programme_id}>{p.name} · {p.taxonomy.replace('_', ' ')}</option>)}
        </select>
      </label>
      <label className="block text-sm font-bold text-ink">Title<input className={inp} value={f.title} onChange={set('title')} data-testid="sp-title" /></label>
      <label className="block text-sm font-bold text-ink">Short description (optional)<input className={inp} value={f.subtitle} onChange={set('subtitle')} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-bold text-ink">Date<input type="date" className={inp} value={f.event_date} onChange={set('event_date')} data-testid="sp-date" /></label>
        <label className="block text-sm font-bold text-ink">Start<input type="time" className={inp} value={f.start_time} onChange={set('start_time')} /></label>
        <label className="block text-sm font-bold text-ink">End<input type="time" className={inp} value={f.end_time} onChange={set('end_time')} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-bold text-ink">Duration (min)<input type="number" className={inp} value={f.duration_minutes} onChange={set('duration_minutes')} /></label>
        <label className="block text-sm font-bold text-ink">Capacity{maxCapacity ? ` (max ${maxCapacity})` : ''}<input type="number" className={inp} value={f.capacity} onChange={set('capacity')} data-testid="sp-capacity" /></label>
        <label className="block text-sm font-bold text-ink">Language<input className={inp} value={f.language} onChange={set('language')} /></label>
      </div>
      <label className="block text-sm font-bold text-ink">Visibility
        <select className={inp} value={f.visibility} onChange={set('visibility')} data-testid="sp-visibility">
          <option value="PRIVATE">Private: not public</option><option value="UNLISTED">Unlisted: direct link only</option><option value="PUBLIC">Public: discoverable</option>
        </select>
      </label>
      <p className="text-xs text-muted">Space programmes carry no NOSTOPS fees or payments. Participant registration opens in a later phase.</p>
      {err && <p className="text-sm font-semibold text-red-700" role="alert" data-testid="sp-error">{err}</p>}
      <button type="button" onClick={save} disabled={busy} className="min-h-[48px] rounded-xl bg-accent px-6 text-sm font-black text-white disabled:opacity-60" data-testid="sp-save">
        {busy ? 'Saving…' : init.id ? 'Save changes' : 'Create draft'}
      </button>
    </div>
  );
}
