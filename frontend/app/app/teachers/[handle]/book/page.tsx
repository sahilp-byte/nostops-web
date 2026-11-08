import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getTeacherProfile } from '@/lib/server/teacher-profile';
import { displayName } from '@/lib/roles';
import BookingForm from '@/components/app/learner/BookingForm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const p = await getTeacherProfile(handle);
  return {
    title: p ? `Book · ${p.name}` : 'Book a session',
    robots: { index: false, follow: false },
  };
}

export default async function BookSessionPage({ params }: Params) {
  const { handle } = await params;
  const [p, user] = await Promise.all([getTeacherProfile(handle), getSessionUser()]);
  if (!p) notFound();
  // No published 1:1 pricing -> nothing bookable; send back to the profile.
  if (!p.premium) redirect(`/app/teachers/${handle}`);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/app/teachers/${handle}`} className="text-sm font-bold text-brand-700 hover:underline">
        ‹ Back to {p.name.split(' ')[0]}
      </Link>
      <h1 className="mt-4 text-2xl font-black tracking-tight text-ink sm:text-3xl">Book a 1:1 session</h1>
      <p className="mt-2 text-ink-soft">with {p.name}</p>

      <div className="mt-6">
        <BookingForm
          teacherHandle={p.handle}
          teacherName={p.name}
          rateInr={p.premium.rateInr}
          durationMin={p.premium.durationMin}
          timeZone={p.timeZone}
          defaultName={displayName(user)}
          offers={p.offers}
        />
      </div>
    </div>
  );
}
