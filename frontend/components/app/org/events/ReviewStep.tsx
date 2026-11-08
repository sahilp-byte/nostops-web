'use client';
// Step ④ Review — read-only summary of the draft before publishing.
import { formatSessionDate, weekdayList } from '@/lib/org/schedule';
import { card, label, primaryBtn, ghostBtn, Detail, VIS_COPY, type Prog, type WizardCfg } from './wizard-ui';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';

export default function ReviewStep({ cfg, orgName, logoUrl, programme, plannedDates, championName, overGroup, feeLabel, busy, onBack, onPublish }: {
  cfg: WizardCfg; orgName: string; logoUrl: string; programme: Prog; plannedDates: string[];
  championName?: string | null; overGroup: boolean; feeLabel: string; busy: boolean;
  onBack: () => void; onPublish: () => void;
}) {
  const times = [cfg.startTime, cfg.endTime].filter(Boolean).join(' – ');
  const tzName = cfg.timezone ? cfg.timezone.replace('_', ' ') : '';
  const tz = tzName ? ` · ${tzName}` : '';
  return (
    <div>
      <h2 className="text-xl font-black tracking-tight text-ink">Review your event</h2>
      <p className="mt-1 text-sm text-ink-soft">Please check the details before publishing. You can go back and edit if required.</p>
      <div className={`${card} mt-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-ink">{cfg.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">Organised by {orgName}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote logo URL, no next/image loader */}
          {logoUrl && <img src={logoUrl} alt="logo" className="h-12 w-12 shrink-0 rounded-lg object-contain" />}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">✓ Council-Curated Programme</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-ink-soft">{programme.taxonomy_label}</span>
          {programme.version && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">Council {programme.version}</span>}
          <ProgrammeDevNote programme={programme} />
        </div>

        {/* Council Programme vs Organisation Event — explicit */}
        <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-cream/50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Council Programme</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{programme.name}</p>
            {programme.council_attribution && <p className="mt-0.5 text-xs text-muted">{programme.council_attribution}{programme.version ? ` · ${programme.version}` : ''}</p>}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Organisation Event</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{cfg.title}</p>
            <p className="mt-0.5 text-xs text-muted">{orgName}{cfg.date ? ` · ${formatSessionDate(cfg.date)}` : ''}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cfg.repeat && plannedDates.length > 0 ? (
            <Detail icon="🔁" title={`${plannedDates.length} sessions · every ${weekdayList(cfg.weekdays)}`}
              sub={`${formatSessionDate(plannedDates[0])} – ${formatSessionDate(plannedDates[plannedDates.length - 1])}${times ? ` · ${times}` : ''}${tz}`} />
          ) : (
            <Detail icon="📅" title={cfg.date} sub={[times, tzName].filter(Boolean).join(' · ')} />
          )}
          <Detail icon="📍" title={cfg.venue || cfg.city} sub={cfg.venueType === 'EXTERNAL_VENUE' ? `External venue · ${cfg.city}${cfg.externalVenueCost ? ` · ₹${cfg.externalVenueCost}` : ''}` : `Community Space Contribution · ${cfg.city}`} />
          <Detail icon="👥" title={cfg.capacity ? `${cfg.capacity} participants${cfg.repeat ? ' per session' : ''}` : 'Open capacity'} sub={programme.recommended_group_size ? `Recommended: ${programme.recommended_group_size}` : ''} />
          <Detail icon="⏱" title={`${cfg.duration} minutes`} sub={cfg.language} />
          <Detail icon="💳" title={`${feeLabel} per participant${cfg.repeat ? ', per session' : ''}`} sub="Paid online by each participant when they register" />
          <Detail icon="🔒" title={VIS_COPY[cfg.visibility]?.label || cfg.visibility} sub="Event Visibility" />
          {cfg.regClose && !cfg.repeat && <Detail icon="📝" title={cfg.regClose} sub="Registration closes" />}
          {championName && <Detail icon="⭐" title={championName} sub="Programme Champion" />}
        </div>
        {overGroup && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" data-testid="capacity-warning-review" role="status">
            ⚠ Capacity of {cfg.capacity} is above the recommended group size ({programme.recommended_group_size}). You can still publish.
          </p>
        )}
        {cfg.repeat && (
          <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700" data-testid="review-per-session-note">
            Participants register for each session separately. One NOSTOPS teacher is matched for the whole programme.
          </p>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <p className={label}>About the Programme (Council content · cannot be edited)</p>
          <p className="mt-1 text-sm text-ink-soft">{programme.essence}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <button type="button" className={ghostBtn} onClick={onBack} data-testid="review-back">← Back</button>
        <button type="button" className={primaryBtn} disabled={busy} onClick={onPublish} data-testid="publish-btn">{busy ? 'Publishing…' : 'Publish Event →'}</button>
      </div>
    </div>
  );
}
