'use client';

import { useState } from 'react';

// Small reusable "copy an absolute app URL to clipboard" button.
export default function CopyLinkButton({ path, label = 'Copy link', className }: { path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? 'Copied ✓' : label}
    </button>
  );
}
