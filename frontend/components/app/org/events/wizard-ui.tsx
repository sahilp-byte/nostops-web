// Shared types, styles and small presentational pieces of the Event Creator
// wizard (EventCreatorWizard + ProgrammePreview + ParticipantFee).
import type { ReactNode } from 'react';

export type Prog = {
  programme_id: string; name: string; taxonomy: string; taxonomy_label: string;
  essence: string; objectives: string[]; level: string; default_duration_minutes: number;
  recommended_audience?: string[]; recommended_group_size?: string | null;
  recommended_frequency?: string | null; recommended_duration_label?: string | null;
  languages?: string[]; teacher_competency_requirements?: string[];
  council_attribution?: string | null; version?: string | null; content_status?: string | null;
  disclaimer?: string | null;
};

// The Configure-step form state (strings as typed; fee null = follow the rate-card suggestion).
export type WizardCfg = {
  title: string; subtitle: string; date: string; startTime: string; endTime: string; duration: string;
  timezone: string; city: string; venue: string; venueType: string; externalVenueCost: string; capacity: string;
  language: string; regClose: string; visibility: string; regAccess: string; championMemberId: string;
  repeat: boolean; perWeek: number; weekdays: number[]; endDate: string; fee: string | null;
};

export const VIS_COPY: Record<string, { label: string; desc: string }> = {
  PRIVATE: { label: 'Private', desc: 'No public discovery and no search indexing. Only invited participants.' },
  UNLISTED: { label: 'Unlisted', desc: 'Accessible by direct link only. No public discovery, no search indexing.' },
  PUBLIC: { label: 'Public', desc: 'Eligible for NOSTOPS discovery. Search indexing starts once your organisation is verified.' },
};

export const card = 'rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6';
export const label = 'block text-xs font-bold uppercase tracking-wider text-muted';
export const input = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
export const primaryBtn = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50';
export const ghostBtn = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition hover:bg-cream';

const STEPS = ['Organisation', 'Programme', 'Configure', 'Review', 'Publish'];

export function Stepper({ active }: { active: number }) {
  return (
    <ol className="mb-6 flex items-center gap-1 overflow-x-auto p-0 text-xs sm:gap-2 sm:text-sm">
      {STEPS.map((step, i) => {
        const done = i < active; const cur = i === active;
        return (
          <li key={step} className="flex items-center gap-1 sm:gap-2">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${cur ? 'bg-brand text-white' : done ? 'bg-brand-50 text-brand-700' : 'bg-cream text-muted'}`}>
              {done ? '✓' : i + 1}
            </span>
            <span className={`whitespace-nowrap font-semibold ${cur ? 'text-ink' : 'text-muted'}`}>{step}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-line sm:w-8" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Detail({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line bg-cream/50 p-3">
      <span aria-hidden className="text-lg">{icon}</span>
      <div><p className="text-sm font-bold text-ink">{title || '—'}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
    </div>
  );
}

export function EcoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-semibold text-ink">{v}</dd>
    </div>
  );
}

export function Row({ label: name, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-t border-line py-2.5 first:border-t-0">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{name}</p>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}
