'use client';
// Full Council-controlled programme preview (Prompt 3 §3). Read-only — the
// organisation can never rewrite Council content; it only selects a programme.
import { ghostBtn, primaryBtn, Row, type Prog } from './wizard-ui';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import { PROGRAMME_DEV_NOTE, pendingCouncilReview } from '@/lib/org/programme-status';

export default function ProgrammePreview({ p, orgName, selected, onSelect, onClose }: {
  p: Prog; orgName: string; selected: boolean; onSelect: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose} data-testid="prog-preview-modal">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Council Programme</span>
            <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-ink-soft">{p.taxonomy_label}</span>
            {p.version && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{p.version}</span>}
            <ProgrammeDevNote programme={p} size="xs" />
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-xl leading-none text-muted hover:bg-cream">×</button>
        </div>

        <h3 className="mt-3 text-xl font-black tracking-tight text-ink">{p.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{p.essence}</p>

        {/* Council vs Organisation Event distinction */}
        <div className="mt-4 rounded-xl bg-cream/60 p-3 text-xs">
          <p><span className="font-bold text-emerald-700">Council Programme:</span> <span className="text-ink">{p.name}</span></p>
          <p className="mt-1"><span className="font-bold text-brand-700">Your Organisation Event:</span> <span className="text-ink">{p.name} — {orgName || 'Your Org'} — your date</span></p>
        </div>

        <div className="mt-4">
          {(p.objectives?.length ?? 0) > 0 && (
            <Row label="Objectives">
              <ul className="list-disc space-y-0.5 pl-4">{p.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
            </Row>
          )}
          <Row label="Category">{p.taxonomy_label}</Row>
          {p.recommended_audience && p.recommended_audience.length > 0 && <Row label="Audience">{p.recommended_audience.join(', ')}</Row>}
          {p.recommended_group_size && <Row label="Group size">{p.recommended_group_size}</Row>}
          {p.recommended_duration_label && <Row label="Duration">{p.recommended_duration_label}</Row>}
          {p.recommended_frequency && <Row label="Recommended frequency">{p.recommended_frequency}</Row>}
          {p.languages && p.languages.length > 0 && <Row label="Languages">{p.languages.join(', ')}</Row>}
          {p.teacher_competency_requirements && p.teacher_competency_requirements.length > 0 && (
            <Row label="Teacher guidance">
              <ul className="list-disc space-y-0.5 pl-4">{p.teacher_competency_requirements.map((c) => <li key={c}>{c}</li>)}</ul>
              <p className="mt-1 text-[11px] text-muted">Council guidance for the teacher. NOSTOPS matches a verified teacher in your city.</p>
            </Row>
          )}
          {p.council_attribution && <Row label="Attribution">{p.council_attribution}</Row>}
          {p.version && <Row label="Version">{p.version}{pendingCouncilReview(p) ? ` · ${PROGRAMME_DEV_NOTE}` : ''}</Row>}
        </div>

        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">This is Council-controlled content and cannot be edited. You add your event details (date, venue, title) in the next step.</p>
        {p.disclaimer && <p className="mt-2 text-[10px] italic text-muted">{p.disclaimer}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={ghostBtn + ' flex-1'}>Close</button>
          <button type="button" onClick={onSelect} data-testid="preview-select" className={primaryBtn + ' flex-1' + (selected ? ' !bg-emerald-600' : '')}>
            {selected ? 'Selected ✓' : 'Select this programme'}
          </button>
        </div>
      </div>
    </div>
  );
}
