import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { titleCase, fmtDate } from '@/lib/format';
import { getAllClaims, CLAIM_STATUS_LABEL } from '@/lib/server/venue-ownership';
import { getVenueReviewDetail, buildCompare, submissionsApiReady, STATUS_META, CLAIM_META } from '@/lib/server/venue-review';
import { getVerifiedMatcher, getLocalRevisions, getAiOnboardingAdminLocal, getGoogleGrantLocal } from '@/lib/server/venue-submissions-local';
import { grandfatheredPlaceId } from '@/lib/server/ai-assisted-venues';
import { venuePath } from '@/lib/venue-url';
import VenueAdminNotes from '@/components/app/admin/VenueAdminNotes';
import VenueEditForm from '@/components/app/admin/VenueEditForm';
import VenuePhotoReview from '@/components/app/admin/VenuePhotoReview';
import VenueVerifyButton from '@/components/app/admin/VenueVerifyButton';
import VenuePendingChanges from '@/components/app/admin/VenuePendingChanges';
import VenueVersionHistory from '@/components/app/admin/VenueVersionHistory';
import VenueAiOnboardingAdmin from '@/components/app/admin/VenueAiOnboardingAdmin';
import VenueGoogleGrantAdmin from '@/components/app/admin/VenueGoogleGrantAdmin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Review venue', robots: { index: false, follow: false } };

type Params = { params: Promise<{ id: string }> };

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function yn(v?: boolean): string | undefined {
  return v === undefined ? undefined : v ? 'Yes' : 'No';
}

const SUIT_LABEL: Record<'stated' | 'likely' | 'unknown', string> = { stated: 'Stated by submitter', likely: 'Likely (from suitability)', unknown: 'Not indicated' };

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted">{k}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{v}</dd>
    </div>
  );
}

function FlagList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-xs font-bold text-muted">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-1 list-none space-y-1 p-0">
          {items.map((it) => (
            <li key={it} className="flex gap-2 text-sm text-ink-soft"><span aria-hidden className="text-amber-500">•</span><span>{it}</span></li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-brand-700">{empty}</p>
      )}
    </div>
  );
}

// PROMPT 36 — one-glance fact.
function Glance({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{v}</dd>
    </div>
  );
}

