// PROMPT 25 — verified-facts FAQ (no AI, no invented answers). Rendered as a
// native <details> accordion so it works without client JS.
export default function RetreatFaq({ items }: { items: { q: string; a: string }[] }) {
  const faqs = items.filter((x) => x.q && x.a);
  if (faqs.length === 0) return null;
  return (
    <section id="faq" className="scroll-mt-20">
      <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Frequently asked</h2>
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" data-testid="retreat-faq">
        {faqs.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span aria-hidden className="shrink-0 text-muted transition group-open:rotate-45">+</span>
            </summary>
            <p className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
