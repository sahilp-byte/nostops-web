import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getIncomingEnquiries, getEnquiryWithViewer } from '@/lib/server/spaces';
import { ENQUIRY_STATUS, FOCUS_AREAS, GROUP_TYPES, WEEK_DAYS, fmtTime } from '@/lib/spaces';
import OwnerEnquiryHeader from '@/components/spaces/OwnerEnquiryHeader';
import { SpStat, type SpIconName } from '@/components/spaces/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Venue Owner · Enquiries', robots: { index: false, follow: false } };

const TABS: [string, string][] = [['all', 'All Requests'], ['new', 'New'], ['in_discussion', 'In Discussion'], ['closed', 'Closed']];
const fd = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const range = (a?: string, b?: string) => [fd(a), fd(b)].filter(Boolean).join(' – ');

type SP = { space?: string; status?: string; from?: string; to?: string; sel?: string };

// Venue Owner Enquiries Dashboard (Phase 4 · screen 2). Only sent enquiries for the caller's approved Spaces.
export default async function IncomingEnquiriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/app/spaces/incoming');
  const admin = user.role === 'admin';
  const sp = await searchParams;
  const status = TABS.some(([k]) => k === sp.status) ? (sp.status as string) : 'all';
  const data = await getIncomingEnquiries({ space: sp.space, status, from: sp.from, to: sp.to });
  const items = data?.items || [];
  const selId = items.some((x) => x.id === sp.sel) ? sp.sel! : items[0]?.id;
  const sel = selId ? (await getEnquiryWithViewer(selId))?.enquiry : null;
  const qs = (o: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ space: sp.space, status, from: sp.from, to: sp.to, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/app/spaces/incoming?${p.toString()}`;
  };
  const c = data?.counts || { total: 0, new: 0, in_discussion: 0, accepted: 0, closed: 0, discussing: 0 };
  const tabCount: Record<string, number> = { all: c.total, new: c.new, in_discussion: c.in_discussion, closed: c.closed };
  const stats: { icon: SpIconName; n: number; l: string; tone: 'peach' | 'green' | 'lavender' | 'red' }[] = [
    { icon: 'mail', n: c.total, l: 'Total Enquiries', tone: 'peach' }, { icon: 'calendar', n: c.new, l: 'New Enquiries', tone: 'peach' },
    { icon: 'clock', n: c.discussing, l: 'In Discussion', tone: 'lavender' }, { icon: 'check', n: c.accepted, l: 'Accepted in principle', tone: 'green' },
    { icon: 'info', n: c.closed, l: 'Closed', tone: 'red' },
  ];

  return (
    <div className="mx-auto max-w-[1400px]" data-testid="owner-enquiries-page">
      <OwnerEnquiryHeader title={admin ? 'Space Enquiries — Admin View' : 'Venue Owner Dashboard'} subtitle={admin ? 'All enquiries sent to approved NOSTOPS Spaces' : 'Enquiries & Programme Requests'} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="owner-enq-stats">
        {stats.map((s) => (
          <SpStat key={s.l} icon={s.icon} tone={s.tone} label={s.l} value={<span className="tabular-nums" data-testid={`stat-${s.l.toLowerCase().replace(/\s+/g, '-')}`}>{s.n}</span>} />
        ))}
      </div>

      {!data ? (
        <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm text-ink-soft">Enquiries couldn&apos;t be loaded. Please try again.</p>
      ) : data.spaces.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-white p-8 text-center" data-testid="owner-enq-no-spaces">
          <p className="font-black text-ink">You don&apos;t have an approved Space yet</p>
          <p className="mt-1 text-sm text-ink-soft">Enquiries appear here once a Space you listed is approved by NOSTOPS.</p>
          <Link href="/app/spaces" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-black text-white">My Spaces</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_440px]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-3xl font-black text-ink">Enquiries &amp; Programme Requests</h2>
                <p className="mt-1 text-ink-soft">{admin ? 'Requests from yoga teachers to approved Spaces, across all venue owners.' : 'Requests from yoga teachers to use your Space for classes, workshops or programmes.'}</p>
              </div>
              <form method="get" action="/app/spaces/incoming" className="flex items-center gap-2" data-testid="owner-enq-space-form">
                <input type="hidden" name="status" value={status} />
                {sp.from && <input type="hidden" name="from" value={sp.from} />}
                {sp.to && <input type="hidden" name="to" value={sp.to} />}
                <label className="text-sm font-black text-ink" htmlFor="space-sel">{admin ? 'Space' : 'My Space'}</label>
                <select id="space-sel" name="space" defaultValue={sp.space || ''} className="min-h-[44px] rounded-xl border border-line bg-white px-3 text-sm" data-testid="owner-enq-space">
                  <option value="">All My Spaces</option>
                  {data.spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="submit" className="min-h-[44px] rounded-xl border border-brand px-3 text-sm font-black text-brand-700" data-testid="owner-enq-space-show">Show</button>
              </form>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-white">
              <div className="flex flex-wrap gap-1 border-b border-line p-2" data-testid="owner-enq-tabs">
                {TABS.map(([k, l]) => (
                  <Link key={k} href={qs({ status: k, sel: undefined })} className={`min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold ${k === status ? "bg-[#FDE7CC] text-[#7A2E05] shadow-sm" : "text-ink"}`} data-testid={`owner-enq-tab-${k}`}>
                    {l} ({tabCount[k]})
                  </Link>
                ))}
              </div>
              <form method="get" action="/app/spaces/incoming" className="flex flex-wrap items-end gap-3 border-b border-line p-3" data-testid="owner-enq-date-form">
                <input type="hidden" name="status" value={status} />
                {sp.space && <input type="hidden" name="space" value={sp.space} />}
                <span className="self-center text-sm font-black text-ink">Filter by start date</span>
                <label className="text-xs font-bold text-ink-soft">From<input type="date" name="from" defaultValue={sp.from} className="mt-1 block min-h-[40px] rounded-lg border border-line px-2 text-sm" data-testid="owner-enq-from" /></label>
                <label className="text-xs font-bold text-ink-soft">To<input type="date" name="to" defaultValue={sp.to} className="mt-1 block min-h-[40px] rounded-lg border border-line px-2 text-sm" data-testid="owner-enq-to" /></label>
                <button type="submit" className="min-h-[40px] rounded-lg border border-brand px-3 text-sm font-black text-brand-700" data-testid="owner-enq-apply">Apply</button>
                <Link href="/app/spaces/incoming" className="min-h-[40px] self-center px-2 text-sm font-black text-brand-700 underline" data-testid="owner-enq-reset">Reset</Link>
              </form>
              <div className="hidden grid-cols-[1.1fr_1.3fr_160px_24px] gap-3 px-4 py-3 text-sm font-black text-ink md:grid"><span>Request Details</span><span>Programme &amp; Dates</span><span>Status</span><span /></div>
              {items.length === 0 ? (
                <p className="p-6 text-sm text-ink-soft" data-testid="owner-enq-empty">No enquiries match these filters.</p>
              ) : (
                <ul data-testid="owner-enq-list">
                  {items.map((e) => {
                    const st = ENQUIRY_STATUS[e.status] || ENQUIRY_STATUS.sent;
                    return (
                      <li key={e.id}>
                        <Link href={qs({ sel: e.id })} scroll={false} className={`grid gap-3 border-t border-line px-4 py-3 md:grid-cols-[1.1fr_1.3fr_160px_24px] md:items-center ${e.id === selId ? 'bg-orange-50' : 'hover:bg-cream/50'}`} data-testid="owner-enq-row">
                          <div className="flex items-center gap-3">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 font-black text-brand-700">{(e.teacher_name || '?').slice(0, 1)}</span>
                            <div><p className="font-black text-ink">{e.teacher_name}</p><p className="text-xs text-ink-soft">Yoga Teacher · {e.space_name}</p></div>
                          </div>
                          <div><p className="font-black text-ink">{e.programme_title}</p><p className="text-xs text-ink-soft">📅 {range(e.start_date, e.end_date)}</p><p className="text-xs text-ink-soft">👥 {e.participants} participants</p></div>
                          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${st.tone}`} data-testid="owner-enq-row-status">{st.label}</span>
                          <span className="hidden text-xl text-ink md:block">›</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-line bg-white p-5" data-testid="owner-enq-selected">
            <h2 className="font-serif text-2xl font-black text-ink">✉️ Enquiry Details</h2>
            {!sel ? <p className="mt-3 text-sm text-ink-soft">Select an enquiry to see its details.</p> : (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-xl font-black text-brand-700">{(sel.teacher_name || '?').slice(0, 1)}</span>
                  <div><p className="text-lg font-black text-ink" data-testid="sel-teacher">{sel.teacher_name}</p><p className="text-sm text-ink-soft">Yoga Teacher · NOSTOPS</p></div>
                  <span className={`ml-auto rounded-full px-3 py-1 text-xs font-black ${(ENQUIRY_STATUS[sel.status] || ENQUIRY_STATUS.sent).tone}`}>{(ENQUIRY_STATUS[sel.status] || ENQUIRY_STATUS.sent).label}</span>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  {[
                    ['🧘 Programme', sel.programme_title], ['🗓️ Preferred Dates', range(sel.start_date, sel.end_date)],
                    ['⏰ Timings', sel.days?.length ? `${WEEK_DAYS.filter(([k]) => sel.days?.includes(k)).map(([, v]) => v).join(', ')}: ${fmtTime(sel.time_from)} – ${fmtTime(sel.time_to)}` : ''],
                    ['👥 Expected Participants', String(sel.participants || '')], ['👪 Group Type', GROUP_TYPES[sel.group_type || '']],
                    ['🎯 Focus Areas', (sel.focus_areas || []).map((f) => FOCUS_AREAS[f]).join(' · ')], ['🏠 Space', sel.space_name], ['🔖 Reference', sel.ref],
                  ].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-black text-ink">{k}</dt><dd className="text-ink-soft">{v}</dd></div>)}
                </dl>
                {sel.additional_info && (
                  <div className="mt-4 rounded-2xl border border-line bg-cream/60 p-3"><p className="text-sm font-black text-ink">💬 Message from Teacher</p><p className="mt-1 text-sm italic text-ink-soft">“{sel.additional_info}”</p></div>
                )}
                <Link href={`/app/spaces/incoming/${sel.id}`} className="mt-4 flex min-h-[52px] items-center justify-center rounded-xl bg-accent text-base font-black text-white" data-testid="owner-enq-view">{sel.status === 'declined' ? 'View Enquiry' : 'View Enquiry & Respond'}</Link>
                <p className="mt-2 text-xs text-muted">An enquiry is not a booking. A programme proceeds only after mutual agreement.</p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
