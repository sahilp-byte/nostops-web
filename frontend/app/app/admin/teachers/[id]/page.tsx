import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getAdminTeacherDetail, getTeacherStatusHistory } from '@/lib/server/admin-teachers';
import { getAuthorFlag } from '@/lib/server/voices';
import AdminAuthorToggle from '@/components/app/admin/AdminAuthorToggle';
import { VERIFICATION_META, EMPANELMENT_META, levelLabelFull, levelColor } from '@/lib/admin-teacher-shared';
import AdminTeacherStatusControls from '@/components/app/admin/AdminTeacherStatusControls';
import { titleCase } from '@/lib/format';
import { deriveTeacherStatus } from '@/lib/teacher-status';
import { summarizeFeatureAccess, type AccessContext } from '@/lib/teacher-access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Teacher Review', robots: { index: false, follow: false } };

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}
function fmtDateTimeIST(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  return `${date}, ${time} IST`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children ?? <span className="text-muted">—</span>}</div>
    </div>
  );
}
function Chips({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((x) => <span key={x} className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-ink-soft">{titleCase(x)}</span>)}
    </span>
  );
}
function Card({ title, form, children }: { title: string; form?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        {form && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-700">{form}</span>}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function Flag({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{on ? 'Yes' : 'No'}</span>
    </div>
  );
}

export default async function AdminTeacherReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'admin') redirect('/app');

  const { id } = await params;
  const detail = await getAdminTeacherDetail(decodeURIComponent(id));
  if (!detail) notFound();

  const history = await getTeacherStatusHistory(decodeURIComponent(id));
  const authorEnabled = await getAuthorFlag(decodeURIComponent(id));

  const { row, submitted, admin } = detail;
  const lvlColor = levelColor(row.level);
  const offers = [
    submitted.offers.group && 'Group classes',
    submitted.offers.privateSessions && 'Private sessions',
    submitted.offers.online && 'Online',
    submitted.offers.corporate && 'Corporate',
  ].filter(Boolean) as string[];

  // ACCESS PRIVILEGES (Prompt 27) — built from the SAME authoritative record the
  // teacher's own gate uses, then run through the central engine. kyc_paid is not
  // exposed in bulk, so (per the directory convention) kyc_verified proxies it.
  // Host-eligibility is a per-logged-in-teacher backend call and cannot be queried
  // for an arbitrary teacher here, so hosting reflects the LEVEL catalogue (L2+);
  // the backend host-eligibility check remains the final authority at runtime.
  const accessStatus = deriveTeacherStatus({
    kycVerified: admin.kycVerified,
    kycPaid: admin.kycVerified,
    panVerified: admin.panVerified,
    bankVerified: false,
    isEmpanelled: admin.isEmpanelled,
    tier: admin.tier ?? undefined,
    badgePrimary: admin.badgePrimary ?? undefined,
    isVerified: admin.isVerifiedFlag,
    verificationStatusRaw: row.verification,
  });
  const accessCtx: AccessContext = {
    authenticated: true,
    role: 'teacher',
    onboarded: true,
    status: accessStatus,
    hostEligible: accessStatus.level !== 'none' && accessStatus.level >= 2,
  };
  const accessSummary = summarizeFeatureAccess(accessCtx);
  const accessible = accessSummary.filter((f) => f.allowed);
  const locked = accessSummary.filter((f) => !f.allowed);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/admin/teachers" className="text-sm font-bold text-brand-700 hover:underline">← Back to directory</Link>

      {/* Header */}
      <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center">
        {submitted.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={submitted.avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand/10 text-2xl font-black text-brand-700">{row.name.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight text-ink">{row.name}</h1>
          <p className="text-sm text-muted">{[submitted.title, submitted.city].filter(Boolean).join(' · ') || 'Teacher'}</p>
          <p className="mt-1 text-xs text-muted"><code className="rounded bg-cream px-1.5 py-0.5">{row.teacherId}</code>{row.handle ? ` · @${row.handle}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${VERIFICATION_META[row.verification].badge}`}>{VERIFICATION_META[row.verification].label}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${EMPANELMENT_META[row.empanelment].badge}`}>{EMPANELMENT_META[row.empanelment].label}</span>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: lvlColor + '1a', color: lvlColor }}>{levelLabelFull(row.level)}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* TEACHER-SUBMITTED INFORMATION */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <span aria-hidden className="text-lg">📝</span>
            <h2 className="text-sm font-black uppercase tracking-wider text-ink">Teacher-submitted information</h2>
          </div>

          {!row.inDirectory && (
            <div className="mb-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              This teacher&apos;s public profile is hidden or incomplete, so only limited submitted information is available.
            </div>
          )}

          <div className="space-y-5">
            <Card title="Profile &amp; identity" form="Form 1">
              <Field label="Full name">{row.name}</Field>
              <Field label="Handle">{submitted.handle ? `@${submitted.handle}` : null}</Field>
              <Field label="Title">{submitted.title}</Field>
              <Field label="Experience">{submitted.experienceYears != null ? `${submitted.experienceYears} yrs` : null}</Field>
              <Field label="Location">{[submitted.city, submitted.state, submitted.country].filter(Boolean).join(', ') || null}</Field>
              <Field label="Languages"><Chips items={submitted.languages} /></Field>
            </Card>

            <Card title="Teaching" form="Form 2">
              <Field label="Styles"><Chips items={submitted.styles} /></Field>
              <Field label="Specializations"><Chips items={submitted.specializations} /></Field>
              <Field label="Yoga dimensions"><Chips items={submitted.yogaDimensions} /></Field>
              <Field label="Offers">{offers.length ? <Chips items={offers} /> : <span className="text-muted">—</span>}</Field>
              <Field label="Premium 1:1">
                {submitted.premiumSession
                  ? `${submitted.premiumSession.enabled ? 'Enabled' : 'Disabled'}${submitted.premiumSession.rateInr ? ` · ₹${submitted.premiumSession.rateInr}` : ''}${submitted.premiumSession.durationMin ? ` · ${submitted.premiumSession.durationMin} min` : ''}`
                  : null}
              </Field>
            </Card>

            <Card title="Lineage &amp; parampara" form="Form 3">
              <Field label="Parampara">{submitted.parampara ? titleCase(submitted.parampara) : null}</Field>
              <Field label="All paramparas"><Chips items={submitted.paramparas} /></Field>
              <Field label="Root guru">{submitted.rootGuruName}</Field>
              <Field label="Root guru location">{submitted.rootGuruLocation}</Field>
              <div className="sm:col-span-2">
                <Field label="Lineage declaration">{submitted.lineageDeclaration}</Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Lineage path">{submitted.lineagePath.length ? submitted.lineagePath.join(' → ') : null}</Field>
              </div>
            </Card>

            <Card title="Media" form="Form 4">
              <Field label="Profile photo">{submitted.avatarUrl ? 'Uploaded' : null}</Field>
              <Field label="Intro video">
                {submitted.videoIntro
                  ? submitted.videoIntro.secureUrl
                    ? <a href={submitted.videoIntro.secureUrl} target="_blank" rel="noreferrer" className="font-bold text-brand-700 hover:underline">View video</a>
                    : `Status: ${submitted.videoIntro.status || 'pending'}`
                  : (submitted.sampleVideoUrl ? <a href={submitted.sampleVideoUrl} target="_blank" rel="noreferrer" className="font-bold text-brand-700 hover:underline">View sample</a> : null)}
              </Field>
            </Card>

            <Card title="Social &amp; links" form="Form 5">
              <Field label="Instagram">{submitted.social.instagram}</Field>
              <Field label="YouTube">{submitted.social.youtube}</Field>
              <Field label="LinkedIn">{submitted.social.linkedin}</Field>
              <Field label="Website">{submitted.social.website}</Field>
            </Card>
          </div>
        </div>

        {/* NOSTOPS ADMINISTRATIVE STATUS */}
        <aside className="lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span aria-hidden className="text-lg">🛡️</span>
            <h2 className="text-sm font-black uppercase tracking-wider text-ink">NOSTOPS administrative status</h2>
          </div>
          <div className="space-y-4 rounded-2xl border border-line bg-cream/40 p-5" data-testid="admin-status-panel">
            <p className="text-xs text-muted">System of record. Teachers cannot self-assign these — set here by NOSTOPS administrators.</p>

            <AdminTeacherStatusControls
              teacherId={row.teacherId}
              initialVerification={row.verification}
              initialEmpanelment={row.empanelment}
              initialLevel={row.level}
            />

            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">KYC breakdown</p>
              <Flag label="Identity (KYC) verified" on={admin.kycVerified} />
              <Flag label="PAN verified" on={admin.panVerified} />
              <Flag label="Phone verified" on={admin.phoneVerified} />
              <Flag label="Backend “is_verified”" on={admin.isVerifiedFlag} />
              {admin.isVerifiedFlag ? (
                <p className="text-[11px] text-brand-700">✓ Verified on the record via NOSTOPS admin. The KYC identity/PAN/phone checks above are a separate process and may still be pending.</p>
              ) : row.verification === 'verified' ? (
                <p className="text-[11px] text-amber-700">Shown as <strong>Verified</strong> only because this teacher is <strong>Empanelled</strong> (Empanelled ⇒ Verified). It is <strong>not</strong> set on the record yet — choose <strong>Verified</strong> in the Verification control above and Save to make it explicit.</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Field label="Tier / badge">{[admin.tier, admin.badgePrimary].filter(Boolean).join(' · ') || null}</Field>
              <Field label="Profile completion">{row.completion}%</Field>
              <Field label="Empanelment path">{admin.empanelmentPath ? titleCase(admin.empanelmentPath) : null}</Field>
              <Field label="Empanelment cert">{admin.empanelmentCertId ? <code className="text-xs">{admin.empanelmentCertId}</code> : null}</Field>
              <Field label="Public profile visible">{admin.publicProfileVisible ? 'Yes' : 'No'}</Field>
              <Field label="Active">{admin.isActive ? 'Yes' : 'No'}</Field>
              {(!admin.publicProfileVisible || !admin.isActive) && (
                <p className="text-[11px] text-muted">This teacher&apos;s public profile is hidden because it is inactive or incomplete ({row.completion}% complete) on their account. Verification, empanelment and level are badges — they do not publish a profile. The teacher must complete and activate their profile for it to appear publicly.</p>
              )}
              <Field label="City coordinator">{admin.cityCoordinatorId ? <code className="text-xs">{admin.cityCoordinatorId}</code> : null}</Field>
              <Field label="Registered">{fmtDate(row.createdAt)}</Field>
              <Field label="Last updated">{fmtDate(row.updatedAt)}</Field>
            </div>
          </div>

          <div className="mt-4">
            <AdminAuthorToggle teacherId={row.teacherId} initialEnabled={authorEnabled} />
          </div>
        </aside>
      </div>

      {/* STATUS CHANGE HISTORY — admin audit trail (Prompt 29) */}
      <section className="mt-6 rounded-2xl border border-line bg-white p-5" data-testid="status-audit-trail">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">🕓</span>
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Status change history</h2>
        </div>
        <p className="mt-1 text-xs text-muted">Every change to Verification, Empanelment or Teacher Level — the previous value, the new value, who changed it and when (IST).</p>
        <div className="mt-4">
          {history.entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-cream/40 p-4 text-sm text-muted" data-testid="status-audit-empty">
              {history.available
                ? 'No status changes recorded yet for this teacher.'
                : 'No changes recorded yet. This trail activates automatically once the backend audit log is live — new admin changes are already being forwarded to it.'}
            </div>
          ) : (
            <ol className="space-y-3 p-0">
              {history.entries.map((h, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-line p-3">
                  <span aria-hidden className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-sm">🛡️</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{h.fieldLabel}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">{h.fromLabel}</span>
                      <span aria-hidden className="mx-1.5 text-muted">→</span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">{h.toLabel}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">Changed by <span className="font-semibold text-ink-soft">{h.adminName}</span> · {fmtDateTimeIST(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* ACCESS PRIVILEGES — generated live from the central eligibility engine (canAccessFeature) */}
      <section className="mt-6 rounded-2xl border border-line bg-white p-5" data-testid="access-privileges">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">🔑</span>
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Access privileges</h2>
        </div>
        <p className="mt-1 text-xs text-muted">
          What this teacher can and cannot do right now, computed from their current verification, empanelment and level
          via the central <code className="rounded bg-cream px-1 py-0.5">canAccessFeature</code> engine — the same gate used by the
          menu, page guards and APIs. Hosting reflects the level catalogue (L2+); backend host-eligibility is final at runtime.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4" data-testid="access-accessible">
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Currently accessible ({accessible.length})</p>
            <ul className="mt-3 space-y-2 p-0">
              {accessible.map((f) => (
                <li key={f.feature} className="flex items-start gap-2 text-sm">
                  <span aria-hidden className="mt-0.5 text-emerald-600">✓</span>
                  <span className="font-semibold text-ink">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-slate-50/60 p-4" data-testid="access-locked">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Currently locked ({locked.length})</p>
            <ul className="mt-3 space-y-2 p-0">
              {locked.length === 0 ? (
                <li className="text-sm text-muted">Nothing locked — full access for this teacher.</li>
              ) : (
                locked.map((f) => (
                  <li key={f.feature} className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-0.5 text-slate-400">🔒</span>
                    <span className="min-w-0">
                      <span className="font-semibold text-ink-soft">{f.label}</span>
                      {f.reason && <span className="block text-xs text-muted">{f.reason}</span>}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
