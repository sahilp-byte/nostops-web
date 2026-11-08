'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { ARTICLE_TYPES, MAX_WORDS, MAX_SUMMARY, VOICES_LANGS, countWords } from '@/lib/voices-shared';

const CONSENT_TEXT =
  'I understand that if my article is approved and made available for republication, NOSTOPS may make it available to external websites and publishers provided the required author and NOSTOPS attribution is retained.';

type Initial = {
  id?: string;
  title?: string;
  type?: string;
  topic?: string;
  source_language?: string;
  content_md?: string;
  summary?: string;
  consent?: boolean;
  status?: string;
};

// Minimal, safe Markdown → HTML for the author's own live preview. HTML is
// escaped first so nothing raw is injected; only a small syntax subset renders.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderPreview(md: string): string {
  const lines = esc(md || '').split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const inline = (t: string) =>
    t
      .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const openList = (t: 'ul' | 'ol') => { if (listType !== t) { closeList(); out.push(`<${t}>`); listType = t; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { closeList(); out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`); }
    else if (/^##\s+/.test(line)) { closeList(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); }
    else if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); }
    else if (/^\d+\.\s+/.test(line)) { openList('ol'); out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`); }
    else if (/^[-*]\s+/.test(line)) { openList('ul'); out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`); }
    else if (line.trim() === '') { closeList(); }
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return out.join('');
}

export default function VoicesEditor({ initial, topicSuggestions }: { initial: Initial; topicSuggestions: string[] }) {
  const router = useRouter();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(initial.title || '');
  const [type, setType] = useState(initial.type && ARTICLE_TYPES.includes(initial.type as any) ? initial.type : 'Article');
  const [topic, setTopic] = useState(initial.topic || '');
  const [lang, setLang] = useState(initial.source_language || 'en');
  const [content, setContent] = useState(initial.content_md || '');
  const [summary, setSummary] = useState(initial.summary || '');
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [formatBusy, setFormatBusy] = useState(false);
  const [formatPreview, setFormatPreview] = useState<string | null>(null);
  const [formatHint, setFormatHint] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem('nostops_voices_format_hint_v1')) setFormatHint(true); } catch { /* ignore */ }
  }, []);
  function dismissFormatHint() {
    setFormatHint(false);
    try { localStorage.setItem('nostops_voices_format_hint_v1', '1'); } catch { /* ignore */ }
  }
  const [consent, setConsent] = useState(!!initial.consent);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const words = useMemo(() => countWords(content.replace(/<[^>]+>/g, ' ').replace(/[#>*[\]()_-]/g, ' ')), [content]);
  const over = words > MAX_WORDS;
  const preview = useMemo(() => renderPreview(content), [content]);

  function wrap(before: string, after = before) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = content.slice(s, e) || 'text';
    const next = content.slice(0, s) + before + sel + after + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length; });
  }
  function prefixLine(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = content.lastIndexOf('\n', s - 1) + 1;
    setContent(content.slice(0, lineStart) + prefix + content.slice(lineStart));
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + prefix.length; });
  }
  function insertLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    wrap('[', `](${url})`);
  }

  // Always surface a blocker next to the button and bring it into view, so
  // Submit is never a silent dead-end.
  function fail(msg: string) {
    setError(msg);
    requestAnimationFrame(() => msgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  async function generateSummary() {
    setError(null);
    if (words < 10) return fail('Write a little more of your article first, then generate the summary.');
    setSummaryBusy(true);
    const res = await postBff<{ summary?: string; error?: string }>('/bff/teacher/voices-summary', { title: title.trim(), content });
    setSummaryBusy(false);
    if (!res.ok || !res.data?.summary) { return fail(res.data?.error || 'Could not generate a summary right now. Please try again.'); }
    setSummary(res.data.summary.slice(0, MAX_SUMMARY));
  }

  // AI formatting-only pass: same words, tidier structure. The result is shown
  // in a before/after modal so the author can Accept or Discard (never a silent
  // rewrite of what they typed).
  async function runAutoFormat() {
    setError(null);
    dismissFormatHint();
    if (content.trim().length < 20) return fail('Paste or write a little more of your article first, then tap Auto-format.');
    setFormatBusy(true);
    const res = await postBff<{ content_md?: string; error?: string }>('/bff/teacher/voices-format', { title: title.trim(), type, content });
    setFormatBusy(false);
    if (!res.ok || !res.data?.content_md) { return fail(res.data?.error || 'Could not auto-format right now. Please try again.'); }
    setFormatPreview(res.data.content_md);
  }
  function acceptFormat() {
    if (formatPreview !== null) setContent(formatPreview);
    setFormatPreview(null);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  async function save(action: 'draft' | 'submit') {
    setError(null);
    if (action === 'submit') {
      if (!title.trim()) return fail('Please add a title before submitting.');
      if (words === 0) return fail('Your article is empty — please write something before submitting it for review.');
      if (over) return fail(`Your article is ${words} words. Please remove about ${words - MAX_WORDS} word${words - MAX_WORDS === 1 ? '' : 's'} to get under the ${MAX_WORDS}-word limit, then submit again.`);
      if (!consent) return fail('Please tick the syndication acknowledgement below to submit for review.');
    }
    setBusy(action);
    const res = await postBff<{ ok?: boolean; error?: string }>('/bff/teacher/voices', {
      id: initial.id, title: title.trim(), type, topic: topic.trim(), source_language: lang, content_md: content, summary: summary.trim(), consent, action,
    });
    setBusy(null);
    if (!res.ok || !res.data?.ok) { return fail(res.data?.error || 'Could not save — please check your connection and try again.'); }
    router.push('/app/teacher/voices');
    router.refresh();
  }

  const inputCls = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand';
  const tbBtn = 'rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink-soft hover:border-brand hover:text-brand-700';

  return (
    <>
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Title <span className="text-red-500">*</span></span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="A clear, honest headline" data-testid="voices-title" className={inputCls} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Article type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} data-testid="voices-type" className={inputCls}>
              {ARTICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Source language</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)} data-testid="voices-lang" className={inputCls}>
              {VOICES_LANGS.map((l) => <option key={l.code} value={l.code}>{l.native} · {l.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Topic</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} list="voices-topics" placeholder="e.g. Pranayama, Yoga philosophy" data-testid="voices-topic" className={inputCls} />
          <datalist id="voices-topics">{topicSuggestions.map((t) => <option key={t} value={t} />)}</datalist>
        </label>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink">Article</span>
            <span data-testid="voices-wordcount" className={`text-xs font-bold ${over ? 'text-red-600' : words > MAX_WORDS * 0.9 ? 'text-amber-600' : 'text-muted'}`}>
              {words} / {MAX_WORDS} words
            </span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={runAutoFormat}
              disabled={formatBusy || busy !== null}
              data-testid="voices-autoformat"
              title="Let AI tidy the structure — headings, emphasis and lists. Your words stay the same."
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
            >
              {formatBusy ? 'Formatting…' : '✨ Auto-format'}
            </button>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
            <button type="button" className={tbBtn} onClick={() => wrap('**')}>B</button>
            <button type="button" className={`${tbBtn} italic`} onClick={() => wrap('*')}>I</button>
            <button type="button" className={`${tbBtn} underline`} onClick={() => wrap('<u>', '</u>')}>U</button>
            <button type="button" className={tbBtn} onClick={() => prefixLine('## ')}>H2</button>
            <button type="button" className={tbBtn} onClick={() => prefixLine('### ')}>H3</button>
            <button type="button" className={tbBtn} onClick={() => prefixLine('> ')}>❝ Quote</button>
            <button type="button" className={tbBtn} onClick={() => prefixLine('- ')}>• List</button>
            <button type="button" className={tbBtn} onClick={insertLink}>🔗 Link</button>
          </div>
          {formatHint && (
            <div className="mb-2 flex items-start gap-2.5 rounded-xl border border-brand/25 bg-brand-50/70 px-3 py-2.5 text-xs text-ink-soft" data-testid="voices-format-hint" role="note">
              <span aria-hidden className="text-sm leading-none">💡</span>
              <p className="flex-1 leading-relaxed">
                <span className="font-bold text-ink">New here?</span> Write freely, then tap <span className="font-bold text-brand-700">✨ Auto-format</span> to tidy headings, emphasis and lists in one tap — your words stay exactly the same.
              </p>
              <button type="button" onClick={dismissFormatHint} data-testid="voices-format-hint-dismiss" className="shrink-0 rounded-md px-1.5 py-0.5 font-bold text-brand-700 hover:bg-brand-100">
                Got it
              </button>
            </div>
          )}
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="Write your perspective… Use the buttons above for headings, bold, quotes and links."
            data-testid="voices-content"
            className={`${inputCls} font-mono leading-relaxed`}
          />
          <p className="mt-1 text-xs text-muted">Supports light formatting (Markdown): <code>## Heading</code>, <code>**bold**</code>, <code>*italic*</code>, <code>&gt; quote</code>, <code>- list</code>, <code>[link](url)</code>.</p>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink">Summary <span className="font-normal text-muted">(2 lines)</span></span>
            <button
              type="button"
              onClick={generateSummary}
              disabled={summaryBusy || busy !== null}
              data-testid="voices-summary-generate"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
            >
              {summaryBusy ? 'Generating…' : '✨ Auto-generate'}
            </button>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, MAX_SUMMARY))}
            rows={2}
            maxLength={MAX_SUMMARY}
            placeholder="A crisp two-line summary shown on the Voices hub and at the top of your article. Tap ✨ Auto-generate, or write your own."
            data-testid="voices-summary"
            className={`${inputCls} leading-relaxed`}
          />
          <p className="mt-1 text-xs text-muted">{summary.length}/{MAX_SUMMARY} · Unique to this article. If left blank, we’ll auto-write one when you submit.</p>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-line bg-cream/40 p-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="voices-consent" className="mt-0.5 h-4 w-4" />
          <span className="text-xs leading-relaxed text-ink-soft">{CONSENT_TEXT}</span>
        </label>

        {error && <div ref={msgRef} data-testid="voices-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy !== null} onClick={() => save('draft')} data-testid="voices-save-draft" className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-soft hover:border-brand disabled:opacity-50">
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => save('submit')} data-testid="voices-submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">
            {busy === 'submit' ? 'Submitting…' : 'Submit for Editorial Review'}
          </button>
          <span data-testid="voices-wordcount-inline" className={`text-xs font-bold ${over ? 'text-red-600' : words > MAX_WORDS * 0.9 ? 'text-amber-600' : 'text-muted'}`}>
            {words} / {MAX_WORDS} words{over ? ` · ${words - MAX_WORDS} over` : ''}
          </span>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted">Preview</p>
        <div className="rounded-2xl border border-line bg-white p-6">
          <h1 className="text-2xl font-black tracking-tight text-ink">{title || 'Your title will appear here'}</h1>
          <p className="mt-1 text-xs font-semibold text-muted">{type}{topic ? ` · ${topic}` : ''}</p>
          <div className="voices-prose mt-4 text-[15px] leading-relaxed text-ink-soft" dangerouslySetInnerHTML={{ __html: preview || '<p class="text-muted">Start writing to see a live preview…</p>' }} />
        </div>
      </div>
    </div>

      {formatPreview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" data-testid="voices-format-modal">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
              <div>
                <p className="text-sm font-black text-ink">✨ AI-formatted preview</p>
                <p className="text-xs text-muted">Same words, tidier structure — headings, emphasis and lists. Nothing was rewritten.</p>
              </div>
              <button type="button" onClick={() => setFormatPreview(null)} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-cream hover:text-ink">✕</button>
            </div>
            <div className="grid flex-1 grid-cols-1 overflow-auto md:grid-cols-2">
              <div className="border-b border-line p-5 md:border-b-0 md:border-r">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted">Your current draft</p>
                <div className="voices-prose text-[15px] leading-relaxed text-ink-soft" dangerouslySetInnerHTML={{ __html: renderPreview(content) || '<p class="text-muted">Empty</p>' }} />
              </div>
              <div className="bg-brand-50/30 p-5">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-brand-700">AI-formatted</p>
                <div className="voices-prose text-[15px] leading-relaxed text-ink-soft" dangerouslySetInnerHTML={{ __html: renderPreview(formatPreview) }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
              <button type="button" onClick={() => setFormatPreview(null)} data-testid="voices-format-discard" className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-soft hover:border-brand">Discard</button>
              <button type="button" onClick={acceptFormat} data-testid="voices-format-accept" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">Accept formatting</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
