import Link from 'next/link';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { NOMINATION_TONE } from '@/lib/nomination-status';
import type { GuruNomination } from '@/lib/server/guru-nominations';
import GuruNominationActions from '@/components/app/admin/GuruNominationActions';

// One website Guru nomination in the admin queue: everything the reviewer needs (citation,
// lineage, references, contacts — admin-only), the conversation, the consent record, the linked
// Council profile, the full history, and the valid next steps.
const ACTION_LABELS: Record<string, string> = {
  submitted: 'Submitted', answered: 'Nominator answered', withdrawn: 'Withdrawn by the nominator',
  request_info: 'Asked the nominator', advance: 'Sent to the Council', decline: 'Declined',
  council_approved: 'Council approved', council_declined: 'Council did not approve',
  record_acceptance: 'Guru’s acceptance recorded', guru_declined: 'Guru declined', link_profile: 'Council profile',
  publish: 'Published', unpublish: 'Unpublished', reopen: 'Reopened', archive: 'Archived', restore: 'Restored',
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-28 shrink-0 font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{value}</dd>
    </div>
  );
}

export default function GuruNominationCard({ n, channels }: { n: GuruNomination; channels: Record<string, string> }) {
  const g = n.nominee;
  const by = n.nominator;
  return (
    <article data-testid={`gnom-${n.id}`} className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-ink">{g.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {[n.created_at ? `Nominated ${fmtDate(n.created_at)}` : null, n.id].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {n.archived && <span className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-bold text-ink-soft">Archived</span>}
          <span data-testid={`gnom-status-${n.id}`} className={`rounded-full border px-3 py-1 text-xs font-bold ${NOMINATION_TONE[n.status] || 'border-line bg-cream text-ink-soft'}`}>{n.status_label}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <dl className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">The Guru</p>
          <Row label="Lineage" value={g.lineage} />
          <Row label="City" value={g.city} />
          <Row label="Practice" value={g.decades ? `${g.decades} decade${g.decades > 1 ? 's' : ''} (as stated)` : null} />
          <Row label="Email" value={g.email} />
          <Row label="Phone" value={g.phone} />
        </dl>
        <dl className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Nominated by</p>
          <Row label="Name" value={by.name} />
          <Row label="Email" value={by.email} />
          <Row label="Phone" value={by.phone} />
          <Row label="Member type" value={by.role} />
          <Row label="Relationship" value={n.relationship} />
        </dl>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-muted">🔒 Contact details are admin-only and never shown on the website.</p>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Why they belong on the Council</p>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft" data-testid={`gnom-citation-${n.id}`}>{n.citation}</p>
      </div>
      {n.references && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Books, talks, ashrams, students</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{n.references}</p>
        </div>
      )}

      {n.messages.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Conversation with the nominator</p>
          {n.messages.map((m, i) => (
            <div key={i} className={`rounded-xl px-3 py-2 text-sm ${m.from === 'nostops' ? 'bg-cream' : 'bg-brand/5'}`}>
              <span className="text-xs font-bold text-muted">{m.from === 'nostops' ? 'NOSTOPS' : 'Nominator'}{m.at ? ` · ${fmtDateTime(m.at)}` : ''}</span>
              <p className="whitespace-pre-line text-ink">{m.text}</p>
            </div>
          ))}
        </div>
      )}

      {(n.consent || n.council_handle) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {n.consent && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm" data-testid={`gnom-consent-${n.id}`}>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Guru&apos;s acceptance</p>
              <p className="mt-1 text-ink">
                {fmtDate(n.consent.accepted_on)} · {n.consent.channel_label}{n.consent.photo_ok ? ' · photo allowed' : ' · no photo consent'}
              </p>
              {n.consent.note && <p className="mt-1 text-ink-soft">“{n.consent.note}”</p>}
            </div>
          )}
          {n.council_handle && (
            <div className="rounded-xl border border-line bg-cream p-3 text-sm" data-testid={`gnom-handle-view-${n.id}`}>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Council profile</p>
              <Link href={`/council/${n.council_handle}`} target="_blank" className="mt-1 inline-block font-bold text-brand-700 hover:underline">/council/{n.council_handle}</Link>
              <p className="mt-1 text-xs text-muted">
                {n.status === 'published' ? `Public since ${fmtDate(n.published_at)}` : 'Hidden from every public page until published'}
              </p>
            </div>
          )}
        </div>
      )}

      {n.archived && n.archive_reason && <p className="mt-3 text-xs text-muted">Archive reason: {n.archive_reason}</p>}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs font-bold text-ink-soft">History ({n.history.length})</summary>
        <ol className="mt-2 space-y-1.5 border-l border-line pl-3">
          {n.history.map((h, i) => (
            <li key={i} className="text-xs text-ink-soft">
              <span className="font-bold text-ink">{ACTION_LABELS[h.action] || h.action}</span>
              {h.at ? ` · ${fmtDateTime(h.at)}` : ''}{h.by?.name ? ` · ${h.by.name}` : ''}
              {h.note ? <span className="block text-muted">{h.note}</span> : null}
            </li>
          ))}
        </ol>
      </details>

      <GuruNominationActions n={n} channels={channels} />
    </article>
  );
}
