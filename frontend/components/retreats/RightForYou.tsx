// PROMPT 25 — "Is this retreat right for you?" Combines the teacher's declared
// audience (verified data) with an optional AI "who may enjoy it" line, clearly
// labelled so it isn't mistaken for the teacher's own words.
export default function RightForYou({
  audienceTags,
  whoEnjoys,
}: {
  audienceTags: string[];
  whoEnjoys?: string;
}) {
  if (audienceTags.length === 0 && !whoEnjoys) return null;
  return (
    <section id="right-for-you" className="scroll-mt-20">
      <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Is this retreat right for you?</h2>
      <div className="mt-4 rounded-2xl border border-line bg-white p-5">
        {audienceTags.length > 0 && (
          <>
            <p className="text-xs font-black uppercase tracking-wide text-muted">The teacher designed this for</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {audienceTags.map((t) => (
                <span key={t} className="rounded-full bg-cream px-3.5 py-1.5 text-sm font-medium capitalize text-ink-soft">{t}</span>
              ))}
            </div>
          </>
        )}
        {whoEnjoys && (
          <div className={audienceTags.length > 0 ? 'mt-4 border-t border-line pt-4' : ''}>
            <span className="inline-block rounded-full bg-royal/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-royal">AI interpretation</span>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{whoEnjoys}</p>
          </div>
        )}
      </div>
    </section>
  );
}
