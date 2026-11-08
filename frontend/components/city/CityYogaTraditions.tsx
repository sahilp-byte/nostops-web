import Link from 'next/link';
import { getCityParamparas, isModern } from '@/lib/server/knowledge';

// ADDITIVE "Yoga Traditions in [City]" section. Data-driven from the Knowledge
// Graph: shows ONLY traditions that have actual NOSTOPS teacher inventory in the
// city (teacher_count > 0). Renders nothing when there is no inventory — so no
// thin/empty section is ever produced. Each tradition links to its Paramparā
// knowledge page and to the city's teacher results.
export default async function CityYogaTraditions({ city, cityLabel }: { city: string; cityLabel: string }) {
  const traditions = await getCityParamparas(city).catch(() => []);
  if (!traditions.length) return null;

  return (
    <section className="container-x py-12 md:py-14" data-testid="city-yoga-traditions">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Living traditions</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Yoga Traditions in {cityLabel}</h2>
        <p className="mt-2 text-muted">
          The lineages and methods that {cityLabel} teachers on NOSTOPS carry. Explore each tradition&apos;s history,
          gurus, texts and practices — or meet the teachers who transmit it here.
        </p>
      </div>
      <ul className="mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {traditions.map((t) => {
          const name = t.display_name || t.canonical_name || t.slug;
          return (
            <li key={t.id} className="card flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/yoga-parampara/${t.slug}`} className="text-base font-extrabold tracking-tight text-ink hover:text-brand-700">{name}</Link>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isModern(t.classification) ? 'bg-accent/15 text-accent-700' : 'bg-royal-50 text-royal'}`}>
                  {isModern(t.classification) ? 'Modern' : 'Historical'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{t.teacher_count} teacher{t.teacher_count === 1 ? '' : 's'} in {cityLabel}</p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 text-sm font-bold">
                <Link href={`/yoga-parampara/${t.slug}`} className="text-brand-700 hover:underline">Explore tradition →</Link>
                <Link href="#teachers" className="text-ink-soft hover:text-brand-700">Meet teachers →</Link>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">Traditions shown reflect what teachers have declared; affiliations are reviewed, not auto-verified.</p>
    </section>
  );
}
