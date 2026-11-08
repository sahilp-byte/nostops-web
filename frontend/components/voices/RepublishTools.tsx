'use client';

import { useState } from 'react';

// "Republish This Article" — appears only when an admin has enabled
// Available-for-Republication. Provides a copy-paste live embed snippet and a
// clean, attributed copy-article text. No NOSTOPS account is required to reuse.
type CopyPayload = {
  title: string;
  author: string;
  contentText: string;
  bio: string;
  articleUrl: string;
  profileUrl: string;
};

function CopyBtn({ getText, label, testid }: { getText: () => string; label: string; testid: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can still select the text manually */
    }
  }
  return (
    <button type="button" onClick={copy} data-testid={testid} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-600">
      {copied ? '✓ Copied' : label}
    </button>
  );
}

export default function RepublishTools({ slug, siteUrl, copy }: { slug: string; siteUrl: string; copy: CopyPayload }) {
  const [tab, setTab] = useState<'embed' | 'article'>('embed');

  const embedCode =
    `<div class="nostops-voices" data-slug="${slug}"></div>\n` +
    `<script src="${siteUrl}/voices/embed.js" async></script>`;

  const articleText =
    `${copy.title}\n` +
    `By ${copy.author}\n\n` +
    `${copy.contentText}\n\n` +
    `About the Author\n${copy.bio || copy.author}\n\n` +
    `Originally published on NOSTOPS\n` +
    `Original Article: ${copy.articleUrl}\n` +
    (copy.profileUrl ? `Author Profile: ${copy.profileUrl}\n` : '');

  const tabBtn = (t: 'embed' | 'article') =>
    `rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tab === t ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft hover:border-brand'}`;

  return (
    <section data-testid="republish-tools" className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
      <h2 className="text-base font-black text-ink">Republish This Article</h2>
      <p className="mt-1 text-sm text-ink-soft">
        This article is available for republication through NOSTOPS. No individual permission request is required, provided the
        author and NOSTOPS attribution and original-source link are retained.
      </p>

      <div className="mt-4 flex gap-2">
        <button type="button" className={tabBtn('embed')} onClick={() => setTab('embed')} data-testid="republish-tab-embed">Copy Embed Code</button>
        <button type="button" className={tabBtn('article')} onClick={() => setTab('article')} data-testid="republish-tab-article">Copy Article</button>
      </div>

      {tab === 'embed' ? (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">Paste this where you want the article to appear. It stays in sync with NOSTOPS automatically.</p>
          <pre data-testid="embed-code" className="overflow-x-auto rounded-xl border border-line bg-ink p-3 text-xs leading-relaxed text-cream"><code>{embedCode}</code></pre>
          <div className="mt-3"><CopyBtn getText={() => embedCode} label="Copy Embed Code" testid="copy-embed" /></div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">Clean, attribution-ready text for manual republication.</p>
          <pre data-testid="article-text" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-ink-soft">{articleText}</pre>
          <div className="mt-3"><CopyBtn getText={() => articleText} label="Copy Article" testid="copy-article" /></div>
        </div>
      )}
    </section>
  );
}
