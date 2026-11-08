'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

type PP = { slug: string; id: string; name: string; classification: string };

const RELATIONSHIPS = ['Teacher-declared', 'Influenced by', 'Methodological association'];

export default function DeclareTraditionForm({ paramparas }: { paramparas: PP[] }) {
  const [f, setF] = useState({
    parampara_id: '', relationship_type: RELATIONSHIPS[0], guru_name: '', guru_guru_name: '',
    training_institution: '', years_of_training: '', certification: '', city_id: '',
    scriptures_studied: '', practices_learned: '', practices_taught: '', evidence_document: '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.parampara_id) { setMsg({ ok: false, text: 'Please choose a tradition.' }); return; }
    setBusy(true); setMsg(null);
    const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const res = await postBff('/bff/knowledge/teacher-parampara', {
      parampara_id: f.parampara_id,
      relationship_type: f.relationship_type,
      guru_name: f.guru_name || null,
      guru_guru_name: f.guru_guru_name || null,
      city_id: f.city_id || null,
      training_institution: f.training_institution || null,
      years_of_training: f.years_of_training ? Number(f.years_of_training) : undefined,
      certification: f.certification || null,
      scriptures_studied: csv(f.scriptures_studied),
      practices_learned: csv(f.practices_learned),
      practices_taught: csv(f.practices_taught),
      evidence_document: f.evidence_document || null,
    });
    setBusy(false);
    if (res.ok) setMsg({ ok: true, text: 'Submitted for review. It will appear as “Teacher-declared” until verified by NOSTOPS.' });
    else setMsg({ ok: false, text: (res.data as any)?.error || (res.data as any)?.detail || 'Could not submit.' });
  }

  // A render helper (not a nested component) so inputs keep focus while typing.
  const renderField = ({ label, k, ph, type = 'text' }: { label: string; k: keyof typeof f; ph?: string; type?: string }) => (
    <label className="block">
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <input type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph}
        className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" />
    </label>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-6">
      {msg && <p className={`rounded-xl px-4 py-2 text-sm font-semibold ${msg.ok ? 'bg-brand-50 text-brand-700' : 'bg-amber-100 text-amber-800'}`} data-testid="declare-msg">{msg.text}</p>}

      <label className="block">
        <span className="text-sm font-semibold text-ink-soft">Paramparā / tradition *</span>
        <select value={f.parampara_id} onChange={(e) => set('parampara_id', e.target.value)}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" data-testid="parampara-select">
          <option value="">Select a tradition…</option>
          {paramparas.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.classification}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-ink-soft">Relationship</span>
        <select value={f.relationship_type} onChange={(e) => set('relationship_type', e.target.value)}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm">
          {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {renderField({ label: "Guru / Ācārya", k: "guru_name", ph: "Your teacher" })}
        {renderField({ label: "Guru's Guru (if known)", k: "guru_guru_name" })}
        {renderField({ label: "Training institution", k: "training_institution" })}
        {renderField({ label: "Years of study", k: "years_of_training", type: "number" })}
        {renderField({ label: "Certification", k: "certification" })}
        {renderField({ label: "City", k: "city_id", ph: "e.g. pune" })}
      </div>
      {renderField({ label: "Scriptures studied (comma-separated)", k: "scriptures_studied", ph: "Yoga Sūtras, Haṭha Pradīpikā" })}
      {renderField({ label: "Practices learned (comma-separated)", k: "practices_learned" })}
      {renderField({ label: "Practices currently taught (comma-separated)", k: "practices_taught" })}
      {renderField({ label: "Evidence / documentation (link or reference)", k: "evidence_document", ph: "URL or certificate reference" })}

      <button onClick={submit} disabled={busy}
        className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50">
        {busy ? 'Submitting…' : 'Submit for review'}
      </button>
      <p className="text-xs text-muted">NOSTOPS reviews every submission. Your lineage is never shown as verified until an admin confirms it with evidence.</p>
    </div>
  );
}