export default async function VenueReviewDetailPage({ params }: Params) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'admin') redirect('/app');

  const { id } = await params;
  const [d, backendReady] = await Promise.all([getVenueReviewDetail(id), submissionsApiReady()]);
  if (!d) notFound();
  const isVerified = (await getVerifiedMatcher())({ id: d.id, venuePartnerId: d.publicVenueId, name: d.name, city: d.city });
  const isSubmission = d.source === 'submission';
  const [revisions, aiOnboarding] = isSubmission
    ? await Promise.all([getLocalRevisions(d.id).catch(() => []), getAiOnboardingAdminLocal(d.id).catch(() => null)])
    : [[], null];
  const grandfathered = !!grandfatheredPlaceId({ id: d.publicVenueId || d.id, name: d.name, city: d.city, state: d.state });
  // Google content switched on per venue by an admin — keyed by the PUBLIC venue id.
  const grantId = d.publicVenueId || d.id;
  const googleGrant = !grandfathered && !aiOnboarding?.active ? await getGoogleGrantLocal(grantId).catch(() => null) : null;
  const liveValues: Record<string, unknown> = {
    name: d.name, city: d.city, state: d.state, country: d.country, address: d.address, venue_type: d.venueType,
    capacity: d.capacity, best_for: d.bestFor, amenities: d.amenities, description: d.description,
    website_or_maps_url: d.website, google_business_url: d.googleBusinessUrl, photos: d.photos,
  };

  const { default: VenueReviewActions } = await import('@/components/app/admin/VenueReviewActions');
  const ownerClaims = (await getAllClaims()).filter((c) => c.venue_id === d.id || c.venue_id === d.publicVenueId);
  const compare = buildCompare(d);
  const e = d.enrichment;
  const loc = [d.city, d.state, d.country].filter(Boolean).join(', ');
  const meta = STATUS_META[d.status];

  const googlePhotos = e && d.photoRetreatId
    ? (e.photos || []).slice(0, 6).map((p) => `/bff/retreats/${d.photoRetreatId}/venue-photo?name=${encodeURIComponent(p.name)}&w=600`)
    : [];

  // Auto-verify signal — strong Google rating + photos on file suggest this
  // venue is a safe candidate to verify (admin still decides).
  const photoCount = (Array.isArray(e?.photos) ? e!.photos.length : 0) + d.photos.length;
  const autoSignals: string[] = [];
  if (typeof e?.rating === 'number' && e.rating >= 4.3) autoSignals.push(`Google rating ${e.rating.toFixed(1)}${e.reviewCount ? ` (${e.reviewCount} reviews)` : ''}`);
  if (photoCount >= 3) autoSignals.push(`${photoCount} photos on file`);
  const autoVerifySuggested = !isVerified && typeof e?.rating === 'number' && e.rating >= 4.3 && photoCount >= 3;

  const ai = d.aiInsight;
  const aiRows: { label: string; value?: string }[] = ai
    ? [
        { label: 'Feels like', value: ai.feelsLike },
        { label: 'Who enjoys it', value: ai.whoEnjoys },
        { label: 'Consistently praised', value: ai.praise },
        { label: 'Good to know', value: ai.know },
        { label: 'Venue strengths', value: ai.venueStrengths },
        { label: 'Practical', value: ai.practical },
      ].filter((r) => r.value)
    : [];

  // PROMPT 36 — one-glance decision summary.
  const suitShort = (s: 'stated' | 'likely' | 'unknown') => (s === 'stated' ? 'yes' : s === 'likely' ? 'likely' : 'unknown');
  const submittedBy = d.submitterName ? `${d.submitterName}${d.submitterType ? ` (${titleCase(d.submitterType)})` : ''}` : d.source === 'published' ? 'Directory venue' : 'Anonymous';
  const alreadyIn = d.source === 'published' ? 'Yes — published' : d.duplicates.length > 0 ? `Possible match (${d.duplicates.length})` : 'No match found';
  const criticalMissing = d.assessment.missing.some((m) => ['Name', 'City', 'Address / coordinates'].includes(m));
  const recommended = d.status === 'published' ? 'Live — monitor' : d.duplicates.length > 0 ? 'Check duplicate' : criticalMissing ? 'Request information' : d.quality.pct >= 70 ? 'Ready to approve' : 'Review details';

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/app/admin/venue-review" className="hover:text-brand-700">Venue Submissions</Link>
        <span className="px-1">/</span>
        <span className="text-ink-soft">{d.name}</span>
      </nav>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.badge}`}>{meta.label}</span>
            <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">{d.source === 'published' ? 'Directory venue' : 'Public submission'}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${d.status === 'published' ? 'bg-brand text-white' : d.status === 'hidden' ? 'bg-royal-50 text-royal' : 'bg-cream text-ink-soft'}`} data-testid="visibility">
              {d.status === 'published' ? '🌐 Publicly visible' : d.status === 'hidden' ? '🙈 Temporarily hidden' : '🔒 Not public'}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">{d.name}</h1>
          <p className="mt-1 text-sm text-muted">{loc || 'Location unknown'}{d.venueType ? ` · ${titleCase(d.venueType)}` : ''}</p>
        </div>
        {d.publicVenueId && (
          <Link href={venuePath({ id: d.publicVenueId, name: d.name, city: d.city })} className="shrink-0 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="view-public">View public page →</Link>
        )}
      </div>

      {/* Verification (trust badge on public pages) */}
      <div className="mt-4 rounded-2xl border border-brand/15 bg-white p-4">
        {autoVerifySuggested && (
          <div className="mb-3 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-2.5" data-testid="auto-verify-suggestion">
            <p className="text-xs font-black uppercase tracking-wide text-accent-600">✨ Suggested: verify this venue</p>
            <p className="mt-1 text-sm text-ink-soft">Strong trust signals detected — {autoSignals.join(' · ')}. Consider marking it verified.</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-ink">{isVerified ? '🛡️ NOSTOPS Verified Venue' : 'Verify this venue'}</p>
            <p className="mt-0.5 text-xs text-ink-soft">A verified venue earns a trust badge on its public directory page and on every retreat listing hosted there.</p>
          </div>
          <VenueVerifyButton id={d.id} name={d.name} city={d.city} venuePartnerId={d.publicVenueId} verified={isVerified} />
        </div>
      </div>

      {(isSubmission || grandfathered) && (
        <VenueAiOnboardingAdmin
          id={d.id}
          active={!!aiOnboarding?.active}
          placeId={aiOnboarding?.placeId ?? null}
          placeConfirmedBy={aiOnboarding?.placeConfirmedBy}
          purchasedAt={aiOnboarding?.purchasedAt}
          orders={aiOnboarding?.orders ?? []}
          grandfathered={grandfathered}
        />
      )}

      {!grandfathered && !aiOnboarding?.active && (
        <VenueGoogleGrantAdmin
          id={grantId}
          active={!!googleGrant?.active}
          placeId={googleGrant?.placeId ?? null}
          grantedBy={googleGrant?.grantedBy}
          defaultQuery={[d.name, d.city, d.state].filter(Boolean).join(' ')}
        />
      )}

      {d.pendingChanges && <VenuePendingChanges id={d.id} pending={d.pendingChanges} live={liveValues} />}

      {/* Review at a glance (PROMPT 36) — the 10 questions on one screen */}
      <section className="mt-6 rounded-2xl border border-brand/15 bg-brand-50/30 p-5" data-testid="glance">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-wide text-brand-700">Review at a glance</h2>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink" data-testid="glance-recommended">Suggested: {recommended}</span>
        </div>
        <dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Glance k="What is this?" v={`${d.assessment.classification}${loc ? ` · ${loc}` : ''}`} />
          <Glance k="Submitted by" v={submittedBy} />
          <Glance k="Already in NOSTOPS?" v={alreadyIn} />
          <Glance k="Credibility" v={`${d.quality.pct}% complete`} />
          <Glance k="Suitability" v={`Yoga ${suitShort(d.assessment.yogaSuitability)} · Retreat ${suitShort(d.assessment.retreatSuitability)}`} />
          <Glance k="Missing" v={d.assessment.missing.length ? `${d.assessment.missing.length} field${d.assessment.missing.length > 1 ? 's' : ''}` : 'None'} />
          <Glance k="Enrichment" v={e ? 'Google connected' : 'Not connected'} />
          <Glance k="NOSTOPS AI" v={d.aiInsight ? 'Interpretation available' : 'Not available'} />
          <Glance k="Status" v={meta.label} />
        </dl>
        <p className="mt-3 text-[11px] text-muted">A summary — full details, enrichment and moderation are below. The administrator makes the final decision.</p>
      </section>

      {/* Moderation actions */}
      <div className="mt-6">
        <VenueReviewActions id={d.id} status={d.status} source={d.source} backendReady={backendReady} />
      </div>

      {/* Potential duplicate (PROMPT 27) */}
      {d.duplicates.length > 0 && (
        <section className="mt-6" data-testid="duplicate-panel">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">⚠ Potential Duplicate Venue</span>
            <p className="mt-2 text-sm text-ink-soft">{d.duplicates.length} possible {d.duplicates.length === 1 ? 'match is' : 'matches are'} already in NOSTOPS. Review before publishing — nothing is merged automatically.</p>
            <ul className="mt-4 list-none space-y-3 p-0">
              {d.duplicates.map((m) => (
                <li key={m.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-ink">{m.name}</p>
                      <p className="text-xs text-muted">{[m.city, m.state].filter(Boolean).join(', ') || 'Location unknown'}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.reasons.map((r) => <span key={r} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{r}</span>)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link href={`/app/admin/venue-review/${m.id}`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-cream" data-testid="dupe-open">Open existing →</Link>
                      <Link href={venuePath({ id: m.id, name: m.name, city: m.city })} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream">Public ↗</Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">To flag this record, use <strong className="text-ink-soft">Mark duplicate</strong> in Moderation above. Merging is admin-confirmed only and activates with the backend — never automatic.</p>
          </div>
        </section>
      )}

      {/* NOSTOPS assessment — decision support (PROMPT 26) */}
      <section className="mt-8" data-testid="assessment">
        <h2 className="text-xl font-black tracking-tight text-ink">NOSTOPS assessment</h2>
        <p className="mt-1 text-sm text-muted">Decision support only — the administrator makes the final call.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-brand-700" data-testid="completeness">{d.assessment.completenessPct}%</span>
              <div>
                <p className="text-sm font-bold text-ink">Information completeness</p>
                <p className="text-xs text-muted">{d.assessment.missing.length ? `Missing: ${d.assessment.missing.join(', ')}` : 'All key fields present'}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Kv k="Classification" v={d.assessment.classification} />
              <Kv k="Location" v={d.assessment.location} />
              <Kv k="Yoga suitability" v={SUIT_LABEL[d.assessment.yogaSuitability]} />
              <Kv k="Retreat suitability" v={SUIT_LABEL[d.assessment.retreatSuitability]} />
            </dl>
            {d.assessment.facilities.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-muted">Facilities detected</p>
                <p className="mt-0.5 text-sm capitalize text-ink-soft">{d.assessment.facilities.join(', ')}</p>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <FlagList title="Data inconsistencies" items={d.assessment.inconsistencies} empty="None detected." />
            <FlagList title="Potential concerns" items={d.assessment.concerns} empty="None flagged." />
            <p className="mt-3 text-sm font-bold">
              {d.assessment.potentialDuplicate
                ? <span className="text-red-700">⚠ Potential duplicate detected — see above.</span>
                : <span className="text-brand-700">No duplicates detected.</span>}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">Generated by NOSTOPS from the submitted data{d.aiInsight ? ' and AI review interpretation' : ''}. Not a verification — always confirm independently.</p>
      </section>

      {/* Quality / completeness score — internal QC (PROMPT 35) */}
      <section className="mt-8" data-testid="quality">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-black tracking-tight text-ink">Quality &amp; completeness</h2>
            <p className="mt-1 text-sm text-muted">Internal quality-control indicator — a guide, not a substitute for human review.</p>
          </div>
          <p className="text-3xl font-black text-brand-700" data-testid="quality-score">{d.quality.pct}%<span className="ml-1 text-sm font-semibold text-muted">({d.quality.met}/{d.quality.total})</span></p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-cream">
          <div className="h-full rounded-full bg-brand" style={{ width: `${d.quality.pct}%` }} />
        </div>
        <ul className="mt-4 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {d.quality.indicators.map((ind) => (
            <li key={ind.label} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
              <span aria-hidden className={ind.met ? 'text-brand-700' : 'text-muted'}>{ind.met ? '✓' : '○'}</span>
              <span className={ind.met ? 'font-semibold text-ink' : 'text-muted'}>{ind.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Submitted vs Enriched (PROMPT 25) */}
      <section className="mt-8" data-testid="compare">
        <h2 className="text-xl font-black tracking-tight text-ink">Submitted vs enriched</h2>
        <p className="mt-1 text-sm text-muted">What the submitter provided, compared with what NOSTOPS retrieved from Google.</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-px bg-line text-sm">
            <div className="bg-cream p-3 text-xs font-black uppercase tracking-wide text-muted">Field</div>
            <div className="bg-cream p-3 text-xs font-black uppercase tracking-wide text-muted">Submitted</div>
            <div className="bg-cream p-3 text-xs font-black uppercase tracking-wide text-muted">Enriched / retrieved</div>
            {compare.map((row) => (
              <div key={row.label} className="contents">
                <div className="bg-white p-3 font-semibold text-ink">{row.label}</div>
                <div className="bg-white p-3 text-ink-soft">{row.submitted || <span className="text-muted">—</span>}</div>
                <div className="bg-white p-3 text-ink-soft">{row.enriched || <span className="text-muted">—</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Submitted / venue details (PROMPT 24) */}
      <section className="mt-8">
        <h2 className="text-xl font-black tracking-tight text-ink">Venue details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Venue type" value={d.venueType ? titleCase(d.venueType) : undefined} />
          <Field label="City" value={d.city} />
          <Field label="State" value={d.state} />
          <Field label="Country" value={d.country} />
          <Field label="Address" value={d.address} />
          <Field label="Website" value={d.website} />
          <Field label="Google Business listing" value={d.googleBusinessUrl} />
          <Field label="Capacity" value={typeof d.capacity === 'number' ? `${d.capacity} guests` : undefined} />
          <Field label="Indoor" value={yn(d.indoor)} />
          <Field label="Outdoor" value={yn(d.outdoor)} />
          <Field label="Yoga suitable" value={yn(d.yogaSuitable)} />
          <Field label="Retreat suitable" value={yn(d.retreatSuitable)} />
          <Field label="Sattvic kitchen" value={yn(d.sattvicCertified)} />
          <Field label="Open months" value={d.openMonths.length ? d.openMonths.map((m) => titleCase(m.replace(/_/g, ' '))).join(', ') : undefined} />
          <Field label="Weather" value={d.weatherBand} />
        </div>
        {d.description && (
          <div className="mt-3 rounded-xl border border-line bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-muted">Description</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{d.description}</p>
          </div>
        )}
        {(d.bestFor.length > 0 || d.amenities.length > 0 || d.gettingThere) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {d.bestFor.length > 0 && (
              <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-muted">Best for</p><p className="mt-1 text-sm text-ink-soft">{d.bestFor.map((f) => titleCase(f)).join(', ')}</p></div>
            )}
            {d.amenities.length > 0 && (
              <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-muted">Facilities</p><p className="mt-1 text-sm text-ink-soft">{d.amenities.map((f) => titleCase(f)).join(', ')}</p></div>
            )}
            {d.gettingThere && (
              <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-muted">Getting there</p><p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{d.gettingThere}</p></div>
            )}
          </div>
        )}
        {d.videoUrl && (
          <a href={d.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream">▶ Video tour</a>
        )}
      </section>

      {/* Edit before publication (PROMPT 31) */}
      <VenueEditForm
        id={d.id}
        backendReady={backendReady}
        initial={{ venue_name: d.name, venue_type: d.venueType, city: d.city, state: d.state, address: d.address, website_or_maps_url: d.website, google_business_url: d.googleBusinessUrl, description: d.description, capacity: typeof d.capacity === 'number' ? String(d.capacity) : '' }}
      />

      {isSubmission && <VenueVersionHistory id={d.id} revisions={revisions} />}

      {(d.ownerName || d.ownerEmail) && (
        <section className="mt-8" data-testid="venue-approved-owner">
          <h2 className="text-xl font-black tracking-tight text-ink">Approved owner</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={d.ownerName} />
            <Field label="Email" value={d.ownerEmail} />
            <Field label="Owner since" value={d.ownerClaimedAt ? fmtDate(d.ownerClaimedAt) : undefined} />
          </div>
        </section>
      )}

      {/* Original submitter (submissions only) */}
      <section className="mt-8">
        <h2 className="text-xl font-black tracking-tight text-ink">Original submitter</h2>
        {d.submitterName || d.submitterEmail ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={d.submitterName} />
            <Field label="Relationship" value={d.submitterType ? titleCase(d.submitterType) : undefined} />
            <Field label="Email" value={d.submitterEmail} />
            <Field label="Phone" value={d.submitterPhone} />
            <Field label="Submitted" value={d.submittedAt ? fmtDate(d.submittedAt) : undefined} />
            <Field label="Note" value={d.relationshipNote} />
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted">Directory venue — no public submitter on record.</p>
        )}
      </section>

      {/* Ownership claims (PROMPT 33) */}
      <section className="mt-8" data-testid="claims">
        <h2 className="text-xl font-black tracking-tight text-ink">Ownership claims</h2>
        <p className="mt-1 text-sm text-muted">A claim never grants management access on its own — it must be reviewed and verified.</p>
        {ownerClaims.length > 0 && (
          <ul className="mt-4 list-none space-y-3 p-0" data-testid="owner-claims-list">
            {ownerClaims.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-white p-4" data-testid={`venue-claim-${c.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-ink">{c.claimant_name || c.claimant_email || 'Unnamed claimant'}</p>
                    {c.relationship && <p className="text-xs text-muted">Relationship: {c.relationship}</p>}
                    <p className="text-xs text-muted">{c.claimant_email}{c.created_at ? ` · ${fmtDate(c.created_at)}` : ''}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">{CLAIM_STATUS_LABEL[c.status] || c.status}</span>
                </div>
                {c.decision_note && <p className="mt-2 text-sm text-ink-soft">{c.decision_note}</p>}
              </li>
            ))}
            <li><Link href="/app/admin/venue-claims" className="text-sm font-bold text-brand-700 hover:underline">Review claims in the claims queue →</Link></li>
          </ul>
        )}
        {d.claims.length > 0 ? (
          <ul className="mt-4 list-none space-y-3 p-0">
            {d.claims.map((c, i) => {
              const cm = CLAIM_META[c.status];
              return (
                <li key={c.id || i} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-ink">{c.claimant || 'Unnamed claimant'}</p>
                      {c.relationship && <p className="text-xs text-muted">Relationship: {c.relationship}</p>}
                      {c.contact && <p className="text-xs text-muted">{c.contact}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cm.badge}`}>{cm.label}</span>
                  </div>
                  {c.supporting && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{c.supporting}</p>}
                </li>
              );
            })}
          </ul>
        ) : ownerClaims.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted">No ownership claims on this venue.</p>
        ) : null}
      </section>

      {/* Photographs — admin can remove submitted photos before publishing */}
      {(d.photos.length > 0 || googlePhotos.length > 0) && (
        <VenuePhotoReview id={d.id} initial={d.photos} googlePhotos={googlePhotos} />
      )}

      {/* Enrichment (PROMPT 25) */}
      <section className="mt-8" data-testid="enrichment">
        <h2 className="text-xl font-black tracking-tight text-ink">Google &amp; NOSTOPS AI enrichment</h2>
        {e ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {typeof e.rating === 'number' && <span className="font-bold text-ink"><span aria-hidden className="text-amber-500">★</span> {e.rating.toFixed(1)}{e.reviewCount ? ` (${e.reviewCount})` : ''} on Google</span>}
                {e.mapsUri && <a href={e.mapsUri} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-brand-700 hover:underline">Google Maps ↗</a>}
                {e.websiteUri && <a href={e.websiteUri} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-brand-700 hover:underline">Website ↗</a>}
              </div>
              {e.address && <p className="mt-2 text-sm text-ink-soft">{e.address}</p>}
              {e.reviews && e.reviews.length > 0 && (
                <ul className="mt-4 space-y-3 border-t border-line pt-4">
                  {e.reviews.slice(0, 3).map((rv, i) => (
                    <li key={i} className="text-sm text-ink-soft">
                      {typeof rv.rating === 'number' && <span className="mr-1 font-bold text-amber-500">{'★'.repeat(Math.round(rv.rating))}</span>}
                      <span className="whitespace-pre-line">{rv.text?.slice(0, 400)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {aiRows.length > 0 && (
              <div className="rounded-2xl border border-brand/15 bg-brand-50/40 p-5" data-testid="ai-insight">
                <p className="text-xs font-black uppercase tracking-wide text-brand-700">NOSTOPS AI interpretation</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {aiRows.map((r) => (
                    <div key={r.label}>
                      <dt className="text-xs font-bold text-muted">{r.label}</dt>
                      <dd className="mt-0.5 text-sm text-ink-soft">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                {ai?.reviewSignals && ai.reviewSignals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ai.reviewSignals.map((s) => <span key={s} className="rounded-full border border-brand/20 bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-700">{s}</span>)}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted">AI interpretation of Google reviews — for reviewer context only, never a substitute for verification.</p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted" data-testid="enrichment-empty">
            Not connected to a Google place yet — Maps, reviews, photos and NOSTOPS AI analysis will appear here once this venue is linked to a Google listing.
          </p>
        )}
      </section>

      {/* Admin notes (PROMPT 29) — internal only */}
      <VenueAdminNotes id={d.id} notes={d.notes} backendReady={backendReady} />

      {/* Audit trail (PROMPT 30) */}
      <section className="mt-8" data-testid="audit">
        <h2 className="text-xl font-black tracking-tight text-ink">History</h2>
        {d.history.length > 0 ? (
          <ol className="mt-4 list-none space-y-0 p-0">
            {d.history.map((h, i) => (
              <li key={i} className="relative border-l-2 border-line pb-5 pl-5 last:pb-0">
                <span aria-hidden className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-brand" />
                <p className="text-sm font-bold text-ink">
                  {h.action}
                  {h.from && h.to ? <span className="font-normal text-muted"> · {h.from} → {h.to}</span> : h.to ? <span className="font-normal text-muted"> · {h.to}</span> : null}
                </p>
                <p className="text-xs text-muted">{[h.actor, h.at].filter(Boolean).join(' · ')}</p>
                {h.note && <p className="mt-0.5 text-sm text-ink-soft">{h.note}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-cream/50 p-4 text-sm text-muted">
            {d.source === 'published' ? 'This venue is live in the directory. A full action history will appear here for records processed through the moderation backend.' : 'Audit history will appear here once the moderation backend records events (submitted, reviewed, approved, etc.).'}
          </p>
        )}
      </section>

      <div className="mt-10">
        <Link href="/app/admin/venue-review" className="text-sm font-bold text-brand-700 hover:underline">← Back to queue</Link>
      </div>
    </div>
  );
}
