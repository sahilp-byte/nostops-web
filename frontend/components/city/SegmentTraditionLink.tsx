import Link from 'next/link';
import { resolveTraditionKgSlug, getParampara, traditionKindLabel, isModern } from '@/lib/server/knowledge';

// ADDITIVE enrichment for tradition combination pages (e.g. Mumbai + Iyengar):
// links the page into the Knowledge Graph tradition entry, adding unique
// editorial context so the combo page is richer and not thin/duplicative.
// Renders nothing when the segment doesn't map to a known tradition.
export default async function SegmentTraditionLink({ segment, label, cityLabel }: { segment: string; label: string; cityLabel: string }) {
  const kgSlug = resolveTraditionKgSlug(segment) || resolveTraditionKgSlug(label);
  if (!kgSlug) return null;
  const d = await getParampara(kgSlug).catch(() => null);
  if (!d) return null;
  const p = d.parampara;

  return (
    <section className="container-x pb-6" data-testid="segment-tradition-kg">
      <div className="rounded-2xl border border-line bg-gradient-to-br from-royal-50/60 to-brand-50/40 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">The tradition behind it</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isModern(p.classification) ? 'bg-accent/15 text-accent-700' : 'bg-royal-50 text-royal'}`}>
            {traditionKindLabel(p.classification)}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink">
          About the {p.display_name} tradition
        </h2>
        {p.description && <p className="mt-2 max-w-3xl leading-relaxed text-ink-soft">{p.description}</p>}
        <p className="mt-3 text-sm text-muted">
          {titleWord(label)} teachers in {cityLabel} draw on this tradition. Explore its history, gurus, texts and practices:
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
          <Link href={`/yoga-parampara/${kgSlug}`} className="text-brand-700 hover:underline">Explore this tradition →</Link>
          <Link href={`/yoga-parampara/${kgSlug}#teachers`} className="text-ink-soft hover:text-brand-700">Meet teachers from this tradition →</Link>
        </div>
      </div>
    </section>
  );
}

function titleWord(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
