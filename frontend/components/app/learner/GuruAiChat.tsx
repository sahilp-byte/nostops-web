'use client';

import React, { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { GuruMessage, GuruSessionSummary } from '@/lib/server/guru-ai';

// Seeker-appropriate starter prompts (UI suggestions only — the actual chat calls
// the single backend AI at /home/guru-ai/chat via /bff/guru-ai/chat).
const STARTERS = [
  'Suggest a 10-minute beginner routine I can do at home',
  'How do I fix my posture at a desk job?',
  'Which yoga style suits me if I want to de-stress?',
  'Breathing techniques to calm anxiety before sleep',
  'Gentle yoga to ease lower-back pain',
  'How do I build a daily home practice that sticks?',
];

// Minimal, safe markdown-lite renderer: **bold**, bullet lines, paragraphs.
function renderRich(text: string, keyBase: string): React.ReactNode {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`${keyBase}-ul-${out.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b, `${keyBase}-li-${out.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) {
      bullets.push(m[1]);
      return;
    }
    flush();
    if (line.trim() === '') return;
    out.push(
      <p key={`${keyBase}-p-${idx}`} className="my-1 leading-relaxed">
        {renderInline(line, `${keyBase}-p-in-${idx}`)}
      </p>,
    );
  });
  flush();
  return out;
}

function renderInline(text: string, keyBase: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={`${keyBase}-${i}`} className="font-bold text-ink">{p.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>
    ),
  );
}

export default function GuruAiChat({
  initialMessages,
  initialSessionId,
  history,
}: {
  initialMessages: GuruMessage[];
  initialSessionId: string | null;
  history: GuruSessionSummary[];
}) {
  const [messages, setMessages] = useState<GuruMessage[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setInput('');
    setError('');
    router.replace('/app/guru-ai');
  }, [router]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || sending) return;
      setError('');
      setInput('');
      setMessages((m) => [...m, { role: 'user', content: msg }]);
      setSending(true);
      const res = await postBff<{ session_id: string | null; reply: string; error?: string }>('/bff/guru-ai/chat', {
        message: msg,
        session_id: sessionId,
      });
      setSending(false);
      if (!res.ok || !res.data?.reply) {
        setError(res.data?.error || 'GuruAI is unavailable right now. Please try again.');
        return;
      }
      if (res.data.session_id) setSessionId(res.data.session_id);
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply }]);
      requestAnimationFrame(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }));
    },
    [sending, sessionId],
  );

  const empty = messages.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* History */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Recent chats</p>
          <button type="button" onClick={resetChat} className="text-xs font-bold text-brand-700 hover:text-brand-600">+ New</button>
        </div>
        {history.length > 0 ? (
          <ul className="mt-2 space-y-1 p-0">
            {history.map((h) => (
              <li key={h.session_id}>
                <Link
                  href={`/app/guru-ai?s=${encodeURIComponent(h.session_id)}`}
                  aria-current={h.session_id === sessionId ? 'true' : undefined}
                  className={`block truncate rounded-lg px-3 py-2 text-sm transition ${
                    h.session_id === sessionId ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-soft hover:bg-cream'
                  }`}
                >
                  {h.first_prompt || 'Conversation'}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">Your conversations will appear here.</p>
        )}
      </aside>

      {/* Chat */}
      <section aria-label="GuruAI conversation" className="flex min-h-[60vh] flex-col rounded-2xl border border-line bg-white">
        <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" data-testid="guru-thread">
          {empty ? (
            <div className="py-6">
              <p className="text-lg font-extrabold tracking-tight text-ink">Namaste 🙏 I&apos;m GuruAI</p>
              <p className="mt-1 text-sm text-ink-soft">Ask me anything about your yoga practice, wellbeing or finding the right teacher. Try a starter:</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STARTERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="rounded-full border border-line bg-cream px-3 py-2 text-left text-sm font-medium text-ink-soft transition hover:border-brand/40 hover:text-brand-700"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'bg-brand text-white' : 'bg-cream text-ink'
                  }`}
                >
                  {m.role === 'user' ? m.content : renderRich(m.content, `msg-${i}`)}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-cream px-4 py-2.5 text-sm text-muted" aria-live="polite">GuruAI is thinking…</div>
            </div>
          )}
        </div>

        {error ? <p className="px-4 pb-2 text-sm font-semibold text-red-600" role="alert">{error}</p> : null}

        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask GuruAI…"
            aria-label="Message GuruAI"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
