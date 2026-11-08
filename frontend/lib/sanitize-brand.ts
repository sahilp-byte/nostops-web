// Display-time brand scrub. Some remote-generated copy (e.g. empanelment
// notifications) still references a legacy name ("YogaYukt" / "YOGAYUKT
// Council"). The remote is frozen, so we clean it on read across NOSTOPS.
// "YogaYukt Council" -> "Council of Gurus"; any other "YogaYukt" -> "NOSTOPS".
export function scrubBrand(text?: string | null): string {
  if (!text) return text ?? '';
  return text
    .replace(/yoga[\s-]?yukt(?:'s)?\s+council(?:\s+of\s+gurus)?/gi, 'Council of Gurus')
    .replace(/yoga[\s-]?yukt/gi, 'NOSTOPS');
}
