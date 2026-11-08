'use client';

import { useEffect, useRef, useState } from 'react';

// PROMPT 29 — Ask the Teacher. MVP uses a WhatsApp deep link with the retreat
// name, teacher and the participant's question prepopulated. The inquiry is
// tracked via analytics (gtag) where available. When no teacher WhatsApp is
// published, we still open WhatsApp with the prefilled text (user picks contact).
function track(event: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof (window as { gtag?: (...a: unknown[]) => void }).gtag === 'function') {
    (window as unknown as { gtag: (...a: unknown[]) => void }).gtag('event', event, params);
  }
}

export default function AskTeacher({
  retreatId,
  retreatTitle,
  teacherName,
  hasTeacherWhatsapp = false,
  variant = 'primary',
  className = '',
  label = 'Ask the teacher',
}: {
  retreatId: string;
  retreatTitle: string;
  teacherName?: string;
  /** The host published a WhatsApp number (resolved server-side, never sent here). */
  hasTeacherWhatsapp?: boolean;
  variant?: 'primary' | 'ghost' | 'dark';
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function send() {
    const who = teacherName ? teacherName : 'there';
    const question = q.trim() || 'I have a question about this retreat.';
    const msg = `Namaste ${who}, I have a question about your retreat "${retreatTitle}" on NOSTOPS:\n\n${question}`;
    const href = hasTeacherWhatsapp
      ? `/bff/retreats/${encodeURIComponent(retreatId)}/ask-whatsapp?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    track('retreat_ask_teacher', { retreat_id: retreatId, has_number: hasTeacherWhatsapp });
    window.open(href, '_blank', 'noopener,noreferrer');
    setOpen(false);
    setQ('');
  }

  const trigger =
    variant === 'dark'
      ? `rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 ${className}`
      : variant === 'ghost'
        ? `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700 ${className}`
        : `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600 ${className}`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={trigger} data-testid="ask-teacher">
        <span aria-hidden>💬</span> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Ask the teacher" onClick={() => setOpen(false)} data-testid="ask-teacher-modal">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black tracking-tight text-ink">Ask {teacherName || 'the teacher'}</p>
                <p className="mt-0.5 text-sm text-ink-soft">About “{retreatTitle}”. We&apos;ll open WhatsApp with your question ready to send.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-cream">✕</button>
            </div>
            <textarea
              ref={ref}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="e.g. Is this retreat suitable for beginners? What's the daily schedule like?"
              className="mt-4 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
              data-testid="ask-teacher-input"
            />
            <button
              type="button"
              onClick={send}
              className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition hover:brightness-95"
              data-testid="ask-teacher-send"
            >
              <span aria-hidden>💬</span> Send on WhatsApp
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">Your question stays yours — NOSTOPS never sends marketing on your behalf.</p>
          </div>
        </div>
      )}
    </>
  );
}
