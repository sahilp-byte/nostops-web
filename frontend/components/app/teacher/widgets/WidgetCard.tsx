'use client';

import type { ProfileVM, WidgetVM } from '@/lib/server/widgets';
import { initials } from '@/lib/format';
import ShareActions from './ShareActions';
import QrPoster from './QrPoster';
import EmailSignature from './EmailSignature';

const CAT_STYLE: Record<string, string> = {
  Identity: 'bg-indigo-50 text-indigo-700',
  Trust: 'bg-emerald-50 text-emerald-700',
  Discovery: 'bg-brand-50 text-brand-700',
  Students: 'bg-sky-50 text-sky-700',
  Organisations: 'bg-amber-50 text-amber-700',
  Distribution: 'bg-slate-100 text-slate-700',
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' },
  ready: { label: 'Ready to activate', cls: 'bg-amber-50 text-amber-700' },
  locked: { label: 'Locked', cls: 'bg-slate-100 text-slate-500' },
};

function IdentityPreview({ p, kind }: { p: ProfileVM; kind: WidgetVM['id'] }) {
  const designation = [p.tierBadge || 'Yoga Teacher', p.city].filter(Boolean).join(' · ');
  return (
    <div className="rounded-xl border border-line bg-gradient-to-br from-white to-cream/50 p-4">
      <div className="flex items-center gap-3">
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt={p.name} width={52} height={52} className="h-13 w-13 shrink-0 rounded-xl object-cover" style={{ height: 52, width: 52 }} />
        ) : (
          <div aria-hidden className="grid h-13 w-13 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg font-black text-brand-700" style={{ height: 52, width: 52 }}>
            {initials(p.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-ink">{p.name}</p>
          <p className="truncate text-xs text-muted">{designation}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {p.isEmpanelled && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">EMPANELLED</span>}
            {p.kycVerified && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">VERIFIED</span>}
            {p.rating ? <span className="text-[11px] font-bold text-ink-soft">★ {p.rating.toFixed(1)}{p.reviews ? ` (${p.reviews})` : ''}</span> : null}
          </div>
        </div>
      </div>
      {(kind === 'identity' || kind === 'profile') && p.styles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.styles.slice(0, 4).map((s) => (
            <span key={s} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line">{s}</span>
          ))}
        </div>
      )}
      {kind === 'organisation' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
          Available for company, educational-institution &amp; startup-network programmes · 3 / 6 / 12-month
        </p>
      )}
      {kind === 'book' && <p className="mt-3 text-[11px] font-bold text-brand-700">📅 Booking pathway → 1:1 sessions</p>}
      {kind === 'group' && <p className="mt-3 text-[11px] font-bold text-sky-700">👥 Group classes &amp; community sessions</p>}
      <a href={p.url || undefined} target="_blank" rel="noopener noreferrer" className="mt-3 block truncate text-[11px] font-bold text-brand-700 hover:underline">
        {p.url || 'Profile not live yet'}
      </a>
    </div>
  );
}

export default function WidgetCard({ widget: w, profile: p }: { widget: WidgetVM; profile: ProfileVM }) {
  const cat = CAT_STYLE[w.category] || 'bg-slate-100 text-slate-700';
  const st = STATUS_STYLE[w.status];
  const active = w.status === 'active';

  return (
    <article id={`widget-${w.id}`} className="flex flex-col rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid={`widget-${w.id}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cat}`}>{w.category}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`} data-testid={`widget-${w.id}-status`}>{st.label}</span>
      </div>
      <h3 className="mt-2 text-base font-black tracking-tight text-ink">{w.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{w.purpose}</p>

      {/* Preview */}
      <div className="mt-3">
        {w.id === 'qr' ? (
          active ? <QrPoster url={p.url} handle={p.handle} name={p.name} /> : null
        ) : w.id === 'email' ? (
          active ? <EmailSignature profile={p} /> : null
        ) : (
          <IdentityPreview p={p} kind={w.id} />
        )}
      </div>

      {/* Actions / gating */}
      {active && w.id !== 'qr' && w.id !== 'email' && (
        w.id === 'social' ? (
          <ShareActions url={w.url} title={`${p.name} · NOSTOPS`} message={w.shareText} channels={['copy', 'whatsapp', 'more']} social={['facebook', 'linkedin', 'x', 'instagram']} testid={`share-${w.id}`} />
        ) : (
          <ShareActions url={w.url} title={`${p.name} · NOSTOPS`} message={w.shareText} showQr testid={`share-${w.id}`} />
        )
      )}

      {!active && w.note && (
        <p className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${w.status === 'locked' ? 'bg-slate-50 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>
          🔒 {w.note}
        </p>
      )}
    </article>
  );
}
