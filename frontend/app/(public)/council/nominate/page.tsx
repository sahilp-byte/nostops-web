import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { getSessionUser } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';
import NominateGuruForm from '@/components/council/NominateGuruForm';

// Guru Nominations (Phase 1). Owner decision: only signed-in members may nominate.
export const dynamic = 'force-dynamic';

const PATH = '/council/nominate';
const TITLE = 'Nominate a Guru to the Council';
const DESC =
  'Know a living Guru whose teaching, lineage and conduct belong on the NOSTOPS Council of Yoga Gurus? Signed-in members can nominate them. Nothing is published without the Guru’s consent.';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: TITLE, description: DESC, path: PATH });
}

const STEPS = [
  { t: 'You nominate', d: 'Tell us about a living Guru you know.' },
  { t: 'NOSTOPS reviews', d: 'We may write to you with a question first.' },
  { t: 'The Council decides', d: 'The Council of Yoga Gurus considers the nomination.' },
  { t: 'We invite the Guru', d: 'Only if the Council approves.' },
  { t: 'Published with consent', d: 'Their Council profile appears only after they agree.' },
];

export default async function NominateGuruPage() {
  const user = await getSessionUser();

  return (
    <main>
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Council of Yoga Gurus', path: '/council' }, { name: 'Nominate a Guru', path: PATH }]} />
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/council" className="hover:text-brand-700">Council</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Nominate a Guru</span>
        </div>
      </nav>

      <PageHero
        eyebrow="Council of Gurus"
        title="Nominate a Guru"
        subtitle="Know a living Guru whose teaching, lineage and conduct belong on the Council of Yoga Gurus? Tell us about them."
      />

      <section className="container-x grid gap-8 py-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {user ? (
            <NominateGuruForm nominator={{ name: displayName(user), email: String(user.email || '') }} />
          ) : (
            <div data-testid="nominate-signin" className="card p-6 md:p-8">
              <h2 className="text-2xl font-extrabold tracking-tight">Sign in to nominate a Guru</h2>
              <p className="mt-2 text-muted">
                Nominations come from signed-in members, so the NOSTOPS team can follow up with you and you can track
                every step from your dashboard.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/login?next=${encodeURIComponent(PATH)}`} data-testid="nominate-signin-link" className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
                  Sign in
                </Link>
                <Link href="/register" className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">
                  Create a free account
                </Link>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="card p-6" data-testid="nominate-how">
            <h2 className="text-lg font-extrabold tracking-tight">How nominations work</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-black text-white">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-ink">{s.t}</p>
                    <p className="text-sm text-muted">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-extrabold tracking-tight">What stays private</h2>
            <p className="mt-2 text-sm text-muted">
              Your details, your reasons and the Guru&apos;s contact details are seen only by the NOSTOPS team and the
              Council. They are never published on the website.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
