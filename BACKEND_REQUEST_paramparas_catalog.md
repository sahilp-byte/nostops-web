# Backend request — absorb the "Classical Paramparas of India & the Himalayas" catalog into /seo/paramparas

## Why
NOSTOPS shows a Paramparas directory (`/paramparas`) and per-lineage detail pages
(`/paramparas/{slug}`), both served from the backend (`/seo/paramparas`,
`/seo/parampara/{slug}`, `/seo/paramparas-index`). Teachers' declared parampara
values link to these pages.

To broaden coverage, the web app now ALSO renders a **frontend catalog** of
well-documented classical Indian & Himalayan lineages (informational only — not
implying Council empanelment). This request is to have the backend absorb these
so they become the single source of truth (with proper empanelment status,
member teachers, editorial control), after which the frontend catalog can be
retired for any slug the backend owns (frontend already prefers backend on slug
collision).

## What to add
Add the following lineages to `/seo/paramparas` (list) and `/seo/parampara/{slug}`
(detail). Slugs MUST match exactly so the frontend cutover is seamless and
existing teacher links keep working.

| slug | name | founder | seat | region |
|---|---|---|---|---|
| natha | Natha (Gorakhnath) Sampradaya | Matsyendranath & Gorakhnath | Gorakhpur (India) & Gorkha (Nepal) | Nepal/Himalaya |
| patanjala | Patanjala Yoga (Classical Raja Yoga) | Maharishi Patanjali | Textual (pan-India) | India |
| the-yoga-institute | The Yoga Institute (Yogendra Parampara) | Shri Yogendra | Santacruz, Mumbai | India |
| viniyoga | Viniyoga (Desikachar) | T.K.V. Desikachar | Chennai | India |
| kriya-yoga | Kriya Yoga (Yogananda) | Paramahansa Yogananda | Ranchi (YSS) / Los Angeles (SRF) | India |
| vivekananda | Ramakrishna–Vivekananda (Raja Yoga) | Swami Vivekananda | Belur Math, Kolkata | India |
| sri-aurobindo | Integral (Purna) Yoga — Sri Aurobindo | Sri Aurobindo & The Mother | Pondicherry | India |
| integral-yoga | Integral Yoga (Satchidananda) | Swami Satchidananda | Yogaville (Sivananda lineage) | India |
| kripalu | Kripalu Yoga | Swami Kripalvananda (Amrit Desai) | India → Kripalu Center | India |
| ananda-marga | Ananda Marga Yoga & Tantra | Shrii Shrii Anandamurti | Kolkata / Ananda Nagar | India |
| isha | Isha Yoga (Classical Hatha) | Sadhguru (Jaggi Vasudev) | Coimbatore | India |
| art-of-living | Art of Living (Sudarshan Kriya) | Sri Sri Ravi Shankar | Bengaluru | India |
| sri-vidya | Sri Vidya (Tantra Sadhana) | Shakta lineage | Pan-India | India |
| kundalini-yoga | Kundalini Yoga (Yogi Bhajan) | Yogi Bhajan | Punjab → 3HO | India |
| himalayan-tradition | Himalayan Tradition (Swami Rama) | Swami Rama | Himalayan Institute, Rishikesh | Nepal/Himalaya |
| gayatri-pariwar | Gayatri Pariwar (Dev Sanskriti) | Pandit Shriram Sharma Acharya | Shantikunj, Haridwar | India |

Full descriptions, characteristics, key texts, lineage words and teacher-matching
aliases (`aka`) are in the frontend source of truth:
`/app/frontend/lib/paramparas-catalog.ts` (each entry has `about`, `characteristics`,
`keyTexts`, `lineageWords`, `aka`). Copy those verbatim.

### Required detail fields per lineage (match existing `/seo/parampara/{slug}` shape)
- `meta.title`, `meta.description`
- `jsonld` including an `EducationalOrganization` (name, description, founder{Person}, location{Place}, keywords)
- `paramparas_index` (cross-link list) — already returned for existing lineages

### Teacher-value matching (`aka`)
Teacher `parampara` values are inconsistent (e.g. `hatha_classical`, `nath`,
`sri-sri`). Please normalise + map using the `aka` lists so a teacher resolves to
the right lineage slug (the frontend uses the same normalisation:
lowercase → non-alphanumeric to hyphen → trim).

## Framing / governance (important)
- These are **informational classical lineages**, NOT automatically
  "Council-empanelled." Please keep an empanelment flag distinct so the UI can
  show recognised vs informational appropriately. The frontend currently labels
  them under "Classical yoga paramparas of India & the Himalayas" with an explicit
  "does not imply Council empanelment" note.
- Do not overstate ("largest", "official") without authoritative backing.

## After you ship
No frontend change needed for cutover: for any slug the backend returns, the app
already prefers backend data over the catalog (deduped by slug). The catalog then
only covers whatever the backend hasn't absorbed yet.
