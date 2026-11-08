// Legal-entity block shared by /terms, /privacy and /refunds. Details are
// deliberately "[to be confirmed]" until the owner supplies them — never invent.
const ROWS: { label: string; value: string }[] = [
  { label: 'Legal entity', value: '[to be confirmed]' },
  { label: 'Registered address', value: '[to be confirmed]' },
  { label: 'Grievance Officer', value: '[to be confirmed]' },
  { label: 'Contact email', value: 'nostops.org@gmail.com' },
];

export default function LegalEntityNotice() {
  return (
    <section className="rounded-2xl border border-line bg-cream p-5" data-testid="legal-entity">
      <h2 className="text-lg font-extrabold text-ink">Who operates NOSTOPS</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
        {ROWS.map((r) => (
          <div key={r.label} className="contents">
            <dt className="font-semibold text-muted">{r.label}</dt>
            <dd className="text-ink-soft">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
