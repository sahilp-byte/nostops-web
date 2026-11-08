import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getEngineMeta, listProgrammes, listMyOrganisations, getEventOwner } from '@/lib/server/institutional';
import EventCreatorWizard from '@/components/app/org/events/EventCreatorWizard';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ cohort?: string; event?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const { cohort, event } = await searchParams;

  const [meta, cat, myOrgs, existing] = await Promise.all([
    getEngineMeta(),
    listProgrammes(),
    listMyOrganisations(user),
    event ? getEventOwner(user, event) : Promise.resolve(null),
  ]);

  const cohorts = meta?.cohorts || [
    { key: 'COMPANY', label: 'Company' },
    { key: 'EDUCATIONAL_INSTITUTION', label: 'Educational Institution' },
    { key: 'STARTUP_NETWORK', label: 'Startup & Networking Group' },
  ];
  const cities = meta?.launch_cities || [];
  const visibilities = meta?.event_visibility?.length ? ['PRIVATE', 'UNLISTED', 'PUBLIC'].filter((v) => meta.event_visibility.includes(v)) : ['PRIVATE', 'UNLISTED', 'PUBLIC'];
  const venueTypes = meta?.venue_types || [
    { key: 'EXISTING_SPACE', label: 'Existing organisation / community space' },
    { key: 'EXTERNAL_VENUE', label: 'Other (external) venue' },
  ];
  const timezones = meta?.timezones || ['Asia/Kolkata'];
  const defaultTimezone = meta?.default_timezone || 'Asia/Kolkata';
  const taxonomy = (cat?.taxonomy as any[]) || [
    { key: 'MIND', label: 'Mind', slug: 'mind' }, { key: 'BODY', label: 'Body', slug: 'body' }, { key: 'SPECIAL_NEEDS', label: 'Special Needs', slug: 'special-needs' },
  ];
  const byTaxonomy = (cat?.by_taxonomy as any) || { MIND: [], BODY: [], SPECIAL_NEEDS: [] };

  return (
    <div className="container-x py-6 sm:py-8">
      <EventCreatorWizard
        cohorts={cohorts}
        cities={cities}
        visibilities={visibilities}
        venueTypes={venueTypes}
        timezones={timezones}
        defaultTimezone={defaultTimezone}
        byTaxonomy={byTaxonomy}
        taxonomy={taxonomy}
        myOrgs={myOrgs as any}
        prefill={{ name: (user.name as string) || '', email: (user.email as string) || '' }}
        initialCohort={cohort || null}
        initialEvent={(existing?.event as any) || null}
        initialOrg={(existing?.organisation as any) || null}
      />
    </div>
  );
}
