'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ENQUIRY_ROUTE } from '@/lib/spaces';
import { usePathname, useRouter } from 'next/navigation';
import { renderRich } from '@/components/guru/rich';
import { FIRST_TIME_QUESTIONS, GURU_CATEGORIES, SUPPORT_CATEGORIES, categoryForPage } from '@/components/guru/categories';
import { cohortFromKey, derivePageContext, openingPrompt, type OpeningPrompt, type PageCtx } from '@/components/guru/context';
import { MOBILE_NAV_EVENT, GURU_BUBBLE_EVENT, emitUiEvent } from '@/lib/ui-events';

type Cta = { id: string; label: string; href: string };
type Msg = { role: 'user' | 'assistant'; content: string; ctas?: Cta[] };

const INTRO =
  "I'm your NOSTOPS guide. I can help you understand the platform, get started, find opportunities and solve common problems.";

// The greeting bubble auto-opens at most ONCE per visit (browser session),
// whichever page it first appears on. The launcher stays available everywhere.
const GREETED_KEY = 'nostops_guru_greeted';
const REGISTER_ROUTE = /^\/events\/[^/]+\/register$/;

// Human escalation — the last-mile contact when AI Guru cannot resolve a question.
const HUMAN_EMAIL = 'nostops.org@gmail.com';
const HUMAN_MAILTO = `mailto:${HUMAN_EMAIL}?subject=${encodeURIComponent('NOSTOPS help request')}`;

// Signed-in visitors get their own once-per-visit greeting, so the dashboard
// greeting still appears after a greeting was already shown before sign-in.
function loadGreeted(authed: boolean): boolean {
  try {
    return sessionStorage.getItem(GREETED_KEY + (authed ? ':in' : '')) === '1';
  } catch {
    return false;
  }
}
function persistGreeted(authed: boolean) {
  try {
    sessionStorage.setItem(GREETED_KEY + (authed ? ':in' : ''), '1');
  } catch {
    /* ignore */
  }
}

// Cohort the current screen declares via data-guru-cohort (public event page,
// Event Creator wizard). Read after commit so it always matches the page shown.
function domCohort(): PageCtx['cohort'] {
  if (typeof document === 'undefined') return undefined;
  return cohortFromKey(document.querySelector('[data-guru-cohort]')?.getAttribute('data-guru-cohort'));
}

// Screens where an auto-opening bubble would cover the primary action. The
// launcher itself stays available. Phones: never auto-open (founder choice) —
// on a narrow screen the bubble covers hero buttons and forms. Event Creator
// wizard: every screen size — its Get Started / Select buttons sit where the
// bubble opens. Public event pages (and their register step): every screen
// size — the bubble covers the details card's Register button (founder choice).
function suppressBubble(route: string): boolean {
  if (route === '/') return true;
  // Sign-in screens: keep the once-per-visit greeting for the dashboard that follows.
  if (/^\/(login|signup|register)(\/|$)/.test(route)) return true;
  if (/^\/app\/org\/events\/new(\/|$)/.test(route)) return true;
  if (/^\/events\/[^/]+/.test(route)) return true;
  // Spaces owner Enquiries dashboard + Enquiry Details: the bubble covers the side panel and response controls.
  if (/^\/app\/spaces\/incoming(\/|$)/.test(route)) return true;
  // Teacher-side Space enquiry pages: the bubble covers the "not a booking" notice and enquiry details.
  if (/^\/app\/spaces\/enquiries(\/|$)/.test(route)) return true;
  return isPhone();
}


function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

