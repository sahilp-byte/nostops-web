'use client';

import { useState } from 'react';
import { ITINERARY_CATEGORIES, type ItineraryItem } from '@/lib/retreat-content';

const cell = 'rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

// PROMPT 10 — structured itinerary builder used inside the Host Retreat wizard.
// Emits ItineraryItem[]; the wizard serializes it into the retreat description.
export default function ItineraryBuilder({ value, onChange }: { value: ItineraryItem[]; onChange: (items: ItineraryItem[]) => void }) {
  const update = (i: number, patch: Partial<ItineraryItem>) => onChange(value.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => {
    const lastDay = value.length ? value[value.length - 1].day ?? 1 : 1;
    onChange([...value, { day: lastDay, time: '', durationMin: undefined, category: 'yoga', activity: '', leader: '' }]);
  };

  const [copyFrom, setCopyFrom] = useState<number | ''>('');
  const days = Array.from(new Set(value.map((it) => it.day).filter((d): d is number => typeof d === 'number' && d >= 1))).sort((a, b) => a - b);
  const duplicateDay = (src: number) => {
    const target = src + 1;
    const clones = value.filter((it) => it.day === src && (it.activity || '').trim()).map((it) => ({ ...it, day: target }));
    if (!clones.length) return;
    const next = [...value, ...clones].sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || (a.time || '').localeCompare(b.time || ''));
    onChange(next);
    setCopyFrom(target);
  };

  return (
    <div data-testid="itinerary-builder">
      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-cream/40 px-4 py-6 text-center text-sm text-muted">
          Build your retreat’s daily flow — sunrise pranayama, meals, satsang, excursions, rest. It appears as a beautiful timeline on your public page.
        </p>
      ) : (
        <ul className="space-y-2.5 p-0">
          {value.map((it, i) => (
            <li key={i} className="rounded-xl border border-line bg-cream/40 p-3" data-testid="itinerary-row">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-muted">Day</label>
                  <input type="number" min={1} max={60} value={it.day ?? ''} onChange={(e) => update(i, { day: parseInt(e.target.value, 10) || undefined })} className={`${cell} mt-1 w-full`} placeholder="1" data-testid="itin-day" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-muted">Time</label>
                  <input type="time" value={it.time || ''} onChange={(e) => update(i, { time: e.target.value })} className={`${cell} mt-1 w-full`} data-testid="itin-time" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-muted">Mins</label>
                  <input type="number" min={0} max={600} step={5} value={it.durationMin ?? ''} onChange={(e) => update(i, { durationMin: parseInt(e.target.value, 10) || undefined })} className={`${cell} mt-1 w-full`} placeholder="60" data-testid="itin-dur" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-muted">Type</label>
                  <select value={it.category || ''} onChange={(e) => update(i, { category: (e.target.value || undefined) as ItineraryItem['category'] })} className={`${cell} mt-1 w-full`} data-testid="itin-category">
                    <option value="">—</option>
                    {ITINERARY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-3 flex items-end">
                  <button type="button" onClick={() => remove(i)} className="w-full rounded-lg border border-line bg-white px-2 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50" data-testid="itin-remove">Remove</button>
                </div>
                <div className="col-span-2 sm:col-span-8">
                  <label className="block text-[10px] font-black uppercase text-muted">Activity</label>
                  <input value={it.activity} onChange={(e) => update(i, { activity: e.target.value })} maxLength={100} className={`${cell} mt-1 w-full`} placeholder="Sunrise pranayama & silence" data-testid="itin-activity" />
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase text-muted">Led by <span className="font-normal normal-case">· optional</span></label>
                  <input value={it.leader || ''} onChange={(e) => update(i, { leader: e.target.value })} maxLength={60} className={`${cell} mt-1 w-full`} placeholder="Anjali" data-testid="itin-leader" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={add} className="mt-3 rounded-xl border border-brand/30 bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50" data-testid="itin-add">+ Add a session</button>

      {days.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-cream/40 p-3" data-testid="itin-copy-day">
          <span className="text-xs font-bold text-ink-soft">Copy a day&apos;s plan:</span>
          <select
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value ? parseInt(e.target.value, 10) : '')}
            className={cell}
            data-testid="itin-copy-source"
          >
            <option value="">Choose a day…</option>
            {days.map((d) => <option key={d} value={d}>Day {d} · {value.filter((it) => it.day === d && (it.activity || '').trim()).length} session(s)</option>)}
          </select>
          <button
            type="button"
            disabled={copyFrom === ''}
            onClick={() => { if (copyFrom !== '') duplicateDay(copyFrom); }}
            className="rounded-lg border border-brand/30 bg-white px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
            data-testid="itin-copy-btn"
          >
            {copyFrom !== '' ? `Duplicate to Day ${copyFrom + 1} →` : 'Duplicate to next day →'}
          </button>
        </div>
      )}
    </div>
  );
}
