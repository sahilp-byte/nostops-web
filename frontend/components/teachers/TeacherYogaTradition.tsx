import Link from 'next/link';
import { getTeacherAffiliations, affiliationLabel, isAffiliationVerified, type TeacherAffiliation } from '@/lib/server/knowledge';
import { getPublicDirectory } from '@/lib/server/cities';
import { matchTeacherTraditions } from '@/lib/server/tradition-teachers';

// ADDITIVE, self-contained section for the public Teacher Profile. Renders the
// teacher's declared Yogic Paramparā affiliation(s) from the Knowledge Graph —
// each shown with an honest verification label, and NEVER as an unsupported
// "verified" claim. When the graph has no affiliation, it falls back to the
// teacher's SELF-DECLARED parampara/styles and links to the matching tradition
// knowledge page(s). Renders NOTHING when neither is available.
export default async function TeacherYogaTradition({ handle }: { handle: string }) {
  const { affiliations } = await getTeacherAffiliations(handle).catch(() => ({ affiliations: [] as TeacherAffiliation[] }));
  if (!affiliations || affiliations.length === 0) {
    // Fallback: self-declared tradition(s) → reciprocal link to the knowledge page.
    const dir = await getPublicDirectory().catch(() => []);
    const me = dir.find((t) => t.handle === handle);
    if (!me) return null;
    const traditions = await matchTeacherTraditions({ parampara: me.parampara, paramparas: me.paramparas, styles: me.styles }).catch(() => []);
    if (traditions.length === 0) return null;
    return (
      <section data-testid="teacher-yoga-tradition">
        <h2 className="text-xl font-extrabold tracking-tight">My Yoga Tradition</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {traditions.map((t) => (
            <Link key={t.slug} href={`/yoga-parampara/${t.slug}`} className="rounded-full border border-brand/20 bg-brand-50 px-3.5 py-1.5 text-sm font-bold text-brand-700 hover:border-brand">
              {t.name}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Shown from this teacher&apos;s self-declared tradition / style and linked to its NOSTOPS knowledge page; a self-declared affiliation is never presented as a verified lineage.
        </p>
      </section>
    );
  }

  return (
    <section data-testid="teacher-yoga-tradition">
      <h2 className="text-xl font-extrabold tracking-tight">My Yoga Tradition</h2>
      <div className="mt-4 space-y-4">
        {affiliations.map((a) => {
          const pp = a.parampara;
          const slug = pp?.slug;
          const name = pp?.display_name || pp?.canonical_name || 'Yoga tradition';
          const verified = isAffiliationVerified(a.verification_status);
          return (
            <div key={`${a.teacher_id}-${slug}`} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold tracking-tight text-ink">
                  {slug ? <Link href={`/yoga-parampara/${slug}`} className="text-brand-700 hover:underline">{name}</Link> : name}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${verified ? 'bg-brand-50 text-brand-700' : 'bg-cream text-ink-soft'}`}
                  title="Verification status"
                >
                  {affiliationLabel(a.relationship_type)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {pp?.classification && <Row k="Classification" v={pp.classification} />}
                {a.guru_name && <Row k="Guru / Ācārya" v={a.guru_name} />}
                {a.training_institution && <Row k="Training institution" v={a.training_institution} />}
                {typeof a.years_of_training === 'number' && a.years_of_training > 0 && <Row k="Years of training" v={String(a.years_of_training)} />}
                {a.certification && <Row k="Certification" v={a.certification} />}
                {Array.isArray(a.scriptures_studied) && a.scriptures_studied.length > 0 && <Row k="Scriptures studied" v={a.scriptures_studied.join(', ')} />}
                {Array.isArray(a.practices_taught) && a.practices_taught.length > 0 && <Row k="Practices transmitted" v={a.practices_taught.join(', ')} />}
              </dl>
              {!verified && (
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                  This affiliation is <strong>teacher-declared</strong> and has not been independently verified.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/60 py-1">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-semibold text-ink-soft">{v}</dd>
    </div>
  );
}
