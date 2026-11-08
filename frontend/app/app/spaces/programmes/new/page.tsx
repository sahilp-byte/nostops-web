import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { listProgrammes } from '@/lib/server/institutional';
import { getMySpaceProgrammes } from '@/lib/server/space-programmes';
import SpaceProgrammeForm from '@/components/spaces/SpaceProgrammeForm';
import { SpacesPageHeader, SpEmpty, SpIcon, SpNote, SpStepper } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'New Space Programme', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function NewSpaceProgrammePage({ searchParams }: { searchParams: Promise<{ enquiry?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/app/spaces/programmes');
  const role = normalizeRole(user.role);  // raw backend role 'guru' maps to 'council'
  if (role !== 'teacher' && role !== 'council') redirect('/app/spaces/programmes');
  const { enquiry } = await searchParams;
  const [mine, cat] = await Promise.all([getMySpaceProgrammes(), listProgrammes()]);
  const enq = mine.accepted_enquiries.find((a) => a.id === enquiry);
  if (!enq) notFound();
  const programmes = (cat?.programmes || []).filter((p) => enq.taxonomies.includes(p.taxonomy))
    .map((p) => ({ programme_id: p.programme_id, name: p.name, taxonomy: p.taxonomy }));
  return (
    <div className="mx-auto max-w-6xl" data-testid="sp-new-page">
      <div className="space-y-4">
        <SpacesPageHeader crumbs={[{ label: 'My Programmes', href: '/app/spaces/programmes' }, { label: 'Create Programme' }]} title="Create Programme (in Existing Event Engine)"
          subtitle={`New programme at ${enq.space_name} · from enquiry ${enq.ref} (accepted in principle). Focus areas: ${enq.taxonomies.join(', ')}.`}
          aside={<div className="sp-panel-green hidden items-center gap-3 px-5 py-3 lg:flex"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#22A447] text-white"><SpIcon name="check" className="h-7 w-7" strokeWidth={3} /></span><span><b className="block text-[18px] text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>Space Linked</b><span className="text-[14px]">Based on an accepted Space enquiry.</span></span></div>} />
        <SpStepper steps={['Select Programme Type', 'Programme Details', 'Review & Publish']} current={1} />
        {programmes.length ? <SpaceProgrammeForm init={{ space_id: enq.space_id, space_enquiry_id: enq.id, capacity: enq.participants }} programmes={programmes} />
          : <SpEmpty title="No matching programme">No Council programme matches this enquiry&apos;s focus areas.</SpEmpty>}
        <SpNote title="Important Note">You are creating the programme in the existing NOSTOPS event engine. The confirmed Space and agreed terms are carried forward automatically.</SpNote>
      </div>
    </div>
  );
}
