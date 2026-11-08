import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { listParamparas } from '@/lib/server/knowledge';
import { requireOnboardedTeacher } from '@/lib/server/teacher';
import DeclareTraditionForm from '@/components/app/teacher/DeclareTraditionForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Yoga Tradition', robots: { index: false, follow: false } };

export default async function TeacherTraditionPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');
  await requireOnboardedTeacher();
  const paramparas = (await listParamparas()).map((p) => ({ slug: p.slug, id: p.id, name: p.display_name, classification: p.classification }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight text-ink">My Yoga Tradition</h1>
      <p className="mt-2 text-sm text-muted">
        Declare the Paramparā / lineage you practise. Your submission is recorded as <strong>teacher-declared</strong> and
        enters a review queue — NOSTOPS never marks a lineage as &ldquo;Verified&rdquo; automatically. Adding this is
        optional and does not affect the rest of your profile.
      </p>
      <div className="mt-6">
        <DeclareTraditionForm paramparas={paramparas} />
      </div>
    </main>
  );
}
