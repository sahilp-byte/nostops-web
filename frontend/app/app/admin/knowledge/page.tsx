import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getReviewQueue, getAuditLog } from '@/lib/server/knowledge';
import { normalizeRole } from '@/lib/roles';
import KnowledgeReviewQueue from '@/components/app/admin/KnowledgeReviewQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Paramparā Verification', robots: { index: false, follow: false } };

export default async function AdminKnowledgePage() {
  const user = await requireAdminUser();
  const actor = { user_id: String(user.user_id || user.email || 'admin'), role: normalizeRole(user.role), email: user.email as string, name: user.name as string };
  const [pending, audit] = await Promise.all([getReviewQueue(actor), getAuditLog(actor, 25)]);
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight text-ink">Paramparā Affiliation — Verification Queue</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Teacher-declared Yogic Paramparā affiliations awaiting review. Verification is a manual, evidence-backed
        decision — a self-declared claim is never auto-promoted to a verified lineage. Unsupported claims can be rejected.
      </p>
      <div className="mt-6">
        <KnowledgeReviewQueue initial={pending} />
      </div>

      <h2 className="mt-12 text-lg font-black tracking-tight text-ink">Governance audit log</h2>
      <p className="mt-1 text-sm text-muted">Every create / edit / merge / archive / verify / reject is recorded (internal only).</p>
      <ul className="mt-4 list-none space-y-2 p-0">
        {audit.length === 0 ? (
          <li className="rounded-xl border border-line bg-white p-4 text-sm text-muted">No governance activity yet.</li>
        ) : audit.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white px-4 py-2 text-sm">
            <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-ink-soft">{a.action}</span>
            <span className="font-semibold text-ink">{a.entity}</span>
            <span className="text-muted">{a.entity_id}</span>
            <span className="ml-auto text-xs text-muted">{a.actor_name || a.actor} · {new Date(a.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
