'use client';

import { useEffect, useState } from 'react';
import { getBff, sendBff } from '@/lib/auth-client';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];
const BLOCKS: { key: string; label: string; hint: string }[] = [
  { key: 'morning', label: 'Morning', hint: '6–12' },
  { key: 'afternoon', label: 'Afternoon', hint: '12–5' },
  { key: 'evening', label: 'Evening', hint: '5–10' },
];

type Slots = Record<string, string[]>;

// Weekly day-and-slot availability scheduler. Loads/saves via the BFF, which
// forwards to the backend availability endpoints (see
// /app/BACKEND_REQUIREMENTS_availability_schedule.md). Degrades gracefully with
// a clear message until that backend ships.
export default function WeeklyAvailability() {
  const [available, setAvailable] = useState(true);
  const [slots, setSlots] = useState<Slots>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'info' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getBff('/bff/teacher/availability');
      if (alive && r.ok && r.data) {
        setAvailable(Boolean(r.data.available));
        setSlots((r.data.slots as Slots) || {});
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const isOn = (day: string, block: string) => (slots[day] || []).includes(block);
  const toggle = (day: string, block: string) => {
    setMsg(null);
    setSlots((prev) => {
      const cur = new Set(prev[day] || []);
      if (cur.has(block)) cur.delete(block);
      else cur.add(block);
      return { ...prev, [day]: Array.from(cur) };
    });
  };

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await sendBff('/bff/teacher/availability', 'PUT', { available, slots });
    setSaving(false);
    if (r.ok && r.data?.ok) setMsg({ kind: 'ok', text: 'Availability saved.' });
    else if (r.ok && r.data?.pending) setMsg({ kind: 'info', text: r.data.error });
    else setMsg({ kind: 'err', text: r.data?.error || 'Could not save. Please try again.' });
  }

  const openCount = DAYS.reduce((n, d) => n + (slots[d.key]?.length ? 1 : 0), 0);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="weekly-availability">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-ink">Weekly availability</h2>
          <p className="mt-0.5 text-sm text-muted">Tap the times you&apos;re open each day so seekers book when you&apos;re free.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={available}
          aria-label="Accepting bookings"
          onClick={() => { setAvailable((v) => !v); setMsg(null); }}
          className="relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
          style={{ backgroundColor: available ? '#0D9488' : '#CBD5E1' }}
        >
          <span className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition" style={{ transform: available ? 'translateX(22px)' : 'translateX(4px)' }} />
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading your schedule…</p>
      ) : (
        <>
          <div className={`mt-4 overflow-x-auto ${available ? '' : 'pointer-events-none opacity-50'}`}>
            <table className="w-full border-separate border-spacing-1 text-center">
              <thead>
                <tr>
                  <th className="w-14" />
                  {BLOCKS.map((b) => (
                    <th key={b.key} className="px-1 pb-1 text-xs font-bold text-ink-soft">
                      {b.label}
                      <span className="block text-[10px] font-normal text-muted">{b.hint}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d.key}>
                    <td className="pr-1 text-left text-xs font-bold text-ink">{d.label}</td>
                    {BLOCKS.map((b) => {
                      const on = isOn(d.key, b.key);
                      return (
                        <td key={b.key} className="p-0">
                          <button
                            type="button"
                            onClick={() => toggle(d.key, b.key)}
                            aria-pressed={on}
                            aria-label={`${d.label} ${b.label}`}
                            data-testid={`slot-${d.key}-${b.key}`}
                            className={`h-9 w-full rounded-lg border text-xs font-bold transition ${
                              on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-muted hover:border-brand hover:text-brand-700'
                            }`}
                          >
                            {on ? '✓' : '+'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className={`text-sm font-semibold ${msg ? (msg.kind === 'ok' ? 'text-brand-700' : msg.kind === 'err' ? 'text-red-600' : 'text-amber-700') : 'text-muted'}`} data-testid="availability-status">
              {msg ? msg.text : available ? `Open on ${openCount} day${openCount === 1 ? '' : 's'} this week` : 'Not accepting bookings'}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save availability'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
