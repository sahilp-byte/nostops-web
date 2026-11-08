// NOSTOPS Trust Strip — a consolidated, scannable band of verification signals
// so seekers instantly see who's NOSTOPS Verified / Empanelled. Pure
// presentational server component; fed only PUBLIC-SAFE fields (no PII). It
// renders ONLY when the teacher is Verified or Empanelled.
import Link from 'next/link';

export type TrustStripProps = {
  isVerified: boolean;
  isEmpanelled: boolean;
  /** Identity check passed but not (yet) empanelled — shown on its own. */
  idChecked?: boolean;
  experienceYears?: number;
  rating?: number;
  reviewsCount?: number;
  /** Primary lineage/parampara label, e.g. "Iyengar". */
  lineage?: string;
  /** In-page anchor (e.g. "#empanelment-certificate") to the cert section. */
  certHref?: string;
  variant?: 'full' | 'compact';
};

/** Compact variant — a fragment of trust pills for dense surfaces (Discover
 *  cards). Caller supplies the surrounding flex container. */
function CompactChips({ isVerified, isEmpanelled, idChecked }: { isVerified: boolean; isEmpanelled: boolean; idChecked?: boolean }) {
  return (
    <>
      {isVerified && (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
          <span aria-hidden="true">🛡️</span> NOSTOPS Verified
        </span>
      )}
      {isEmpanelled && (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent-600">
          <span aria-hidden="true">★</span> Empanelled
        </span>
      )}
      {!isVerified && idChecked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-ink-soft">
          ID checked
        </span>
      )}
    </>
  );
}

export default function TrustStrip({
  isVerified,
  isEmpanelled,
  idChecked,
  experienceYears,
  rating,
  reviewsCount,
  lineage,
  certHref,
  variant = 'full',
}: TrustStripProps) {
  // Only teachers with at least one real trust status get a trust strip.
  if (!isVerified && !isEmpanelled && !idChecked) return null;

  if (variant === 'compact') {
    return <CompactChips isVerified={isVerified} isEmpanelled={isEmpanelled} idChecked={idChecked} />;
  }

  return (
    <section
      data-testid="trust-strip"
      aria-label="Trust and verification"
      className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-base">🛡️</span>
        <h2 className="text-base font-black tracking-tight text-ink">Why you can trust this teacher</h2>
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">
        NOSTOPS independently verifies each teacher&rsquo;s identity, credentials and lineage.
        &ldquo;Verified&rdquo; means the identity check passed <em>and</em> the teacher is empanelled.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {isVerified && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white" data-testid="trust-verified">
            <span aria-hidden="true">✓</span> NOSTOPS Verified
          </span>
        )}
        {isEmpanelled && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white" data-testid="trust-empanelled">
            <span aria-hidden="true">★</span> NOSTOPS Empanelled
          </span>
        )}
        {!isVerified && idChecked && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink-soft ring-1 ring-line" data-testid="trust-id-checked">
            ID checked
          </span>
        )}
        {lineage && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line">
            <span aria-hidden="true">🧘</span> {lineage} lineage
          </span>
        )}
        {experienceYears ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line">
            <span aria-hidden="true">🎓</span> {experienceYears} yrs experience
          </span>
        ) : null}
        {rating ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line">
            <span aria-hidden="true">⭐</span> {rating.toFixed(1)}{reviewsCount ? ` (${reviewsCount})` : ''} rating
          </span>
        ) : null}
        {isEmpanelled && certHref && (
          <Link
            href={certHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-50"
          >
            <span aria-hidden="true">🏅</span> View empanelment certificate
          </Link>
        )}
      </div>
    </section>
  );
}
