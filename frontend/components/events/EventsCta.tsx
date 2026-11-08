import Image from 'next/image';
import Link from 'next/link';
import { Svg, ICON } from '@/components/ui/LineIcon';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

// Full-width closing band shared by event pages and the events directory.
// "Host an Event" starts the (sign-in gated) Create a Programme form.
export default function EventsCta({ showAll = true }: { showAll?: boolean }) {
  return (
    <section aria-labelledby="events-cta-title" className="relative -mb-24 overflow-hidden border-t border-line bg-cream" data-testid="events-cta">
      {/* Full-bleed closing band ends the page: -mb-24 cancels the site footer's top margin (same as /venues). */}
      <div className="relative h-40 sm:h-52 lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[36%]">
        <Image src="/brand/events/cta-mat.jpg" alt="" fill sizes="(min-width: 1024px) 36vw, 100vw" className="object-cover object-[30%_center]" />
        <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-l from-cream via-cream/30 to-transparent lg:block" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-cream to-transparent lg:hidden" />
      </div>
      <div className="container-x relative flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:justify-end lg:gap-10 lg:py-14">
        <div className="lg:max-w-[34rem]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent-600">More events, more opportunities</p>
          <h2 id="events-cta-title" className="mt-2 font-serif text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            Explore upcoming yoga events for founders, professionals and organisations.
          </h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          {showAll && (
            <Link href="/events" data-testid="events-cta-all"
              className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-7 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600 ${FOCUS}`}>
              View All Events <Svg d={ICON.arrow} className="h-5 w-5" />
            </Link>
          )}
          {/* Plain <a>: sign-in gated target. */}
          <a href="/app/org/events/new" data-testid="events-cta-host"
            className={`inline-flex min-h-[52px] items-center justify-center rounded-xl border border-ink/20 bg-white px-7 py-3 text-base font-bold text-ink transition hover:bg-brand-50 ${FOCUS}`}>
            Host an Event
          </a>
        </div>
      </div>
    </section>
  );
}
