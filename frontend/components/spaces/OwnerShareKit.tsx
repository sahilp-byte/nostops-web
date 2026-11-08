'use client';

import Link from 'next/link';
import { useState } from 'react';

// Owner Share Kit (approved Spaces only): a ready-made, editable WhatsApp invitation for local yoga teachers
// and a printable poster. Uses public Space details only; nothing is sent automatically.
export default function OwnerShareKit({ id, url, name, locality, model }: { id: string; url: string; name: string; locality: string; model: string }) {
  const [msg, setMsg] = useState(
    `Namaste! 🙏 ${name} in ${locality} is now listed on NOSTOPS Spaces${model ? ` as a ${model} space` : ''} for yoga.\n\n` +
    `If you are a yoga teacher nearby, you can hold your classes here. See the space and send an enquiry on NOSTOPS:\n${url}`,
  );
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 border-t border-line pt-4" data-testid="owner-share-kit">
      <p className="text-sm font-extrabold text-ink">Invite local yoga teachers</p>
      <p className="mt-1 text-xs text-ink-soft">Edit the message if you like, then share it on WhatsApp or print the poster for your notice board.</p>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} maxLength={1000}
        className="mt-2 block w-full rounded-xl border border-line bg-white p-3 text-sm" aria-label="Invitation message" data-testid="share-kit-message" />
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0E7A3F] px-4 text-sm font-bold text-white" data-testid="share-kit-whatsapp">Share on WhatsApp</a>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink" data-testid="share-kit-copy">{copied ? 'Message copied' : 'Copy message'}</button>
        <Link href={`/space-poster/${encodeURIComponent(id)}`} target="_blank"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink" data-testid="share-kit-poster">Print poster</Link>
      </div>
    </div>
  );
}
