// Shared cohort sections used by components/org/CohortLanding.tsx on the three
// /for-organisations/* cohort pages. Server components (no client hooks):
// "See NOSTOPS in action" (demonstration organisations + their public
// demonstration events) and the cohort FAQ.
import Link from 'next/link';
import type { CohortCopy } from '@/lib/org/cohort-copy';
import type { ShowcaseCohort } from '@/lib/server/institutional';

const LC_CHIP: Record<string, string> = {
  PUBLISHED: 'bg-brand-50 text-brand-700',
  LIVE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-cream text-ink-soft',
  EVERGREEN: 'bg-accent/10 text-accent-600',
};
const LC_LABEL: Record<string, string> = {
  PUBLISHED: 'Upcoming', LIVE: '● Live', COMPLETED: 'Completed', EVERGREEN: 'Evergreen',
};

// "See NOSTOPS in action": the demonstration organisations + their public
// demonstration events. Each organisation card carries id="demo-{slug}" so other
// sections can link to it.
export function CohortInAction({ cohort }: { cohort: ShowcaseCohort | null }) {
  const orgs = cohort?.organisations ?? [];
  return (
    <section id="see-in-action" className="bg-cream">
      <div className="container-x py-12 sm:py-16">
        <div className="max-w-2xl">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">See NOSTOPS in action</span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Example organisations & their programmes</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            These are <strong>illustrative examples</strong>, not real organisations. NOSTOPS created them to show how the model works end to end — organisation → Council-curated programme → verified teacher → public event → registration.
          </p>
        </div>

        {orgs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
            Demonstration programmes are being prepared. Please check back shortly.
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {orgs.map((o) => (
              <div key={o.organisation_id} id={`demo-${o.slug}`} data-testid={`showcase-org-${o.organisation_id}`}
                className="scroll-mt-32 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote logo URL, no next/image loader */}
                    {o.logo_url ? <img src={o.logo_url} alt={`${o.name} logo`} className="h-full w-full object-contain p-1.5" /> : <span className="text-2xl">🏢</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black tracking-tight text-ink">{o.short_name || o.name}</h3>
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700" data-testid="showcase-illustrative">Illustrative example</span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-muted">
                      {[o.city, o.industry, o.org_size].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft line-clamp-4">{o.description}</p>
                    {o.website && (
                      <p className="mt-2 text-xs text-muted">{o.website.replace(/^https?:\/\//, '')}</p>
                    )}
                  </div>
                </div>

                {/* Events for this org */}
                <div className="border-t border-line bg-cream/40 p-5 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {o.events.map((e) => (e.illustrative_only || !e.slug) ? (
                      <div key={`${o.organisation_id}-${e.title}`} data-testid="showcase-illustrative-event"
                        className="flex flex-col rounded-xl border border-dashed border-amber-300 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{e.taxonomy_label}</span>
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Illustrative example · not a real session</span>
                        </div>
                        <p className="mt-2 text-sm font-extrabold leading-snug text-ink">{e.title}</p>
                        <p className="mt-1 text-xs text-muted">{e.programme_name}</p>
                        <dl className="mt-3 space-y-1 text-xs text-ink-soft">
                          <div className="flex gap-1.5"><dt aria-hidden>📍</dt><dd>{e.city || '—'}</dd></div>
                          <div className="flex gap-1.5"><dt aria-hidden>📝</dt><dd>Not open for booking</dd></div>
                          <div className="flex gap-1.5"><dt aria-hidden>🧘</dt><dd>No teacher assigned. A Special Needs programme is offered only to a teacher whose adaptive-practice competence NOSTOPS has verified.</dd></div>
                        </dl>
                      </div>
                    ) : (
                      <div key={e.slug} data-testid={`showcase-event-${e.slug}`} className="flex flex-col rounded-xl border border-line bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{e.taxonomy_label}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${LC_CHIP[e.lifecycle] || 'bg-cream text-muted'}`}>{LC_LABEL[e.lifecycle] || e.lifecycle}</span>
                        </div>
                        <p className="mt-2 text-sm font-extrabold leading-snug text-ink">{e.title}</p>
                        <p className="mt-1 text-xs text-muted">{e.programme_name}</p>
                        <dl className="mt-3 space-y-1 text-xs text-ink-soft">
                          <div className="flex gap-1.5"><dt aria-hidden>📍</dt><dd>{e.city || '—'}</dd></div>
                          <div className="flex gap-1.5"><dt aria-hidden>📅</dt><dd>{e.event_date || 'Date to be announced'}</dd></div>
                          {e.teacher_name && (
                            <div className="flex gap-1.5"><dt aria-hidden>🧘</dt><dd>{e.teacher_name}</dd></div>
                          )}
                          {e.registration_access_label && (
                            <div className="flex gap-1.5"><dt aria-hidden>📝</dt><dd>{e.registration_access_label}</dd></div>
                          )}
                        </dl>
                        <Link href={`/events/${e.slug}`} data-testid={`showcase-view-${e.slug}`}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
                          View Event →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function CohortFaq({ copy }: { copy: CohortCopy }) {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-line bg-white" data-testid="cohort-faq">
      <div className="container-x py-14 sm:py-16">
        <h2 className="text-center text-2xl font-black tracking-tight text-ink sm:text-3xl">Questions organisations ask</h2>
        <div className="mx-auto mt-6 max-w-3xl space-y-3">
          {copy.faqs.map((f) => (
            <div key={f.q} className="rounded-2xl border border-line bg-white p-5">
              <h3 className="text-sm font-extrabold text-ink">{f.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
