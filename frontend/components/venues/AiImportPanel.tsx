'use client';

import { useState } from 'react';

// TIER 2 free early-access preview — AI-assisted suggestions pulled from the
// owner's OWN website. Everything is clearly labelled UNVERIFIED; the owner
// reviews each field and must click Save (existing edit) to approve. Nothing is
// written to the live listing here, and there is NO payment of any kind.

const FIELD_LABEL: Record<string, string> = {
  description: 'Description',
  address: 'Address',
  submitter_phone: 'Phone',
};

export default function AiImportPanel({
  token,
  onApplyField,
}: {
  token: string;
  onApplyField: (key: string, value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [proposed, setProposed] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  async function run() {
    setBusy(true);
    setMsg(null);
    setPaywall(false);
    try {
      const r = await fetch('/bff/venue/public-submissions/import-draft', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPaywall(r.status === 402 || !!d?.payment_required);
        setMsg(d?.error || 'Could not generate suggestions.');
        setProposed({});
      } else {
        setPaywall(false);
        setProposed((d?.proposed && typeof d.proposed === 'object') ? d.proposed : {});
        setMsg(d?.message || null);
      }
    } catch {
      setMsg('Could not reach the service. Please try again.');
    } finally {
      setRan(true);
      setBusy(false);
    }
  }

  const keys = Object.keys(proposed);

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5" data-testid="ai-import-panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-xs font-bold text-white">✨ AI-Assisted Onboarding</span>
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">Paid · one-time</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Pull suggested details from your website to help fill in your listing faster. These are
        <strong> AI-assisted, unverified suggestions</strong> — review and edit each one, then click
        <strong> Save</strong> below to approve. Nothing is saved until you approve. AI onboarding is a
        one-time paid upgrade, bought once for this venue listing.
      </p>

      <button
        type="button"
        onClick={run}
        disabled={busy}
        data-testid="ai-import-generate"
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Reading your website…' : ran ? 'Regenerate suggestions' : 'Generate suggestions from my website'}
      </button>

      {msg && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-900/80" data-testid="ai-import-msg">{msg}</p>}

      {paywall && (
        <a
          href={`/venues/ai-onboarding?token=${encodeURIComponent(token)}`}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          data-testid="ai-import-paywall-cta"
        >
          Unlock AI onboarding — pay once →
        </a>
      )}

      {keys.length > 0 && (
        <ul className="mt-4 space-y-3" data-testid="ai-import-suggestions">
          {keys.map((k) => (
            <li key={k} className="rounded-xl border border-indigo-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-muted">{FIELD_LABEL[k] || k}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Unverified</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-ink-soft">{proposed[k]}</p>
              <button
                type="button"
                onClick={() => { onApplyField(k, proposed[k]); setApplied((p) => ({ ...p, [k]: true })); }}
                className="mt-2 inline-flex min-h-[40px] items-center justify-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                data-testid={`ai-import-apply-${k}`}
              >
                {applied[k] ? '✓ Applied — review below' : 'Apply to form'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
