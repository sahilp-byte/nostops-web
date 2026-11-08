'use client';
// B2.2 — Configure-step schedule: one session, or a repeating programme
// (once or twice a week on chosen weekdays until an end date the organiser picks).
import { WEEKDAYS, formatSessionDate, weekdayList } from '@/lib/org/schedule';
import { input, label, type WizardCfg } from './wizard-ui';

export default function ScheduleBlock({ cfg, plannedDates, recommendedFrequency, onRepeat, onPerWeek, onToggleDay, onEndDate }: {
  cfg: WizardCfg; plannedDates: string[]; recommendedFrequency?: string | null;
  onRepeat: (on: boolean) => void; onPerWeek: (n: number) => void; onToggleDay: (d: number) => void; onEndDate: (d: string) => void;
}) {
  const firstDate = plannedDates[0];
  const lastDate = plannedDates[plannedDates.length - 1];
  return (
    <div className="rounded-2xl border border-line bg-cream/50 p-4" data-testid="schedule-block">
      <p className={label}>How often?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${!cfg.repeat ? 'border-brand bg-white' : 'border-line bg-white/60'}`}>
          <input type="radio" name="repeat" checked={!cfg.repeat} onChange={() => onRepeat(false)} data-testid="schedule-single" className="mt-0.5" />
          <span><span className="font-semibold text-ink">One session</span><br /><span className="text-xs text-ink-soft">A single date</span></span>
        </label>
        <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${cfg.repeat ? 'border-brand bg-white' : 'border-line bg-white/60'}`}>
          <input type="radio" name="repeat" checked={cfg.repeat} onChange={() => onRepeat(true)} data-testid="schedule-recurring" className="mt-0.5" />
          <span><span className="font-semibold text-ink">Repeating programme</span><br /><span className="text-xs text-ink-soft">Once or twice a week, until an end date you pick</span></span>
        </label>
      </div>
      {cfg.repeat && (
        <div className="mt-3 grid gap-3">
          <div>
            <p className={label}>Sessions per week</p>
            <div className="mt-1 flex gap-2">
              {[1, 2].map((n) => (
                <button key={n} type="button" onClick={() => onPerWeek(n)} data-testid={`per-week-${n}`} aria-pressed={cfg.perWeek === n}
                  className={`min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-bold transition ${cfg.perWeek === n ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink hover:bg-cream'}`}>
                  {n === 1 ? 'Once a week' : 'Twice a week'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={label}>Session {cfg.perWeek === 2 ? 'days' : 'day'}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w, i) => {
                const on = cfg.weekdays.includes(i);
                return (
                  <button key={w} type="button" onClick={() => onToggleDay(i)} data-testid={`weekday-${i}`} aria-pressed={on}
                    className={`min-h-[44px] min-w-[48px] rounded-xl border px-2 text-xs font-bold transition ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:bg-cream'}`}>
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:max-w-[50%]">
            <label className={label}>End date *</label>
            <input type="date" className={input} value={cfg.endDate} min={cfg.date || undefined} onChange={(e) => onEndDate(e.target.value)} data-testid="cfg-end-date" />
          </div>
          {plannedDates.length > 0 && (
            <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink" data-testid="schedule-summary">
              🔁 {plannedDates.length} session{plannedDates.length === 1 ? '' : 's'} · every {weekdayList(cfg.weekdays)} · {formatSessionDate(firstDate)} – {formatSessionDate(lastDate)}
            </p>
          )}
          {recommendedFrequency && (
            <p className="text-[11px] text-muted">Council recommendation for this programme: {recommendedFrequency}.</p>
          )}
          <p className="text-[11px] text-muted">All session dates are created in one go. Participants register for each session separately, and capacity applies to each session.</p>
        </div>
      )}
    </div>
  );
}