export default function AskGuru() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'welcome' | 'support'>('welcome');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Auth context (resolved server-side, never trusted from the client for CTAs).
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Proactive contextual bubble.
  const [bubble, setBubble] = useState<OpeningPrompt | null>(null);
  // Hide the launcher + bubble while the mobile menu drawer is open so they
  // never cover its Log in / Sign up actions.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setNavOpen(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(MOBILE_NAV_EVENT, on);
    return () => window.removeEventListener(MOBILE_NAV_EVENT, on);
  }, []);
  // Tell other floating elements (sticky CTA) when the bubble is showing.
  useEffect(() => {
    emitUiEvent(GURU_BUBBLE_EVENT, !!bubble && !open && !navOpen);
  }, [bubble, open, navOpen]);

  const sessionRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const regOpenRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const inChat = messages.length > 0;
  const ctx: PageCtx = useMemo(() => derivePageContext(pathname), [pathname]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  // On mount (and on each navigation while signed out, so a fresh login is picked
  // up without a full reload): fetch a signed token and the visitor's auth/role.
  const authProbe = authed ? 'authed' : pathname;
  useEffect(() => {
    fetch('/bff/guru/token', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.token) tokenRef.current = d.token;
        setAuthed(!!d?.authenticated);
        setRole(d?.role ?? null);
      })
      .catch(() => {})
      .finally(() => setAuthLoaded(true));
  }, [authProbe]);

  // Detect whether public event registration is actually open (DOM signal).
  useEffect(() => {
    regOpenRef.current = false;
    if (ctx.page_type !== 'event') return;
    const check = () => {
      regOpenRef.current = !!document.querySelector('[data-testid="register-cta"]');
    };
    const t = setTimeout(check, 700);
    return () => clearTimeout(t);
  }, [ctx.page_type, pathname]);

  // Decide the proactive contextual bubble — once per visit (session), on the
  // first page that has a greeting for this visitor.
  useEffect(() => {
    if (open || inChat || !authLoaded) {
      setBubble(null);
      return;
    }
    if (suppressBubble(ctx.route) || REGISTER_ROUTE.test(ctx.route)) {
      setBubble(null);
      return;
    }
    const candidate = openingPrompt({ ...ctx, cohort: ctx.cohort || domCohort() }, role, authed);
    if (candidate && !loadGreeted(authed)) {
      setBubble(candidate);
      persistGreeted(authed);
    } else {
      setBubble(null);
    }
  }, [ctx, role, authed, authLoaded, open, inChat]);

  const dismissBubble = useCallback(() => setBubble(null), []);

  const buildContext = useCallback((): Record<string, unknown> => {
    const c: Record<string, unknown> = { route: ctx.route, page_type: ctx.page_type };
    if (ctx.journey) c.journey = ctx.journey;
    if (ctx.event_slug) c.event_slug = ctx.event_slug;
    const cohort = ctx.cohort || domCohort();
    if (cohort) c.cohort = cohort;
    if (ctx.page_type === 'event' && regOpenRef.current) c.registration_open = true;
    return c;
  }, [ctx]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;
      setView('welcome');
      setActiveCat(null);
      setBubble(null);
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: 'user', content: q }]);
      setInput('');
      setLoading(true);
      if (!tokenRef.current) {
        try {
          const tr = await fetch('/bff/guru/token', { credentials: 'same-origin' });
          const td = await tr.json();
          tokenRef.current = td?.token || null;
        } catch {
          /* BFF will reject and we show a friendly error */
        }
      }
      let ok = false;
      let data: { reply?: string; ctas?: Cta[]; session_id?: string | null; error?: string } = {};
      try {
        const res = await fetch('/bff/guru/chat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'x-guru-csrf': tokenRef.current || '' },
          body: JSON.stringify({
            message: q,
            history,
            context: buildContext(),
            session_id: sessionRef.current || undefined,
          }),
        });
        data = await res.json().catch(() => ({}));
        ok = res.ok;
      } catch {
        data = { error: 'Network error. Please check your connection and try again.' };
      }
      setLoading(false);
      if (ok && data?.reply) {
        if (data.session_id) sessionRef.current = data.session_id;
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply as string, ctas: data.ctas || [] }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data?.error || "I couldn't reach the NOSTOPS team just now. Please try again in a moment.",
          },
        ]);
      }
    },
    [loading, messages, buildContext],
  );

  const onCta = useCallback(
    (c: Cta) => {
      if (c.id === 'create_support_request') {
        setView('support');
        return;
      }
      setOpen(false);
      router.push(c.href);
    },
    [router],
  );

  const submitSupport = useCallback(
    async (fields: { category: string; issue: string; email?: string; name?: string }) => {
      if (!tokenRef.current) {
        try {
          const tr = await fetch('/bff/guru/token', { credentials: 'same-origin' });
          tokenRef.current = (await tr.json())?.token || null;
        } catch {
          /* BFF will reject */
        }
      }
      try {
        const res = await fetch('/bff/guru/support', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'x-guru-csrf': tokenRef.current || '' },
          body: JSON.stringify({
            category: fields.category,
            issue: fields.issue,
            email: fields.email,
            name: fields.name,
            conversation: messages.map((m) => ({ role: m.role, content: m.content })),
            context: buildContext(),
            reference: ctx.event_slug,
          }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, data };
      } catch {
        return { ok: false, data: { error: 'Could not reach support just now. Please try again.' } };
      }
    },
    [messages, buildContext, ctx],
  );

  const reset = () => {
    setMessages([]);
    setView('welcome');
    setActiveCat(null);
    sessionRef.current = null;
  };

  const openPanel = () => {
    setBubble(null);
    setOpen(true);
  };

  // ── Launcher + proactive bubble ────────────────────────────────────────────
  // Owner: no Ask AI Guru on the homepage; also hidden on venue editing / submit screens where it covers the Save and Submit buttons.
  if (pathname === '/' || pathname.startsWith('/app/venue/owned/') || pathname === '/venues/submit' || pathname.startsWith('/teachers/claim/')) return null;
  // Spaces enquiry pages (desktop): dock the launcher over the left sidebar so it never covers enquiry content.
  const sideDock = ENQUIRY_ROUTE.test(pathname);
  // Register pages: the booking card sits on the right, so the launcher becomes a compact circle in the bottom-left
  // page gutter (outside the 1200px content column at 1280px+) and shows no proactive tip.
  const leftDock = !sideDock && REGISTER_ROUTE.test(pathname);
  if (!open) {
    if (navOpen) return null;
    return (
      <div className={`fixed z-50 flex flex-col gap-3 ${sideDock
        ? 'inset-x-0 bottom-0 items-end border-t border-line bg-white px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:inset-x-auto md:bottom-5 md:left-[4.5rem] md:items-start md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none'
        : leftDock ? 'bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 items-start sm:bottom-5 sm:left-2'
        : 'bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 items-end sm:bottom-5 sm:right-5'}`} data-testid={sideDock ? 'guru-dock-side' : leftDock ? 'guru-dock-left' : undefined}>
        {bubble && (
          <div
            data-testid="guru-bubble"
            className="relative w-[18rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-line bg-white p-3.5 shadow-xl"
          >
            {/* 44×44 tap target (visible circle stays small). */}
            <button
              type="button"
              onClick={dismissBubble}
              aria-label="Dismiss"
              data-testid="guru-bubble-dismiss"
              className="group absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-muted"
            >
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full text-base leading-none transition group-hover:bg-cream group-focus-visible:ring-2 group-focus-visible:ring-brand">×</span>
            </button>
            <p className="pr-7 text-sm leading-relaxed text-ink-soft">{bubble.greeting}</p>
            {!!bubble.questions.length && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {bubble.questions.slice(0, 3).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setOpen(true);
                      send(q);
                    }}
                    className="rounded-full bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700 transition hover:bg-brand-100"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={openPanel}
              className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-accent px-4 py-2 text-sm font-bold text-white"
            >
              <span aria-hidden>✨</span> Ask AI Guru
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={openPanel}
          data-testid="ask-guru-launcher"
          aria-label="Ask AI Guru"
          className={leftDock
            ? 'inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-brand to-accent text-white shadow-xl transition hover:shadow-2xl active:scale-95'
            : 'inline-flex h-14 w-14 items-center justify-center gap-2 self-end rounded-full bg-gradient-to-r from-brand to-accent text-sm font-bold text-white shadow-xl transition hover:shadow-2xl active:scale-95 sm:h-auto sm:min-h-[48px] sm:w-auto sm:px-5 sm:py-3'}
          title="Ask AI Guru"
        >
          {/* Compact icon-only circle on phones (and on register pages) so it never covers page CTAs. */}
          <span aria-hidden className={leftDock ? 'text-lg' : 'text-xl sm:text-base'}>✨</span>
          <span className={leftDock ? 'sr-only' : 'sr-only sm:not-sr-only'}>Ask AI Guru</span>
        </button>
      </div>
    );
  }

  const cat = GURU_CATEGORIES.find((c) => c.id === activeCat) || null;
  const contextPrompt = !inChat ? openingPrompt({ ...ctx, cohort: ctx.cohort || domCohort() }, role, authed) : null;

  return (
    <div
      data-testid="ask-guru-panel"
      className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[640px] sm:max-h-[85vh] sm:w-[400px] sm:rounded-3xl sm:border sm:border-line"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 rounded-t-3xl bg-gradient-to-r from-ink via-royal to-brand px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-black">
            <span aria-hidden>✨</span> Ask AI Guru
          </p>
          <p className="truncate text-[11px] text-white/70">Your NOSTOPS guide</p>
        </div>
        <div className="flex items-center gap-1">
          {inChat && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-white/85 transition hover:bg-white/10"
            >
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            data-testid="ask-guru-close"
            className="grid h-11 w-11 place-items-center rounded-full text-white/90 transition hover:bg-white/10"
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {view === 'support' ? (
          <SupportForm
            authed={authed}
            defaultCategory={categoryForPage(ctx.page_type)}
            onSubmit={submitSupport}
            onBack={() => setView('welcome')}
          />
        ) : inChat ? (
          <div className="space-y-3">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-start gap-2">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-cream px-3.5 py-2.5 text-sm text-ink-soft">
                    {renderRich(m.content, `g-${i}`)}
                  </div>
                  {!!m.ctas?.length && (
                    <div className="flex flex-wrap gap-2">
                      {m.ctas.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onCta(c)}
                          data-testid={`guru-cta-${c.id}`}
                          className="inline-flex min-h-[40px] items-center rounded-xl bg-ink px-3.5 py-2 text-xs font-bold text-white transition hover:bg-royal"
                        >
                          {c.label} →
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {loading && <TypingDots />}
          </div>
        ) : (
          <Welcome
            cat={cat}
            contextPrompt={contextPrompt}
            onPickCategory={(id) => setActiveCat(id)}
            onBackToCategories={() => setActiveCat(null)}
            onAsk={send}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line bg-white px-3 py-2.5 sm:rounded-b-3xl">
        {!loading && view !== 'support' && (
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2 text-[11px] font-semibold text-muted">
            <button type="button" onClick={() => setView('support')} className="min-h-[32px] transition hover:text-brand-700">
              Still need help? Create Support Request
            </button>
            <span aria-hidden>·</span>
            <a href={HUMAN_MAILTO} className="inline-flex min-h-[32px] items-center text-brand-700 hover:underline" data-testid="guru-human-email">
              Email {HUMAN_EMAIL}
            </a>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
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
            placeholder="Or ask AI Guru anything..."
            data-testid="ask-guru-input"
            className="max-h-28 flex-1 resize-none rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:bg-white"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            data-testid="ask-guru-send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            <span aria-hidden className="text-lg leading-none">↑</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function Welcome({
  cat,
  contextPrompt,
  onPickCategory,
  onBackToCategories,
  onAsk,
}: {
  cat: { id: string; label: string; icon: string; questions: string[] } | null;
  contextPrompt: OpeningPrompt | null;
  onPickCategory: (id: string) => void;
  onBackToCategories: () => void;
  onAsk: (q: string) => void;
}) {
  if (cat) {
    return (
      <div>
        <button
          type="button"
          onClick={onBackToCategories}
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
        >
          ← All topics
        </button>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-black text-ink">
          <span aria-hidden>{cat.icon}</span> {cat.label}
        </p>
        <div className="space-y-2">
          {cat.questions.map((q) => (
            <QuestionChip key={q} q={q} onAsk={onAsk} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-base font-black text-ink">Welcome to NOSTOPS Help</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{contextPrompt?.greeting || INTRO}</p>

      {!!contextPrompt?.questions.length && (
        <div className="mt-3 space-y-2">
          {contextPrompt.questions.map((q) => (
            <QuestionChip key={q} q={q} onAsk={onAsk} highlight />
          ))}
        </div>
      )}

      <p className="mb-2 mt-5 text-xs font-black uppercase tracking-wide text-muted">Browse a topic</p>
      <div className="grid grid-cols-2 gap-2">
        {GURU_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPickCategory(c.id)}
            data-testid={`guru-cat-${c.id}`}
            className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-xs font-bold text-ink transition hover:-translate-y-0.5 hover:border-brand hover:shadow-sm"
          >
            <span aria-hidden className="text-base">{c.icon}</span>
            <span className="leading-tight">{c.label}</span>
          </button>
        ))}
      </div>

      {!contextPrompt && (
        <>
          <p className="mb-2 mt-5 text-xs font-black uppercase tracking-wide text-muted">Popular questions</p>
          <div className="space-y-2">
            {FIRST_TIME_QUESTIONS.map((q) => (
              <QuestionChip key={q} q={q} onAsk={onAsk} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuestionChip({ q, onAsk, highlight }: { q: string; onAsk: (q: string) => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onAsk(q)}
      className={
        highlight
          ? 'flex w-full items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-left text-sm font-semibold text-brand-700 transition hover:bg-brand-100'
          : 'flex w-full items-center justify-between gap-2 rounded-xl bg-cream/70 px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-brand-50 hover:text-brand-700'
      }
    >
      <span>{q}</span>
      <span aria-hidden className="text-muted">→</span>
    </button>
  );
}

function SupportForm({
  authed,
  defaultCategory,
  onSubmit,
  onBack,
}: {
  authed: boolean;
  defaultCategory: string;
  onSubmit: (f: { category: string; issue: string; email?: string; name?: string }) => Promise<{ ok: boolean; data: any }>;
  onBack: () => void;
}) {
  const [category, setCategory] = useState(defaultCategory || 'Other');
  const [issue, setIssue] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ ref: string; status: string; next_step: string } | null>(null);

  if (result) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <span aria-hidden className="text-3xl">✅</span>
        <p className="mt-3 text-base font-black text-ink">Your support request has been received.</p>
        <div className="mt-4 w-full max-w-[18rem] rounded-2xl border border-line bg-cream/60 p-4 text-left">
          <p className="text-xs font-semibold text-muted">Request ID</p>
          <p className="text-sm font-black text-ink">{result.ref}</p>
          <p className="mt-2 text-xs font-semibold text-muted">Status</p>
          <p className="text-sm font-bold text-brand-700">{result.status}</p>
          <p className="mt-2 text-xs font-semibold text-muted">Next step</p>
          <p className="text-sm leading-relaxed text-ink-soft">{result.next_step}</p>
        </div>
        <p className="mt-3 max-w-[18rem] text-xs leading-relaxed text-muted">
          Urgent? Email <a href={HUMAN_MAILTO} className="font-bold text-brand-700 hover:underline">{HUMAN_EMAIL}</a> and quote your Request ID.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          Back to chat
        </button>
      </div>
    );
  }

  const submit = async () => {
    setError('');
    if (!issue.trim()) {
      setError('Please describe the issue.');
      return;
    }
    if (!authed && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Please enter a valid email so we can reach you.');
      return;
    }
    setLoading(true);
    const { ok, data } = await onSubmit({
      category,
      issue: issue.trim(),
      email: authed ? undefined : email.trim(),
      name: authed ? undefined : name.trim() || undefined,
    });
    setLoading(false);
    if (ok && data?.ref) setResult(data);
    else setError(data?.error || 'Could not create your request. Please try again.');
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
        ← Back to chat
      </button>
      <p className="text-base font-black text-ink">Create a support request</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        AI Guru can help instantly. For issues that need our team, send this to NOSTOPS support — your conversation is
        attached, so you won’t have to repeat yourself.
      </p>

      <label className="mt-4 block text-xs font-bold text-ink">Category</label>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        data-testid="support-category"
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
      >
        {SUPPORT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-bold text-ink">What’s the issue?</label>
      <textarea
        value={issue}
        onChange={(e) => setIssue(e.target.value)}
        rows={4}
        placeholder="Tell us what you were trying to do and what went wrong."
        data-testid="support-issue"
        className="mt-1 w-full resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
      />

      {!authed && (
        <>
          <label className="mt-3 block text-xs font-bold text-ink">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            data-testid="support-email"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
          />
          <label className="mt-3 block text-xs font-bold text-ink">Name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
          />
        </>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-accent-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        data-testid="support-submit"
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Create Support Request'}
      </button>
      <div className="mt-4 rounded-xl border border-line bg-cream/60 p-3 text-xs leading-relaxed text-ink-soft" data-testid="support-human-email">
        <p className="font-bold text-ink">Prefer to talk to a person?</p>
        <p className="mt-0.5">
          Email the NOSTOPS team at{' '}
          <a href={HUMAN_MAILTO} className="font-bold text-brand-700 hover:underline">{HUMAN_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-cream px-3.5 py-3">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
    </div>
  );
}
