'use client';

import { useState } from 'react';

// Lets a visitor share the teacher's public profile (native share sheet, or
// copy-to-clipboard fallback). Rewards teachers with easy self-promotion.
export default function ShareProfileButton({
  name, variant = 'outline', className = '',
}: { name: string; variant?: 'solid' | 'outline' | 'bar' | 'ghost'; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: `${name} — NOSTOPS yoga teacher`, text: `${name} on NOSTOPS`, url }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }

  const base = 'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition';
  const styles: Record<string, string> = {
    solid: 'bg-brand text-white hover:bg-brand-600 px-5 py-3',
    outline: 'border border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700 px-5 py-3',
    bar: 'border border-line bg-white text-ink-soft px-4 py-3',
    ghost: 'bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20 px-5 py-3 backdrop-blur',
  };
  const style = styles[variant] || styles.outline;

  return (
    <button type="button" onClick={share} data-testid="share-profile" className={`${base} ${style} ${className}`}>
      <span aria-hidden="true">{copied ? '✓' : '↗'}</span>{copied ? 'Link copied' : 'Share'}
    </button>
  );
}
