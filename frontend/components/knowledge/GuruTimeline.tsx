import Link from 'next/link';
import type { GuruNode, LineageChain, LineageStep } from '@/lib/server/knowledge';

// Server component. A vertical teacher-to-student transmission timeline:
// ancestors (oldest first) → the current guru (highlighted) → students → their
// students. Honest by design: traditional/debated links are labelled, not asserted.
function initialsOf(name: string): string {
  return (name || '').replace(/[^A-Za-zĀ-ſ ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'ॐ';
}

function Avatar({ url, name, size }: { url?: string; name: string; size: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full border border-line bg-cream object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-royal-50 font-black text-royal" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">{initialsOf(name)}</div>
  );
}

function Node({ step, tone, self }: { step?: LineageStep; tone: 'ancestor' | 'self' | 'student'; self?: GuruNode }) {
  const g = self || step!.guru;
  const isSelf = tone === 'self';
  return (
    <li className="relative pl-14">
      {/* dot on the spine */}
      <span
        className={`absolute left-0 top-1 flex items-center justify-center rounded-full ${isSelf ? 'ring-4 ring-brand/20' : ''}`}
        style={{ width: isSelf ? 44 : 36, height: isSelf ? 44 : 36, left: isSelf ? 2 : 6 }}
      >
        <Avatar url={g.portrait_url} name={g.canonical_name} size={isSelf ? 44 : 36} />
      </span>
      <div className={`rounded-xl border px-4 py-3 ${isSelf ? 'border-brand/40 bg-brand-50/60' : 'border-line bg-white'}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isSelf ? (
            <span className="text-base font-extrabold text-ink">{g.canonical_name}</span>
          ) : (
            <Link href={`/gurus/${g.slug}`} className="text-base font-extrabold text-ink hover:text-brand-700">{g.canonical_name}</Link>
          )}
          {isSelf && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">This page</span>}
          {g.period && <span className="text-xs text-muted">{g.period}</span>}
        </div>
        {!isSelf && step && (
          <p className="mt-0.5 text-xs text-muted">
            <span className="capitalize">{step.rel}</span>
            {step.confidence ? ` · confidence ${step.confidence}` : ''}
            {step.debated ? ' · traditional attribution' : ''}
          </p>
        )}
      </div>
    </li>
  );
}

export default function GuruTimeline({ current, chain }: { current: GuruNode; chain: LineageChain }) {
  const { ancestors, descendants } = chain;
  if (ancestors.length === 0 && descendants.length === 0) return null;

  return (
    <section data-testid="guru-timeline">
      <h2 className="text-xl font-extrabold tracking-tight">Lineage timeline (Paramparā)</h2>
      <p className="mt-2 text-sm text-muted">The teacher-to-student transmission — oldest first, flowing down through the generations.</p>

      <ol className="relative mt-6 list-none space-y-4 border-l-2 border-brand/20 p-0" style={{ marginLeft: 20 }}>
        {ancestors.map((s) => <Node key={`a-${s.guru.id}`} step={s} tone="ancestor" />)}
        <Node self={current} tone="self" />
        {descendants.flatMap((gen, gi) => [
          <li key={`cap-${gi}`} className="relative list-none pl-14 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{gi === 0 ? 'Students who carried it forward' : 'The next generation'}</p>
          </li>,
          ...gen.map((s) => <Node key={`d-${gi}-${s.guru.id}`} step={s} tone="student" />),
        ])}
      </ol>

      <p className="mt-4 text-xs text-muted">A guru–disciple link is shown only where historically supported. Traditional attributions are labelled and never presented as verified fact.</p>
    </section>
  );
}
