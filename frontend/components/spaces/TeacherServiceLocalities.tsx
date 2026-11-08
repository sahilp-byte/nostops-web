'use client';

import { useEffect, useRef, useState } from 'react';
import { sendBff } from '@/lib/auth-client';

type Loc = { id: string; name: string; district?: string; state?: string };
type Row = { key: string; pin: string; locality_id: string; localities: Loc[]; error?: string };
type Saved = { pin: string; locality_id: string; locality: string; district: string; state: string };

let seq = 0;
const empty = (): Row => ({ key: `r${++seq}`, pin: '', locality_id: '', localities: [] });

// Teacher service PIN codes: primary + up to 4 more. Each PIN is looked up against India Post data and the teacher
// picks the locality. Nothing is saved until the teacher ticks the confirmation. PINs stay private.
export default function TeacherServiceLocalities() {
  const [rows, setRows] = useState<Row[]>([empty()]);
  const [saved, setSaved] = useState<{ primary: Saved; additional: Saved[]; updated_at: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef<Record<string, string>>({});

  useEffect(() => {
    fetch('/bff/spaces/teacher-localities').then((r) => r.json()).then((d) => {
      const rec = d?.record;
      if (!rec) return;
      setSaved(rec);
      setRows([rec.primary, ...(rec.additional || [])].map((s: Saved) => ({ ...empty(), pin: s.pin, locality_id: s.locality_id, localities: [{ id: s.locality_id, name: s.locality, district: s.district, state: s.state }] })));
    }).catch(() => {});
  }, []);

  // Rows are addressed by a stable key, so removing a row never shifts a pending lookup onto another row.
  const update = (key: string, patch: Partial<Row>) => { setConfirm(false); setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r))); };

  async function lookup(key: string, pin: string) {
    update(key, { pin, locality_id: '', localities: [], error: undefined });
    latest.current[key] = pin;
    if (!/^[1-9][0-9]{5}$/.test(pin)) return;
    const r = await fetch(`/bff/spaces/pin/${pin}`).then((x) => x.json().then((d) => ({ ok: x.ok, d }))).catch(() => ({ ok: false, d: {} }));
    if (latest.current[key] !== pin) return; // a newer edit or the row was removed
    if (!r.ok || !r.d?.localities?.length) return update(key, { pin, error: r.d?.message || 'We couldn’t find this PIN code. Please check it.' });
    update(key, { pin, localities: r.d.localities, locality_id: r.d.localities.length === 1 ? r.d.localities[0].id : '' });
  }

  async function save() {
    setMsg(null);
    if (rows.some((r) => !r.locality_id)) return setMsg({ ok: false, text: 'Choose a locality for every PIN code, or remove the empty row.' });
    if (!confirm) return setMsg({ ok: false, text: 'Please confirm these are the areas where you teach.' });
    setBusy(true);
    const [p, ...more] = rows.map((r) => ({ pin: r.pin, locality_id: r.locality_id }));
    const r = await sendBff('/bff/spaces/teacher-localities', 'PUT', { primary: p, additional: more, source: 'manual', confirm: true });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not save your teaching localities.' });
    setSaved(r.data.record);
    setMsg({ ok: true, text: 'Saved. Community Partners in these localities can now find you.' });
  }

  return (
    <section className="sp-card p-6" data-testid="tsl-form">
      <h2 className="text-[24px]">Where do you teach?</h2>
      <p className="mt-1 text-[15px] text-ink-soft">Add the PIN code where you mainly teach, and up to four more areas you serve. Your PIN codes stay private. Only the locality name is shown to Community Partners. We never ask for or show your home address.</p>
      <div className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="grid gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-[180px_1fr_110px] sm:items-end" data-testid={`tsl-row-${i}`}>
            <label className="text-[14px] font-semibold">{i === 0 ? 'Main teaching PIN code *' : `Additional PIN code ${i}`}
              <input value={r.pin} inputMode="numeric" maxLength={6} onChange={(e) => lookup(r.key, e.target.value.replace(/\D/g, ''))} className="mt-1 min-h-[44px] w-full border px-3" data-testid={`tsl-pin-${i}`} />
            </label>
            <label className="text-[14px] font-semibold">Locality
              <select value={r.locality_id} onChange={(e) => update(r.key, { locality_id: e.target.value })} disabled={!r.localities.length} className="mt-1 min-h-[44px] w-full border px-3" data-testid={`tsl-locality-${i}`}>
                <option value="">{r.localities.length ? 'Choose your locality' : 'Enter a PIN code first'}</option>
                {r.localities.map((l) => <option key={l.id} value={l.id}>{l.name}{l.district ? `, ${l.district}` : ''}{l.state ? `, ${l.state}` : ''}</option>)}
              </select>
            </label>
            {i > 0 ? <button type="button" onClick={() => { setConfirm(false); delete latest.current[r.key]; setRows((rs) => rs.filter((x) => x.key !== r.key)); }} className="sp-btn-secondary !min-h-[44px] !px-4 !text-[14px]" data-testid={`tsl-remove-${i}`}>Remove</button> : <span />}
            {r.error && <p className="text-sm font-semibold text-red-700 sm:col-span-3" role="alert">{r.error}</p>}
          </div>
        ))}
      </div>
      {rows.length < 5 && <button type="button" onClick={() => setRows((rs) => [...rs, empty()])} className="mt-3 text-[15px] font-semibold text-brand-700 underline" data-testid="tsl-add">+ Add another PIN code</button>}
      <label className="mt-4 flex items-start gap-2 text-[15px]"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" data-testid="tsl-confirm" />I confirm these are the areas where I teach yoga.</label>
      <button type="button" onClick={save} disabled={busy} className="sp-btn-primary mt-4 bg-brand" data-testid="tsl-save">{busy ? 'Saving…' : 'Save teaching localities'}</button>
      {msg && <p className={`mt-3 text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status" data-testid="tsl-msg">{msg.text}</p>}
      {saved && <p className="mt-2 text-xs text-muted" data-testid="tsl-saved">Confirmed {saved.updated_at?.slice(0, 10)} · {[saved.primary, ...saved.additional].map((s) => s.locality).join(', ')}</p>}
    </section>
  );
}
