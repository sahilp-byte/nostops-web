'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

// PROMPT 12/13 — Teacher-led Cohort. The teacher creates a private, named group
// for THIS retreat and shares a self-serve link (QR / WhatsApp / copy). There is
// NO phonebook upload and NO student ownership: participants self-register and
// each is simply tagged "joined <cohort> for this retreat". Cohort names live in
// the teacher's browser; the roster comes from real reservations tagged to it.

type Member = { cohort: string; name: string; status: string };
type Cohort = { name: string; createdAt: number };

function keyFor(id: string) {
  return `nostops.cohorts.${id}`;
}

export default function CohortManager({ retreatId, retreatTitle, via, isPublic, members }: { retreatId: string; retreatTitle: string; via: string; isPublic: boolean; members: Member[] }) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const raw = localStorage.getItem(keyFor(retreatId));
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setCohorts(parsed.filter((c) => c && typeof c.name === 'string'));
    } catch {
      /* ignore */
    }
  }, [retreatId]);

  // Ensure any cohort that already has members (from reservations) is listed even
  // if it was created on another device.
  useEffect(() => {
    const fromMembers = Array.from(new Set(members.map((m) => m.cohort).filter(Boolean)));
    if (!fromMembers.length) return;
    setCohorts((prev) => {
      const have = new Set(prev.map((c) => c.name));
      const add = fromMembers.filter((n) => !have.has(n)).map((n) => ({ name: n, createdAt: Date.now() }));
      return add.length ? [...prev, ...add] : prev;
    });
  }, [members]);

  function persist(next: Cohort[]) {
    setCohorts(next);
    try {
      localStorage.setItem(keyFor(retreatId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function addCohort() {
    const n = name.trim().slice(0, 60);
    if (n.length < 2) return;
    if (cohorts.some((c) => c.name.toLowerCase() === n.toLowerCase())) { setName(''); return; }
    persist([...cohorts, { name: n, createdAt: Date.now() }]);
    setName('');
  }
  function removeCohort(n: string) {
    persist(cohorts.filter((c) => c.name !== n));
  }

  const rosterByCohort = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of members) {
      if (!m.cohort) continue;
      if (!map.has(m.cohort)) map.set(m.cohort, []);
      map.get(m.cohort)!.push(m);
    }
    return map;
  }, [members]);

  function linkFor(n: string) {
    const q = new URLSearchParams({ cohort: n });
    if (via) q.set('via', via);
    return `${origin}/retreats/${retreatId}?${q.toString()}`;
  }
  function inviteText(n: string) {
    return `Join my cohort “${n}” for ${retreatTitle} on NOSTOPS Register yourself here: ${linkFor(n)}`;
  }
  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(tag);
    setTimeout(() => setCopied((c) => (c === tag ? null : c)), 2000);
  }

  if (!isPublic) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-cream/50 p-5" data-testid="cohort-manager">
        <h2 className="text-sm font-extrabold text-ink">Teacher-led cohorts</h2>
        <p className="mt-1 text-sm text-ink-soft">Publish this retreat to create private cohort links for your students.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-royal/25 bg-royal-50/40 p-5" data-testid="cohort-manager">
      <h2 className="text-sm font-extrabold text-ink">Teacher-led cohorts</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Create a private group for your own students on this retreat. Share the link — they register themselves. No phone numbers to upload, and everyone stays their own independent NOSTOPS member.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCohort(); } }}
          maxLength={60}
          placeholder="e.g. My Mumbai Students"
          className="min-h-[44px] flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-royal focus:ring-2 focus:ring-royal/20"
          data-testid="cohort-name-input"
        />
        <button type="button" onClick={addCohort} disabled={name.trim().length < 2} className="shrink-0 rounded-xl bg-royal px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" data-testid="cohort-create">Create</button>
      </div>

      {cohorts.length === 0 ? (
        <p className="mt-3 text-xs text-muted">No cohorts yet. Create one to get a shareable invite link + QR code.</p>
      ) : (
        <ul className="mt-4 space-y-3 p-0">
          {cohorts.map((c) => {
            const roster = rosterByCohort.get(c.name) || [];
            const link = linkFor(c.name);
            return (
              <li key={c.name} className="rounded-xl border border-line bg-white p-4" data-testid="cohort-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-ink">{c.name}</p>
                    <p className="text-xs text-muted">{roster.length} joined{roster.length ? ` · ${roster.slice(0, 3).map((m) => m.name.split(' ')[0]).join(', ')}${roster.length > 3 ? '…' : ''}` : ''}</p>
                  </div>
                  <button type="button" onClick={() => removeCohort(c.name)} className="shrink-0 text-xs font-bold text-muted underline hover:text-red-600" data-testid="cohort-remove">Remove</button>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-cream/50 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-soft" data-testid="cohort-link">{link}</span>
                  <button type="button" onClick={() => copy(link, `link-${c.name}`)} className="shrink-0 rounded-md bg-royal px-2.5 py-1 text-[11px] font-bold text-white" data-testid="cohort-copy-link">{copied === `link-${c.name}` ? 'Copied ✓' : 'Copy link'}</button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={`/app/teacher/retreats/${retreatId}/cohort/${encodeURIComponent(c.name)}`} className="rounded-lg border border-royal/30 bg-white px-3 py-1.5 text-xs font-bold text-royal transition hover:bg-royal-50" data-testid="cohort-view-roster">View roster{roster.length ? ` (${roster.length})` : ''} →</Link>
                  <a href={`https://wa.me/?text=${encodeURIComponent(inviteText(c.name))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95" data-testid="cohort-whatsapp">WhatsApp</a>
                  <button type="button" onClick={() => copy(inviteText(c.name), `inv-${c.name}`)} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream">{copied === `inv-${c.name}` ? 'Invite copied ✓' : 'Copy invite'}</button>
                  <button type="button" onClick={() => setShowQr((q) => (q === c.name ? null : c.name))} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream" data-testid="cohort-qr-toggle">{showQr === c.name ? 'Hide QR' : 'QR code'}</button>
                </div>

                {showQr === c.name && origin && (
                  <div className="mt-3 inline-flex flex-col items-center rounded-xl border border-line bg-white p-3" data-testid="cohort-qr">
                    <QRCodeSVG value={link} size={148} includeMargin level="M" />
                    <p className="mt-2 text-[11px] text-muted">Scan to join “{c.name}”</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
