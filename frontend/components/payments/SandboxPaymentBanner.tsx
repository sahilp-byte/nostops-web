'use client';

import { useEffect, useState } from 'react';
import { isPreviewSuffix } from '@/lib/payment-mode';

/** Sandbox completion — shown on preview checkout screens only. Needs BOTH the
 *  server's confirmation that this checkout runs on the Cashfree SANDBOX (`show`)
 *  AND a preview host in the browser, so a production page can never be labelled
 *  as a test. Inline (not fixed), so it never covers buttons or checkout fields. */
export default function SandboxPaymentBanner({ show }: { show: boolean }) {
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    setPreview(isPreviewSuffix(window.location.host));
  }, []);
  if (!show || !preview) return null;
  return (
    <p
      role="status"
      data-testid="sandbox-payment-banner"
      className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm font-bold text-amber-900"
    >
      Sandbox Test Payment — No real money will be charged
    </p>
  );
}
