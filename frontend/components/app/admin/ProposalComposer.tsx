'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { OrgEnquiry } from '@/lib/server/org-enquiries';
import { buildProposalTemplates, type ProposalTemplateKey } from '@/lib/org/proposal-templates';

// Admin proposal composer: pick a ready-made template → edit subject/body →
// preview the exact email (rendered by the backend, shown in a sandboxed
// iframe) → send. Sending moves the enquiry to "Proposal sent" (if earlier in
// the pipeline) and logs it in the history; the page then refreshes.
const field = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand';
const when = (iso?: string) => (iso || '').replace('T', ' ').replace(/\+.*/, '');

export default function ProposalComposer({ enquiry }: { enquiry: OrgEnquiry }) {
  const router = useRouter();
  const templates = useMemo(() => buildProposalTemplates(enquiry), [enquiry]);
  const [key, setKey] = useState<ProposalTemplateKey>('programme');
  const [subject, setSubject] = useState(templates[0].subject);
  const [body, setBody] = useState(templates[0].body);
  const [preview, setPreview] = useState<{ html: string; to: string; reply_to: string; subject: string } | null>(null);
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState('');

  const current = templates.find((t) => t.key === key)!;
  const edited = subject !== current.subject || body !== current.body;
  const past = enquiry.proposals || [];

  if (!enquiry.email) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5" data-testid="proposal-composer">
        <p className="text-xs font-black uppercase tracking-wide text-muted">Send a proposal</p>
        <p className="mt-2 text-sm text-ink-soft" data-testid="proposal-no-email">
          This enquiry has no email address{enquiry.phone ? `. Call them on ${enquiry.phone} instead.` : '.'}
        </p>
      </div>
    );
  }

  const pick = (k: ProposalTemplateKey) => {
    if (k === key) return;
    if (edited && !window.confirm('Switch template? Your edits to this draft will be replaced.')) return;
    const t = templates.find((x) => x.key === k)!;
    setKey(k);
    setSubject(t.subject);
    setBody(t.body);
    setPreview(null);
    setErr('');
  };

  const payload = () => ({ template: key, subject: subject.trim(), body: body.trim() });

  const doPreview = async () => {
    setBusy('preview');
    setErr('');
    const { ok, data } = await postBff<any>(`/bff/admin/org-enquiries/${enquiry.id}/proposal/preview`, payload());
    setBusy(null);
    if (ok && data?.html) setPreview(data);
    else setErr(data?.error || 'Could not build the preview.');
  };

  const doSend = async () => {
    if (!window.confirm(`Send this proposal to ${enquiry.email}?`)) return;
    setBusy('send');
    setErr('');
    const { ok, data } = await postBff<any>(`/bff/admin/org-enquiries/${enquiry.id}/proposal`, payload());
    setBusy(null);
    if (!ok) {
      setErr(data?.error || 'Could not send the proposal.');
      return;
    }
    setSent(`Proposal sent to ${enquiry.email}.`);
    setPreview(null);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="proposal-composer">
      <p className="text-xs font-black uppercase tracking-wide text-muted">Send a proposal</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Proposal template">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={key === t.key}
            onClick={() => pick(t.key)}
            data-testid={`proposal-template-${t.key}`}
            className={`rounded-xl border p-3 text-left transition ${key === t.key ? 'border-brand bg-brand-50' : 'border-line hover:border-brand/50'}`}
          >
            <span className="block text-sm font-bold text-ink">{t.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.hint}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-bold text-ink">
        Subject
        <input value={subject} onChange={(ev) => { setSubject(ev.target.value); setPreview(null); }} maxLength={200} className={field} data-testid="proposal-subject" />
      </label>
      <label className="mt-3 block text-xs font-bold text-ink">
        Message <span className="font-normal text-muted">· plain text; start a line with &ldquo;• &rdquo; for a bullet</span>
        <textarea value={body} onChange={(ev) => { setBody(ev.target.value); setPreview(null); }} rows={16} maxLength={8000} className={`${field} resize-y font-mono text-[13px] leading-relaxed`} data-testid="proposal-body" />
      </label>
      <p className="mt-1 text-xs text-muted">
        To <strong>{enquiry.email}</strong> · replies go to the team inbox{edited ? ' · edited' : ''}
      </p>

      {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert" data-testid="proposal-error">{err}</p>}
      {sent && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700" role="status" data-testid="proposal-sent">{sent}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={doPreview} disabled={!!busy || subject.trim().length < 3 || body.trim().length < 20} className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50" data-testid="proposal-preview-btn">
          {busy === 'preview' ? 'Building preview…' : 'Preview'}
        </button>
        <button type="button" onClick={doSend} disabled={!!busy || !preview} title={preview ? '' : 'Preview the email first'} className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="proposal-send-btn">
          {busy === 'send' ? 'Sending…' : 'Send proposal'}
        </button>
        {!preview && <span className="self-center text-xs text-muted">Preview the email to enable sending.</span>}
      </div>

      {preview && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line" data-testid="proposal-preview">
          <div className="border-b border-line bg-cream px-3 py-2 text-xs text-ink-soft">
            <p><strong>To:</strong> {preview.to} · <strong>Reply-to:</strong> {preview.reply_to}</p>
            <p className="mt-0.5"><strong>Subject:</strong> {preview.subject}</p>
          </div>
          <iframe title="Proposal email preview" sandbox="" srcDoc={preview.html} className="h-[480px] w-full bg-white" data-testid="proposal-preview-frame" />
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Proposals sent</p>
          <ul className="mt-2 space-y-1.5" data-testid="proposal-log">
            {[...past].reverse().map((p, i) => (
              <li key={i} className="text-sm text-ink-soft">
                <span className={p.status === 'sent' ? 'font-bold text-emerald-700' : 'font-bold text-red-600'}>{p.status}</span> · {p.subject}
                <span className="block text-[11px] text-muted">{p.sent_by} · {when(p.at)} · {p.template === 'call' ? 'Personal note' : 'Programme proposal'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
