'use client';

import { useState } from 'react';
import type { ProfileVM } from '@/lib/server/widgets';

// A copy-ready HTML email signature that links to the canonical profile.
// Copies the raw HTML source (what signature editors in Gmail/Outlook accept).
export default function EmailSignature({ profile }: { profile: ProfileVM }) {
  const [copied, setCopied] = useState<'html' | 'text' | null>(null);
  const designation = profile.tierBadge || 'Yoga Teacher';
  const line2 = [designation, profile.city].filter(Boolean).join(' · ');

  const html = `<table cellpadding="0" cellspacing="0" style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
  <tr>
    <td style="padding-right:14px;border-right:3px solid #0F766E;">
      <div style="font-size:16px;font-weight:800;">${profile.name}</div>
      <div style="font-size:12px;color:#475569;margin-top:2px;">${line2}</div>
    </td>
    <td style="padding-left:14px;">
      <a href="${profile.url}" style="font-size:12px;font-weight:700;color:#0F766E;text-decoration:none;">View my NOSTOPS profile &rarr;</a>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Verified on NOSTOPS · Teacher-first yoga cooperative</div>
    </td>
  </tr>
</table>`;

  const text = `${profile.name}\n${line2}\nNOSTOPS profile: ${profile.url}`;

  const copy = async (which: 'html' | 'text') => {
    try {
      await navigator.clipboard.writeText(which === 'html' ? html : text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1600);
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {/* Rendered preview */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="border-r-[3px] border-brand pr-3">
            <p className="text-sm font-extrabold text-ink">{profile.name}</p>
            <p className="text-xs text-muted">{line2}</p>
          </div>
          <div className="pl-1">
            <p className="text-xs font-bold text-brand-700">View my NOSTOPS profile →</p>
            <p className="text-[11px] text-muted">Verified on NOSTOPS · Teacher-first yoga cooperative</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy('html')} className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-600" data-testid="email-copy-html">
          {copied === 'html' ? 'HTML copied ✓' : 'Copy HTML signature'}
        </button>
        <button type="button" onClick={() => copy('text')} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream">
          {copied === 'text' ? 'Text copied ✓' : 'Copy plain text'}
        </button>
      </div>
      <p className="text-[11px] text-muted">Paste the HTML into Gmail → Settings → Signature, or Outlook → Signatures.</p>
    </div>
  );
}
