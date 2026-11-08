import { categoryMeta, type ItineraryItem } from '@/lib/retreat-content';

// PROMPT 10 — experiential itinerary timeline (not a spreadsheet). Sessions are
// grouped by day and shown on a vertical timeline with category icons, times,
// durations and the teacher/leader for each block.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayDate(startDate: string | undefined, day: number | undefined): string {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}/.test(startDate) || !day) return '';
  const d = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + (day - 1));
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function RetreatItineraryTimeline({ items, startDate }: { items: ItineraryItem[]; startDate?: string }) {
  if (!items.length) return null;

  // Group by day (items with no day fall under a single "Flow" group at the end).
  const byDay = new Map<number, ItineraryItem[]>();
  const noDay: ItineraryItem[] = [];
  for (const it of items) {
    if (typeof it.day === 'number') {
      if (!byDay.has(it.day)) byDay.set(it.day, []);
      byDay.get(it.day)!.push(it);
    } else noDay.push(it);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  const renderItems = (list: ItineraryItem[]) => (
    <ol className="relative ml-1 list-none space-y-4 border-l-2 border-brand/20 p-0 pl-5">
      {list.map((it, i) => {
        const meta = categoryMeta(it.category);
        return (
          <li key={i} className="relative">
            <span aria-hidden className="absolute -left-[26px] top-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-brand/30 bg-white text-xs">{meta?.icon || '•'}</span>
            <div className="flex flex-wrap items-baseline gap-x-3">
              {it.time && <time className="text-sm font-black text-brand-700">{it.time}</time>}
              <p className="font-black text-ink">{it.activity}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {[meta?.label, typeof it.durationMin === 'number' && it.durationMin > 0 ? `${it.durationMin} min` : '', it.leader ? `with ${it.leader}` : ''].filter(Boolean).join(' · ')}
            </p>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="space-y-6" data-testid="itinerary-timeline">
      {days.map((d) => (
        <div key={d} className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-4 flex items-baseline gap-3">
            <span className="rounded-lg bg-brand px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white">Day {d}</span>
            {dayDate(startDate, d) && <span className="text-sm font-semibold text-muted">{dayDate(startDate, d)}</span>}
          </div>
          {renderItems(byDay.get(d)!)}
        </div>
      ))}
      {noDay.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-4"><span className="rounded-lg bg-brand px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white">Daily flow</span></div>
          {renderItems(noDay)}
        </div>
      )}
      <p className="text-[11px] text-muted">Times are indicative and may shift with the group’s rhythm and the weather.</p>
    </div>
  );
}
