import Link from 'next/link';

// PROMPT 28 — "Yoga se kya hoga?" signature component. The answer is ALWAYS the
// teacher's own words (never auto-generated marketing). Rendered only when the
// teacher has provided it; otherwise the section is hidden.
export default function YogaSeKyaHoga({
  text,
  teacherName,
  teacherHandle,
}: {
  text: string;
  teacherName?: string;
  teacherHandle?: string | null;
}) {
  if (!text || !text.trim()) return null;
  return (
    <section id="yoga-se-kya-hoga" className="scroll-mt-20">
      <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-brand-50/70 to-cream p-6 sm:p-9" data-testid="yoga-se-kya-hoga">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">A question worth sitting with</p>
        <p className="mt-2 text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">योग से क्या होगा?</p>
        <p className="mt-0.5 text-sm font-semibold text-muted">Yoga se kya hoga? — what will yoga do for you?</p>
        <blockquote className="mt-5 whitespace-pre-line text-lg leading-relaxed text-ink-soft sm:text-xl">{text.trim()}</blockquote>
        {teacherName && (
          <figcaption className="mt-4 text-sm font-black text-ink">
            — {teacherHandle ? (
              <Link href={`/teachers/${teacherHandle}`} className="hover:underline">{teacherName}</Link>
            ) : teacherName}
            <span className="ml-1 font-semibold text-muted">in their own words</span>
          </figcaption>
        )}
      </div>
    </section>
  );
}
