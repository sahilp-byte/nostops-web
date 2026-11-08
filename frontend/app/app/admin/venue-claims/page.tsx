import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllClaims, CLAIM_STATUS_LABEL } from '@/lib/server/venue-ownership';
import ClaimDecision from '@/components/app/admin/ClaimDecision';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Venue Claims', robots: { index: false, follow: false } };

const METHOD: Record<string, string> = {
  business_email: 'Business email', website_domain: 'Website domain', google_business: 'Google Business Profile',
  business_document: 'Business document', authorization_letter: 'Authorisation letter', other: 'Other',
};

// Admin-only (gated by app/app/admin/layout.tsx). Every Global Venue ownership claim needs an explicit decision here.
export default async function VenueClaimsAdminPage() {
  const claims = await getAllClaims();
  const open = claims.filter((c) => !['approved', 'rejected'].includes(c.status));
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-black tracking-tight text-ink">Venue Claims</h1>
      <p className="mt-1 text-sm text-ink-soft">{open.length} open · {claims.length} total. Owner sensitive edits are reviewed in <Link href="/app/admin/venue-review" className="font-bold text-brand-700 hover:underline">Venue Submissions</Link>.</p>
      {claims.length === 0 && <p className="card mt-5 p-5 text-sm text-muted">No claims yet.</p>}
      <ul className="mt-5 space-y-4">
        {claims.map((c) => (
          <li key={c.id} className="card p-5" data-testid={`admin-claim-${c.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-black text-ink">{c.venue_name} <span className="text-xs font-semibold text-muted">· {c.venue_city} · {c.venue_id}</span></p>
                <p className="text-sm text-ink-soft">{c.claimant_name} ({c.claimant_email}) — {c.relationship}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.status === 'disputed' ? 'bg-red-50 text-red-700' : c.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-cream text-ink-soft'}`} data-testid={`admin-claim-status-${c.id}`}>{CLAIM_STATUS_LABEL[c.status] || c.status}</span>
              {c.conflict && <span className="ml-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900" data-testid={`admin-claim-conflict-${c.id}`}>Conflict — another claim won</span>}
            </div>
            {(c.is_transfer || c.duplicate_of) && <p className="mt-2 text-xs font-bold text-red-700">{c.is_transfer ? 'Venue already has an approved owner — approving transfers ownership. ' : ''}{c.duplicate_of ? `Competing claim: ${c.duplicate_of}` : ''}</p>}
            <dl className="mt-3 grid gap-1 text-xs text-ink-soft sm:grid-cols-2">
              <div><dt className="inline font-bold">Evidence: </dt><dd className="inline">{(c.evidence_methods || []).map((m) => METHOD[m] || m).join(', ')}</dd></div>
              {c.business_email && <div><dt className="inline font-bold">Business email: </dt><dd className="inline">{c.business_email} {c.email_domain_matches_website ? '(domain matches website)' : '(domain not matched)'}</dd></div>}
              {c.website && <div><dt className="inline font-bold">Website: </dt><dd className="inline break-all">{c.website}</dd></div>}
              {c.google_business_url && <div><dt className="inline font-bold">Google profile: </dt><dd className="inline break-all">{c.google_business_url} (not verified by NOSTOPS)</dd></div>}
              {c.note && <div className="sm:col-span-2"><dt className="inline font-bold">Note: </dt><dd className="inline">{c.note}</dd></div>}
            </dl>
            {!!c.documents?.length && (
              <p className="mt-2 text-xs">
                Documents:{' '}
                {c.documents.map((d) => <a key={d.id} href={`/bff/admin/venue-claims/doc/${d.id}`} target="_blank" rel="noopener noreferrer" className="mr-3 font-bold text-brand-700 hover:underline">{d.name}</a>)}
              </p>
            )}
            {c.decision_note && <p className="mt-2 text-xs text-muted">Decision note: {c.decision_note}{c.decided_by ? ` — ${c.decided_by}` : ''}</p>}
            <ClaimDecision claimId={c.id} status={c.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
