// Renders one or more JSON-LD structured-data blocks server-side (in the initial HTML).

// Serialize to a string that is safe to embed inside an inline <script> tag.
// JSON.stringify alone does NOT escape HTML-breakout characters, so free-text
// fields (teacher name/bio, etc.) containing "</script>" or U+2028/U+2029 could
// terminate the tag and execute as markup. Escaping these to \uXXXX keeps the
// payload valid JSON while making tag-breakout impossible.
function safeJsonLd(d: unknown): string {
  return JSON.stringify(d)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function JsonLd({ data }: { data: any }) {
  if (!data) return null;
  const arr = Array.isArray(data) ? data : [data];
  return (
    <>
      {arr.filter(Boolean).map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(d) }}
        />
      ))}
    </>
  );
}
