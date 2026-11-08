'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { GuruNomination } from '@/lib/server/guru-nominations';

// The next steps an admin can record on a website Guru nomination. The backend enforces the
// same order (TRANSITIONS in backend/guru_nominations.py); this only shows the valid ones.
type Input = 'none' | 'note' | 'question' | 'handle' | 'consent';
type Def = { label: string; tone: 'primary' | 'danger' | 'plain'; input: Input; help: string; placeholder?: string };

const DEFS: Record<string, Def> = {
  advance: { label: 'Send to the Council', tone: 'primary', input: 'note', help: 'The Council decides outside the website. Record their decision here afterwards.', placeholder: 'Private note (optional)' },
  request_info: { label: 'Ask the nominator', tone: 'plain', input: 'question', help: 'The nominator gets an email and sees your question in their dashboard.', placeholder: 'What would you like to know?' },
  decline: { label: 'Decline', tone: 'danger', input: 'note', help: 'The nominator sees “Not taken forward this time”. Your note stays private.', placeholder: 'Private reason (optional)' },
  council_approved: { label: 'Council approved', tone: 'primary', input: 'note', help: 'Next, invite the Guru outside the website and record their answer here.', placeholder: 'Private note (optional)' },
  council_declined: { label: 'Council did not approve', tone: 'danger', input: 'note', help: 'The nominator sees “Not taken forward this time”.', placeholder: 'Private note (optional)' },
  link_profile: { label: 'Link Council profile', tone: 'plain', input: 'handle', help: 'The handle of the Guru’s profile in Council Roster, e.g. acharya-jane-doe. It stays hidden from every public page until you publish. Leave empty to unlink.' },
  record_acceptance: { label: 'Record the Guru’s acceptance', tone: 'primary', input: 'consent', help: 'Required before publishing: when and how the Guru agreed to join and to be shown publicly.' },
  guru_declined: { label: 'The Guru declined', tone: 'danger', input: 'note', help: 'Their profile stays hidden. The nominator sees “Not taken forward this time”.', placeholder: 'Private note (optional)' },
  publish: { label: 'Publish on the Council page', tone: 'primary', input: 'none', help: 'The Guru’s Council profile becomes visible on /council, in search results and in the sitemap.' },
  unpublish: { label: 'Unpublish', tone: 'danger', input: 'note', help: 'The profile is hidden again from every public page.', placeholder: 'Private reason (optional)' },
  reopen: { label: 'Reopen', tone: 'plain', input: 'note', help: 'Moves the nomination back to “Waiting for admin review”.', placeholder: 'Private note (optional)' },
  archive: { label: 'Archive', tone: 'plain', input: 'note', help: 'Hidden from the queue. Nothing is deleted; restore it any time from Archived.', placeholder: 'Reason (optional)' },
  restore: { label: 'Restore', tone: 'primary', input: 'none', help: 'Puts the nomination back in the queue with its previous status.' },
};

const NEXT: Record<string, string[]> = {
  pending_review: ['advance', 'request_info', 'decline'],
  info_requested: ['advance', 'request_info', 'decline'],
  with_council: ['council_approved', 'council_declined', 'decline'],
  council_approved: ['link_profile', 'record_acceptance', 'guru_declined'],
  accepted: ['link_profile', 'publish', 'guru_declined'],
  published: ['unpublish'],
  declined: ['reopen'],
  council_declined: ['reopen'],
  guru_declined: ['reopen'],
  withdrawn: [],
};

const BTN = {
  primary: 'bg-brand text-white hover:bg-brand-600',
  danger: 'border border-red-200 text-red-700 hover:bg-red-50',
  plain: 'border border-line text-ink-soft hover:border-brand',
};
const FIELD = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function GuruNominationActions({ n, channels }: { n: GuruNomination; channels: Record<string, string> }) {
  const router = useRouter();
  const [mode, setMode] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [handle, setHandle] = useState(n.council_handle || '');
  const [consent, setConsent] = useState({ accepted_on: today(), channel: 'email', photo_ok: false, note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keys = n.archived ? ['restore'] : [...(NEXT[n.status] || []), ...(n.status === 'published' ? [] : ['archive'])];
  const def = mode ? DEFS[mode] : null;

  function open(k: string) {
    setMode(k);
    setText('');
    setError(null);
    setHandle(n.council_handle || '');
  }

  async function confirm() {
    if (!mode || !def) return;
    if (def.input === 'question' && text.trim().length < 5) {
      setError('Please type your question (at least 5 characters).');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await postBff(`/bff/admin/guru-nominations/${encodeURIComponent(n.id)}`, {
      action: mode,
      note: def.input === 'note' ? text.trim() : '',
      question: def.input === 'question' ? text.trim() : '',
      handle: def.input === 'handle' ? handle.trim() : '',
      consent: def.input === 'consent' ? consent : null,
    });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) {
      setError(res.data?.error || 'Could not complete the step.');
      return;
    }
    setMode(null);
    router.refresh();
  }

  if (keys.length === 0) return null;

  return (
    <div className="mt-4 border-t border-line pt-4" data-testid={`gnom-actions-${n.id}`}>
      {!def ? (
        <div className="flex flex-wrap gap-2">
          {keys.map((k) => (
            <button key={k} type="button" onClick={() => open(k)} data-testid={`gnom-${k}-${n.id}`} className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold transition ${BTN[DEFS[k].tone]}`}>
              {DEFS[k].label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3" data-testid={`gnom-panel-${n.id}`}>
          <p className="text-sm font-bold text-ink">{def.label}</p>
          <p className="text-xs text-muted">{def.help}</p>
          {(def.input === 'note' || def.input === 'question') && (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={def.input === 'question' ? 3 : 2} maxLength={1200} placeholder={def.placeholder} data-testid={`gnom-text-${n.id}`} className={FIELD} />
          )}
          {def.input === 'handle' && (
            <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={100} placeholder="acharya-jane-doe" data-testid={`gnom-handle-${n.id}`} className={FIELD} />
          )}
          {def.input === 'consent' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ink-soft">
                Date they accepted
                <input type="date" value={consent.accepted_on} max={today()} onChange={(e) => setConsent({ ...consent, accepted_on: e.target.value })} data-testid={`gnom-consent-date-${n.id}`} className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs font-semibold text-ink-soft">
                How they accepted
                <select value={consent.channel} onChange={(e) => setConsent({ ...consent, channel: e.target.value })} data-testid={`gnom-consent-channel-${n.id}`} className={`${FIELD} mt-1`}>
                  {Object.entries(channels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-xs font-semibold text-ink-soft sm:col-span-2">
                <input type="checkbox" checked={consent.photo_ok} onChange={(e) => setConsent({ ...consent, photo_ok: e.target.checked })} className="h-5 w-5 accent-brand" />
                The Guru agreed to their photo being shown
              </label>
              <textarea value={consent.note} onChange={(e) => setConsent({ ...consent, note: e.target.value })} rows={2} maxLength={600} placeholder="What they agreed to, in their words (optional)" className={`${FIELD} sm:col-span-2`} />
            </div>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" data-testid={`gnom-error-${n.id}`}>{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={confirm} data-testid={`gnom-confirm-${n.id}`} className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${BTN[def.tone === 'danger' ? 'danger' : 'primary']}`}>
              {busy ? '…' : 'Confirm'}
            </button>
            <button type="button" onClick={() => { setMode(null); setError(null); }} className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft hover:bg-cream">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
