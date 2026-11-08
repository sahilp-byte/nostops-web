import React from 'react';

// Minimal, safe markdown-lite renderer for Guru replies: **bold**, bullet &
// numbered lists, '---' dividers and paragraphs. No raw HTML is ever injected.
// Email addresses become tappable mailto links (e.g. the human-escalation email).
const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

function linkEmails(text: string, keyBase: string): React.ReactNode {
  return text.split(EMAIL_RE).map((s, i) =>
    i % 2 === 1 ? (
      <a key={`${keyBase}-e-${i}`} href={`mailto:${s}`} className="font-bold text-brand-700 underline">
        {s}
      </a>
    ) : (
      <React.Fragment key={`${keyBase}-t-${i}`}>{s}</React.Fragment>
    ),
  );
}

function renderInline(text: string, keyBase: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={`${keyBase}-${i}`} className="font-bold text-ink">
        {linkEmails(p.slice(2, -2), `${keyBase}-${i}`)}
      </strong>
    ) : (
      <React.Fragment key={`${keyBase}-${i}`}>{linkEmails(p, `${keyBase}-${i}`)}</React.Fragment>
    ),
  );
}

export function renderRich(text: string, keyBase: string): React.ReactNode {
  const lines = (text || '').split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];

  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={`${keyBase}-ul-${out.length}`} className="my-1.5 list-disc space-y-1 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b, `${keyBase}-li-${out.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  const flushOrdered = () => {
    if (ordered.length) {
      out.push(
        <ol key={`${keyBase}-ol-${out.length}`} className="my-1.5 list-decimal space-y-1 pl-5">
          {ordered.map((b, i) => (
            <li key={i}>{renderInline(b, `${keyBase}-oli-${out.length}-${i}`)}</li>
          ))}
        </ol>,
      );
      ordered = [];
    }
  };
  const flush = () => {
    flushBullets();
    flushOrdered();
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*---+\s*$/.test(line)) {
      flush();
      out.push(<hr key={`${keyBase}-hr-${idx}`} className="my-2 border-line" />);
      return;
    }
    const ub = line.match(/^\s*[-*]\s+(.*)$/);
    if (ub) {
      flushOrdered();
      bullets.push(ub[1]);
      return;
    }
    const ob = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ob) {
      flushBullets();
      ordered.push(ob[1]);
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
