'use client';

import { useState } from 'react';
import { postBff, sendBff } from '@/lib/auth-client';
import type { EnquiryDelivery, OrgEnquiry } from '@/lib/server/org-enquiries';
import { STAGES, labelOf } from '@/lib/org/enquiry';
import { StageChip } from '@/components/app/admin/OrgEnquiryPipeline';

const field = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand';
const when = (iso?: string) => (iso || '').replace('T', ' ').replace(/\+.*/, '');

function historyText(h: OrgEnquiry['history'][number]): string {
  if (h.action === 'created') return 'Enquiry received from the website';
  if (h.action === 'stage') return `Stage ${labelOf(STAGES, h.from)} → ${labelOf(STAGES, h.to)}`;
  if (h.action === 'owner') return `Owner ${h.from || 'unassigned'} → ${h.to || 'unassigned'}`;
  if (h.action === 'note') return 'Note added';
  if (h.action === 'proposal') return `Proposal email sent: ${h.subject || ''}`;
  return h.action;
}

function Delivery({ label, d }: { label: string; d?: EnquiryDelivery }) {
  const status = d?.status || 'pending';
  const tone = status === 'sent' ? 'text-emerald-700' : status === 'failed' ? 'text-red-600' : 'text-muted';
  return (
    <li className="flex items-center justify-between gap-2 text-sm" data-testid={`enq-notify-${label.toLowerCase().split(' ')[0]}`}>
      <span className="text-ink-soft">{label}</span>
      <span className={`font-bold ${tone}`}>
        {status}
        {d?.attempts ? ` · ${d.attempts} attempt${d.attempts === 1 ? '' : 's'}` : ''}
      </span>
    </li>
  );
}

export default function OrgEnquiryEditor({ initial }: { initial: OrgEnquiry }) {
  const [e, setE] = useState<OrgEnquiry>(initial);
  const [stage, setStage] = useState(initial.stage);
  const [owner, setOwner] = useState(initial.owner || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [resending, setResending] = useState(false);

  const save = async () => {
    setSaving(true);
    setMsg('');
    const { ok, data } = await sendBff<OrgEnquiry & { error?: string }>(`/bff/admin/org-enquiries/${e.id}`, 'PATCH', {
      stage,
      owner,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (ok && data?.id) {
      setE(data);
      setNote('');
      setMsg('Saved.');
    } else {
      setMsg(data?.error || 'Could not save.');
    }
  };

  const resend = async () => {
    setResending(true);
    const { ok, data } = await postBff<{ notifications?: OrgEnquiry['notifications']; error?: string }>(`/bff/admin/org-enquiries/${e.id}/notify-retry`, {});
    setResending(false);
    if (ok && data?.notifications) setE((cur) => ({ ...cur, notifications: data.notifications! }));
    else setMsg(data?.error || 'Could not resend.');
  };

  const anyFailed = e.notifications?.team?.status === 'failed' || e.notifications?.ack?.status === 'failed';

  return (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div className="rounded-2xl border border-line bg-white p-5" data-testid="enq-editor">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Pipeline</p>
          <StageChip stage={e.stage} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-ink">
            Stage
            <select value={stage} onChange={(ev) => setStage(ev.target.value)} className={field} data-testid="enq-edit-stage">
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-ink">
            Owner
            <input value={owner} onChange={(ev) => setOwner(ev.target.value)} placeholder="Unassigned" maxLength={120} className={field} data-testid="enq-edit-owner" />
          </label>
        </div>
        <label className="mt-3 block text-xs font-bold text-ink">
          Add a note
          <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={3} maxLength={4000} placeholder="Call summary, next step…" className={`${field} resize-y`} data-testid="enq-edit-note" />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="enq-edit-save">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-sm font-semibold text-brand-700" data-testid="enq-edit-msg">{msg}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wide text-muted">Notifications</p>
        <ul className="mt-2 space-y-1.5">
          <Delivery label="Team alert" d={e.notifications?.team} />
          <Delivery label="Acknowledgement to enquirer" d={e.notifications?.ack} />
        </ul>
        {anyFailed && (
          <button type="button" onClick={resend} disabled={resending} className="mt-3 inline-flex min-h-[40px] items-center rounded-xl border border-line px-3 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50" data-testid="enq-resend">
            {resending ? 'Resending…' : 'Resend failed emails'}
          </button>
        )}
      </div>

      {e.notes.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Notes</p>
          <ul className="mt-2 space-y-2" data-testid="enq-notes">
            {[...e.notes].reverse().map((n, i) => (
              <li key={i} className="rounded-lg bg-cream/50 px-3 py-2 text-sm text-ink-soft">
                <span className="whitespace-pre-wrap">{n.text}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{n.author} · {when(n.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wide text-muted">History</p>
        <ol className="mt-2 space-y-1.5" data-testid="enq-history">
          {[...e.history].reverse().map((h, i) => (
            <li key={i} className="text-sm text-ink-soft">
              {historyText(h)}
              <span className="block text-[11px] text-muted">{h.actor} · {when(h.at)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
