'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { VerificationStatus, EmpanelmentStatus, LevelStatus } from '@/lib/teacher-status';

type LevelValue = 0 | 1 | 2 | 3;

const VERIFICATION_OPTS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_verified', label: 'Not Verified' },
];
const EMPANELMENT_OPTS: Array<{ value: EmpanelmentStatus; label: string }> = [
  { value: 'empanelled', label: 'Empanelled' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_empanelled', label: 'Not Empanelled' },
];
const LEVEL_OPTS: Array<{ value: LevelValue; label: string }> = [
  { value: 0, label: 'No Level Assigned' },
  { value: 1, label: 'Level 1 · Yoga Shikshak' },
  { value: 2, label: 'Level 2 · Yoga Pracharak' },
  { value: 3, label: 'Level 3 · Yoga Guru' },
];

function levelToValue(l: LevelStatus): LevelValue {
  return l === 'none' ? 0 : (l as LevelValue);
}

type FieldResult = { persisted: boolean; message: string; via?: string };
type SaveResponse = { ok?: boolean; error?: string; results?: Record<string, FieldResult> };

function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
  testid,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  testid: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} data-testid={testid} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${testid}-${o.value}`}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminTeacherStatusControls({
  teacherId,
  initialVerification,
  initialEmpanelment,
  initialLevel,
}: {
  teacherId: string;
  initialVerification: VerificationStatus;
  initialEmpanelment: EmpanelmentStatus;
  initialLevel: LevelStatus;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState({
    verification: initialVerification,
    empanelment: initialEmpanelment,
    level: levelToValue(initialLevel),
  });
  const [verification, setVerification] = useState<VerificationStatus>(initialVerification);
  const [empanelment, setEmpanelment] = useState<EmpanelmentStatus>(initialEmpanelment);
  const [level, setLevel] = useState<LevelValue>(levelToValue(initialLevel));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Record<string, FieldResult> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = verification !== saved.verification || empanelment !== saved.empanelment || level !== saved.level;

  async function save() {
    setError(null);
    setResults(null);
    const payload: Record<string, unknown> = {};
    if (verification !== saved.verification) {
      payload.verification = verification;
      if (verification === 'not_verified' && reason.trim()) payload.verificationReason = reason.trim();
    }
    if (empanelment !== saved.empanelment) payload.empanelment = empanelment;
    if (level !== saved.level) payload.level = level;
    if (Object.keys(payload).length === 0) return;

    setSaving(true);
    try {
      const res = await postBff<SaveResponse>(`/bff/admin/teachers/${encodeURIComponent(teacherId)}/status`, payload);
      if (!res.ok || !res.data?.ok) {
        setError(res.data?.error || 'Could not save changes.');
        return;
      }
      const r = res.data.results || {};
      setResults(r);
      setSaved((prev) => ({
        verification: r.verification?.persisted ? verification : prev.verification,
        empanelment: r.empanelment?.persisted ? empanelment : prev.empanelment,
        level: r.level?.persisted ? level : prev.level,
      }));
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="admin-status-controls">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Verification</p>
        <div className="mt-1.5">
          <Segmented<VerificationStatus> name="Verification" testid="status-verification" value={verification} onChange={setVerification} options={VERIFICATION_OPTS} />
        </div>
        {verification === 'not_verified' && verification !== saved.verification && (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for revoking (optional, ≥10 chars for KYC reject)"
            data-testid="status-verification-reason"
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
          />
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Empanelment</p>
        <div className="mt-1.5">
          <Segmented<EmpanelmentStatus> name="Empanelment" testid="status-empanelment" value={empanelment} onChange={setEmpanelment} options={EMPANELMENT_OPTS} />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">NOSTOPS Teacher Level</p>
        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value) as LevelValue)}
          data-testid="status-level"
          className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand"
        >
          {LEVEL_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        Admin-only — teachers cannot self-assign these. Verification &amp; Empanelment stay independent (a verified teacher is not
        auto-empanelled). Empanelment saves to the authoritative record immediately.
      </p>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        data-testid="status-save"
        className="w-full rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>

      {error && (
        <p data-testid="status-error" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
      )}

      {results && (
        <div data-testid="status-result" className="space-y-1.5 rounded-xl border border-line bg-white p-3">
          <p className="text-xs font-black text-ink">Changes saved</p>
          {Object.entries(results).map(([field, r]) => (
            <p key={field} className={`text-[11px] leading-relaxed ${r.persisted ? 'text-emerald-700' : 'text-amber-700'}`}>
              <span className="font-bold capitalize">{field}:</span> {r.persisted ? '✓ ' : '⏳ '}{r.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
