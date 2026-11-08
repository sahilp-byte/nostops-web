import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { getPulseOverview, getWelcomeThread, getDigest, getPulseCategories, actorFrom } from '@/lib/server/pulse';
import { STATUS_LABEL, fmtDate } from '@/lib/pulse-ui';
import WelcomePostCard from '@/components/app/admin/pulse/WelcomePostCard';
import ThemeDigest from '@/components/app/admin/pulse/ThemeDigest';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Teacher Pulse', robots: { index: false, follow: false } };

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className={`text-2xl font-black tabular-nums ${accent ? 'text-accent-600' : 'text-ink'}`}>{value}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

export default async function AdminPulsePage() {
  await requireAdminUser();
  const user = await getSessionUser();
  const actor = actorFrom(user!);
  const [data, welcome, digest, cats] = await Promise.all([
    getPulseOverview(actor),
    getWelcomeThread(actor),
    getDigest(actor),
    getPulseCategories(actor),
  ]);

  if (!data) {
    return <div className="mx-auto max-w-3xl"><p className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">Could not load Teacher Pulse insights right now.</p></div>;
  }

  const s = data.stats;
  const maxTrend = Math.max(1, ...data.trend.map((d: any) => d.threads + d.posts));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Community</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Teacher Pulse</h1>
          <p className="mt-1 text-ink-soft">Market-listening signals from teacher conversations. These are signals, not conclusions.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${data.config.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-cream text-muted'}`}>{STATUS_LABEL[data.config.status] || data.config.status}</span>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        <Link href="/app/admin/pulse/threads" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Discussions</Link>
        <Link href="/app/admin/pulse/reports" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Reports {s.open_reports > 0 && <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-black text-white">{s.open_reports}</span>}</Link>
        <Link href="/app/admin/pulse/members" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Members</Link>
        <Link href="/app/admin/pulse/categories" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Topics</Link>
        <Link href="/app/admin/pulse/settings" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Settings &amp; Export</Link>
      </div>

      {/* Theme Digest (AI) + Welcome post */}
      <ThemeDigest initial={digest} />
      <WelcomePostCard existing={welcome.thread ? { id: welcome.thread.id, title: welcome.thread.title } : null} categories={cats.categories.map((c) => ({ slug: c.slug, name: c.name }))} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Discussions" value={s.total_threads} />
        <Stat label="Replies" value={s.total_posts} />
        <Stat label="Participating teachers" value={s.active_members} />
        <Stat label="Open reports" value={s.open_reports} accent={s.open_reports > 0} />
        <Stat label="New teachers · 7d" value={s.new_members_7d} />
        <Stat label="Discussions · 7d" value={s.threads_7d} />
        <Stat label="Replies · 7d" value={s.posts_7d} />
        <Stat label="Suspended" value={s.suspended_members} accent={s.suspended_members > 0} />
      </div>

      {/* Participation trend */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Participation · last 14 days</h2>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {data.trend.map((d: any) => {
            const total = d.threads + d.posts;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.threads} discussions · ${d.posts} replies`}>
                <div className="w-full rounded-t bg-brand/70" style={{ height: `${Math.round((total / maxTrend) * 100)}%`, minHeight: total ? 4 : 0 }} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Bars show discussions + replies per day.</p>
      </section>

      {/* Most active topics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">Most active topics</h2>
          {data.by_category.length === 0 ? <p className="mt-2 text-sm text-muted">No activity yet.</p> : (
            <ul className="mt-3 space-y-2">
              {data.by_category.slice(0, 8).map((c: any) => (
                <li key={c.slug} className="flex items-center justify-between text-sm">
                  <Link href={`/app/admin/pulse/threads?category=${c.slug}`} className="font-semibold text-ink hover:text-brand-700">{c.name}</Link>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">Discussions with highest participation</h2>
          {data.top_threads.length === 0 ? <p className="mt-2 text-sm text-muted">No discussions yet.</p> : (
            <ul className="mt-3 space-y-2">
              {data.top_threads.map((t: any) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/app/admin/pulse/threads/${t.id}`} className="line-clamp-1 font-semibold text-ink hover:text-brand-700">{t.title}</Link>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{t.reply_count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted">Experiment window: {fmtDate(data.config.launch_date)} → {fmtDate(data.config.close_date)}. No fake posts or artificial engagement — every conversation is genuine.</p>
    </div>
  );
}
