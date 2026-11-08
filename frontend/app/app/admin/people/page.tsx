import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getPeople } from '@/lib/server/admin-people';
import PeopleManager from '@/components/app/admin/PeopleManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · People Manager', robots: { index: false, follow: false } };

export default async function AdminPeoplePage() {
  await requireAdminUser();
  const data = await getPeople();

  const kpis = [
    { label: 'Teachers', value: data.counts.teachers },
    { label: 'Council gurus', value: data.counts.council },
    { label: 'Suspended', value: data.counts.suspended, tone: data.counts.suspended > 0 ? 'text-amber-700' : 'text-ink' },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">People Manager</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Moderate teachers and council gurus. Suspend an account for a set period with a reason, or reinstate a
        previously suspended member.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${k.tone ?? 'text-ink'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <PeopleManager teachers={data.teachers} council={data.council} />
      </div>
    </div>
  );
}
