// Prompt 2C — what a buyer outside India can do instead of a hold (founder decisions): message the
// host on WhatsApp. Where the host is known, the number is looked up server-side; with no published
// number (or no known host) WhatsApp opens with the message only. Nothing is reserved. The retreat
// waitlist is offered only when a retreat is sold out (the existing sold-out form, not here).
const intlText = (what: string) =>
  `Namaste, I'd like to book ${what} on NOSTOPS, but my billing address is outside India. Could you help?`;

export const retreatHostHref = (retreatId: string, title: string) =>
  `/bff/retreats/${encodeURIComponent(retreatId)}/ask-whatsapp?text=${encodeURIComponent(intlText(`"${title}"`))}`;

export const teacherHostHref = (handle: string, teacherName: string) =>
  `/bff/teachers/${encodeURIComponent(handle)}/ask-whatsapp?text=${encodeURIComponent(intlText(`a 1:1 session with ${teacherName}`))}`;

/** No host number is available to the website for these (paid events, group batches). */
export const plainHostHref = (what: string) => `https://wa.me/?text=${encodeURIComponent(intlText(what))}`;

export default function HoldAlternatives({
  askHref,
  askLabel = 'Message the host',
  testId = 'hold-alternatives',
}: {
  askHref: string;
  askLabel?: string;
  testId?: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid={testId}>
      <a
        href={askHref}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`${testId}-message`}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:border-brand"
      >
        💬 {askLabel}
      </a>
    </div>
  );
}
