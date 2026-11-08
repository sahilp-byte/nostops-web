import Link from 'next/link';

// One shared legal-consent line for every checkout and sign-up step. Links open
// in a new tab so a half-completed payment or form is never lost.
export default function LegalAgreement({
  action = 'paying',
  refunds = true,
  className = '',
}: {
  action?: string;
  refunds?: boolean;
  className?: string;
}) {
  const a = 'font-semibold text-brand-700 underline-offset-2 hover:underline';
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`} data-testid="legal-agreement">
      By {action}, you agree to the NOSTOPS{' '}
      <Link href="/terms" target="_blank" rel="noopener" className={a}>Terms of Service</Link>
      {refunds ? (
        <>
          , <Link href="/refunds" target="_blank" rel="noopener" className={a}>Refund &amp; Cancellation Policy</Link> and{' '}
        </>
      ) : (
        ' and '
      )}
      <Link href="/privacy" target="_blank" rel="noopener" className={a}>Privacy Policy</Link>.
    </p>
  );
}
