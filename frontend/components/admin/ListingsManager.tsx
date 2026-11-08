'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';

export type ListingTeacher = { handle: string; name: string; city: string; avatar: string | null; listed: boolean };
export type ListingVenue = { id: string; name: string; city: string; path: string };
type Removal = { kind: 'teacher' | 'venue'; ref: string; name: string; removed: boolean; reason: string; removed_at: string | null; removed_by: string };
export type ListingsState = { featured: string[]; homeHidden: string[]; maxFeatured: number; removals: Removal[] };

const BTN = 'min-h-[44px] min-w-[44px] rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50';
const PRIMARY = 'min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50';
const DANGER = 'min-h-[44px] rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50';
const INPUT = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink';
const key = (h: string) => h.toLowerCase();
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '');
const match = (q: string, ...fields: string[]) => {
  const s = q.trim().toLowerCase();
  return !s || fields.some((f) => f.toLowerCase().includes(s));
};

function TeacherPicker({ label, testId, options, onPick, disabled }: {
  label: string; testId: string; options: ListingTeacher[]; onPick: (t: ListingTeacher) => void; disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const hits = q.trim() ? options.filter((t) => match(q, t.name, t.city, t.handle)).slice(0, 8) : [];
  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={label} aria-label={label} className={INPUT} disabled={disabled} data-testid={testId} />
      {hits.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {hits.map((t) => (
            <li key={t.handle}>
              <button type="button" className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-cream" onClick={() => { onPick(t); setQ(''); }} data-testid={`${testId}-option`}>
                <span className="font-bold text-ink">{t.name}</span>
                <span className="text-[12px] text-muted">{t.city || t.handle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Admin › Homepage & Listings: homepage featured teachers (ordered, up to 6, rest filled
// automatically), "never on the homepage" list, and Delete / Restore for teachers and venues.
export default function ListingsManager({ teachers, venues, initial }: { teachers: ListingTeacher[]; venues: ListingVenue[]; initial: ListingsState }) {
  const router = useRouter();
  const [featured, setFeatured] = useState<string[]>(initial.featured);
  const [hidden, setHidden] = useState<string[]>(initial.homeHidden);
  const [saved, setSaved] = useState({ featured: initial.featured, hidden: initial.homeHidden });
  const [removals, setRemovals] = useState<Record<string, Removal>>(() => Object.fromEntries(initial.removals.map((r) => [`${r.kind}:${r.ref}`, r])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [tq, setTq] = useState('');
  const [vq, setVq] = useState('');
  const [tDeleted, setTDeleted] = useState(false);
  const [vDeleted, setVDeleted] = useState(false);

  const byHandle = useMemo(() => new Map(teachers.map((t) => [key(t.handle), t])), [teachers]);
  const isRemoved = (kind: 'teacher' | 'venue', ref: string) => !!removals[`${kind}:${kind === 'teacher' ? key(ref) : ref}`]?.removed;
  const eligible = teachers.filter((t) => t.listed && !isRemoved('teacher', t.handle));
  const dirty = featured.join() !== saved.featured.join() || hidden.join() !== saved.hidden.join();

  function move(i: number, d: number) {
    const next = [...featured];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setFeatured(next);
  }

  async function saveHomepage() {
    setBusy('home');
    setMsg(null);
    const r = await sendBff<{ featured?: string[]; home_hidden?: string[]; error?: string }>('/bff/admin/listings/featured', 'PUT', { featured, home_hidden: hidden });
    setBusy('');
    if (r.ok) {
      const f = r.data.featured || featured;
      const h = r.data.home_hidden || hidden;
      setFeatured(f);
      setHidden(h);
      setSaved({ featured: f, hidden: h });
      setMsg({ ok: true, text: 'Homepage teachers saved. The homepage shows them now.' });
    } else setMsg({ ok: false, text: r.data?.error || 'Could not save the homepage teachers.' });
  }

  async function change(kind: 'teacher' | 'venue', ref: string, name: string, action: 'remove' | 'restore') {
    if (action === 'remove') {
      const what = kind === 'teacher' ? 'teacher' : 'venue';
      const ok = window.confirm(
        `Delete “${name}” from the website?\n\nThe ${what} will disappear from every public page (directory, profile, city pages, search, sitemap and homepage). ` +
          (kind === 'teacher' ? 'Their account is kept and they can still sign in. ' : 'The venue record is kept. ') +
          'You can restore it here at any time.',
      );
      if (!ok) return;
    }
    const id = `${kind}:${kind === 'teacher' ? key(ref) : ref}`;
    setBusy(id);
    setMsg(null);
    const r = await postBff<{ removal?: Removal; error?: string }>('/bff/admin/listings/removals', { kind, ref, name, action });
    setBusy('');
    if (r.ok && r.data.removal) {
      setRemovals((m) => ({ ...m, [id]: r.data.removal as Removal }));
      if (kind === 'teacher' && action === 'remove') {
        // The server also takes a deleted teacher off the featured list.
        setFeatured((f) => f.filter((h) => key(h) !== key(ref)));
        setSaved((s) => ({ ...s, featured: s.featured.filter((h) => key(h) !== key(ref)) }));
      }
      setMsg({ ok: true, text: action === 'remove' ? `“${name}” was deleted from the website.` : `“${name}” is back on the website.` });
      router.refresh();
    } else setMsg({ ok: false, text: r.data?.error || 'Could not save the change.' });
  }

  const teacherRows = teachers
    .filter((t) => (tDeleted ? isRemoved('teacher', t.handle) : true) && match(tq, t.name, t.city, t.handle))
    .slice(0, tDeleted || tq.trim() ? 200 : 30);
  const venueRows = venues
    .filter((v) => (vDeleted ? isRemoved('venue', v.id) : true) && match(vq, v.name, v.city, v.id))
    .slice(0, vDeleted || vq.trim() ? 200 : 30);
  const removedTeachers = Object.values(removals).filter((r) => r.kind === 'teacher' && r.removed).length;
  const removedVenues = Object.values(removals).filter((r) => r.kind === 'venue' && r.removed).length;

  return (
    <div className="mt-6 space-y-6" data-testid="listings-manager">
      {msg && (
        <p role="status" className={`sticky top-2 z-30 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`} data-testid="listings-message">
          {msg.text}
        </p>
      )}

      {/* HOMEPAGE FEATURED TEACHERS */}
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="featured-section">
        <h2 className="text-base font-black text-ink">Homepage — Meet Our Teachers</h2>
        <p className="mt-1 text-[13px] text-muted">
          Pick up to {initial.maxFeatured} teachers, in the order they should appear. Any empty spots are filled automatically with other public teachers.
        </p>
        <ol className="mt-3 space-y-2" data-testid="featured-list">
          {featured.length === 0 && <li className="text-sm text-muted">No teachers picked — the homepage fills all spots automatically.</li>}
          {featured.map((h, i) => {
            const t = byHandle.get(key(h));
            return (
              <li key={h} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2" data-testid="featured-item">
                <span className="w-6 text-center text-sm font-black text-brand-700">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-ink">{t?.name || h}</span>
                  <span className="ml-2 text-[12px] text-muted">{t?.city || ''}</span>
                  {(!t || !t.listed || isRemoved('teacher', h)) && <span className="ml-2 text-[12px] font-bold text-amber-700">not public — skipped on the homepage</span>}
                </span>
                <button type="button" className={BTN} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${t?.name || h} up`} data-testid="featured-up">↑</button>
                <button type="button" className={BTN} disabled={i === featured.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${t?.name || h} down`} data-testid="featured-down">↓</button>
                <button type="button" className={BTN} onClick={() => setFeatured(featured.filter((x) => x !== h))} data-testid="featured-remove">Remove</button>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 max-w-md">
          <TeacherPicker
            label={featured.length >= initial.maxFeatured ? `All ${initial.maxFeatured} spots are taken` : 'Add a teacher — type a name or city'}
            testId="featured-add"
            disabled={featured.length >= initial.maxFeatured}
            options={eligible.filter((t) => !featured.some((h) => key(h) === key(t.handle)))}
            onPick={(t) => {
              setFeatured([...featured, t.handle]);
              setHidden(hidden.filter((h) => key(h) !== key(t.handle)));
            }}
          />
        </div>

        <h3 className="mt-6 text-sm font-black text-ink">Never show on the homepage</h3>
        <p className="mt-0.5 text-[13px] text-muted">These teachers stay public everywhere else but are never picked for the homepage strip.</p>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="hidden-list">
          {hidden.length === 0 && <span className="text-sm text-muted">Nobody.</span>}
          {hidden.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-sm font-semibold text-ink-soft" data-testid="hidden-item">
              {byHandle.get(key(h))?.name || h}
              <button type="button" className="ml-1 grid h-7 w-7 place-items-center rounded-full hover:bg-white" onClick={() => setHidden(hidden.filter((x) => x !== h))} aria-label={`Allow ${byHandle.get(key(h))?.name || h} on the homepage`} data-testid="hidden-remove">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 max-w-md">
          <TeacherPicker
            label="Add a teacher to this list"
            testId="hidden-add"
            options={eligible.filter((t) => !hidden.some((h) => key(h) === key(t.handle)))}
            onPick={(t) => {
              setHidden([...hidden, t.handle]);
              setFeatured(featured.filter((h) => key(h) !== key(t.handle)));
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={PRIMARY} disabled={!dirty || busy === 'home'} onClick={saveHomepage} data-testid="featured-save">
            {busy === 'home' ? 'Saving…' : 'Save homepage teachers'}
          </button>
          {dirty && <span className="text-[13px] font-semibold text-amber-700">Unsaved changes</span>}
        </div>
      </section>

      {/* DELETE TEACHERS */}
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="teachers-section">
        <h2 className="text-base font-black text-ink">Yoga teachers ({teachers.length}) · {removedTeachers} deleted</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input value={tq} onChange={(e) => setTq(e.target.value)} placeholder="Search teachers by name, city or handle" aria-label="Search teachers" className={`${INPUT} max-w-md`} data-testid="teachers-search" />
          <label className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink-soft">
            <input type="checkbox" checked={tDeleted} onChange={(e) => setTDeleted(e.target.checked)} data-testid="teachers-deleted-only" /> Deleted only
          </label>
        </div>
        <ul className="mt-3 divide-y divide-line" data-testid="teachers-list">
          {teacherRows.length === 0 && <li className="py-3 text-sm text-muted">No teachers match.</li>}
          {teacherRows.map((t) => {
            const gone = isRemoved('teacher', t.handle);
            const id = `teacher:${key(t.handle)}`;
            return (
              <li key={t.handle} className="flex flex-wrap items-center gap-3 py-2.5" data-testid={`teacher-row-${t.handle}`}>
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-black text-brand-700">{t.name.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-ink">{t.name}</span>
                  <span className="ml-2 text-[12px] text-muted">{[t.city, t.handle].filter(Boolean).join(' · ')}</span>
                  {gone && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-black uppercase text-red-700">Deleted</span>}
                  {gone && removals[id]?.removed_at && <span className="ml-2 text-[12px] text-muted">{fmt(removals[id].removed_at)}{removals[id].removed_by ? ` · ${removals[id].removed_by}` : ''}</span>}
                  {!gone && !t.listed && <span className="ml-2 text-[12px] font-semibold text-muted">not public</span>}
                </span>
                {!gone && t.listed && <a href={`/teachers/${t.handle}`} target="_blank" rel="noreferrer" className={BTN}>View</a>}
                {gone ? (
                  <button type="button" className={BTN} disabled={busy === id} onClick={() => change('teacher', t.handle, t.name, 'restore')} data-testid={`teacher-restore-${t.handle}`}>Restore</button>
                ) : (
                  <button type="button" className={DANGER} disabled={busy === id} onClick={() => change('teacher', t.handle, t.name, 'remove')} data-testid={`teacher-delete-${t.handle}`}>Delete</button>
                )}
              </li>
            );
          })}
        </ul>
        {!tDeleted && !tq.trim() && teachers.length > 30 && <p className="mt-2 text-[13px] text-muted">Showing the first 30 — search to find others.</p>}
      </section>

      {/* DELETE VENUES */}
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="venues-section">
        <h2 className="text-base font-black text-ink">Venues ({venues.length}) · {removedVenues} deleted</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input value={vq} onChange={(e) => setVq(e.target.value)} placeholder="Search venues by name or city" aria-label="Search venues" className={`${INPUT} max-w-md`} data-testid="venues-search" />
          <label className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink-soft">
            <input type="checkbox" checked={vDeleted} onChange={(e) => setVDeleted(e.target.checked)} data-testid="venues-deleted-only" /> Deleted only
          </label>
        </div>
        <ul className="mt-3 divide-y divide-line" data-testid="venues-list">
          {venueRows.length === 0 && <li className="py-3 text-sm text-muted">No venues match.</li>}
          {venueRows.map((v) => {
            const gone = isRemoved('venue', v.id);
            const id = `venue:${v.id}`;
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5" data-testid={`venue-row-${v.id}`}>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-ink">{v.name}</span>
                  <span className="ml-2 text-[12px] text-muted">{v.city}</span>
                  {gone && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-black uppercase text-red-700">Deleted</span>}
                  {gone && removals[id]?.removed_at && <span className="ml-2 text-[12px] text-muted">{fmt(removals[id].removed_at)}{removals[id].removed_by ? ` · ${removals[id].removed_by}` : ''}</span>}
                </span>
                {!gone && <a href={v.path} target="_blank" rel="noreferrer" className={BTN}>View</a>}
                {gone ? (
                  <button type="button" className={BTN} disabled={busy === id} onClick={() => change('venue', v.id, v.name, 'restore')} data-testid={`venue-restore-${v.id}`}>Restore</button>
                ) : (
                  <button type="button" className={DANGER} disabled={busy === id} onClick={() => change('venue', v.id, v.name, 'remove')} data-testid={`venue-delete-${v.id}`}>Delete</button>
                )}
              </li>
            );
          })}
        </ul>
        {!vDeleted && !vq.trim() && venues.length > 30 && <p className="mt-2 text-[13px] text-muted">Showing the first 30 — search to find others.</p>}
      </section>
    </div>
  );
}
