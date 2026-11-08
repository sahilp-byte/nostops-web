'use client';

import { useState } from 'react';

/**
 * Apply CTA for the City Coordinator page. Opens the external Jotform in a new
 * tab and reveals a short, respectful "we'll be in touch" confirmation inline so
 * the application journey feels complete even though the form lives off-site.
 */
export default function ApplyCoordinatorButton({ href, testid }: { href: string; testid: string }) {
  const [sent, setSent] = useState(false);
  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testid}
        onClick={() => setSent(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-base font-black text-brand-700 shadow-sm transition hover:bg-cream"
      >
        Apply as City Coordinator <span aria-hidden>→</span>
      </a>
      {sent && (
        <p
          role="status"
          data-testid={`${testid}-confirm`}
          className="mt-3 inline-flex items-start gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white"
        >
          <span aria-hidden>🙏</span>
          <span>Thanks — the application form opened in a new tab. Once you submit it, our team will be in touch.</span>
        </p>
      )}
    </div>
  );
}
