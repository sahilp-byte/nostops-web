// Frontend catalog of classical yoga paramparas of India & the Himalayas.
//
// The authoritative parampara list is owned by the (frozen) backend
// (/seo/paramparas). This catalog is an ADDITIVE, informational reference so the
// /paramparas index and detail pages can present well-documented classical
// lineages that the backend does not (yet) carry — WITHOUT implying NOSTOPS
// Council empanelment. When the backend later absorbs these (see
// /app/BACKEND_REQUEST_paramparas_catalog.md), backend entries take precedence.
//
// Each entry has real, substantive content (about / characteristics / key texts /
// lineage) so a detail page is never thin. `aka` lists let a teacher's declared
// parampara value resolve to the right page.

export type CatalogParampara = {
  slug: string;
  name: string;
  short: string;
  founder?: string;
  seat?: string;
  region: 'India' | 'Nepal / Himalaya';
  about: string[];
  characteristics: string[];
  keyTexts?: string[];
  lineageWords?: string;
  /** Aliases (any form) a teacher's `parampara` value might use. */
  aka?: string[];
};

export const PARAMPARA_CATALOG: CatalogParampara[] = [
  {
    slug: 'natha',
    name: 'Natha (Gorakhnath) Sampradaya',
    short: 'The ascetic yogic order credited with systematising Hatha Yoga — the foundation of physical yoga practice.',
    founder: 'Matsyendranath & Gorakhnath',
    seat: 'Gorakhpur (India) & Gorkha (Nepal)',
    region: 'Nepal / Himalaya',
    about: [
      'The Natha Sampradaya is the ancient order of yogī-ascetics that codified Haṭha Yoga — the disciplines of āsana, prāṇāyāma, bandha and mudrā through which the body is prepared for higher states. Its two great masters, Matsyendranath and his disciple Gorakhnath, are revered across India and Nepal; the town of Gorkha (from which Nepal takes its name) is named for Gorakhnath.',
      'Almost every modern school of postural yoga descends, directly or indirectly, from the Haṭha lineage the Nathas preserved and transmitted.',
    ],
    characteristics: ['Hatha Yoga', 'Asana & Pranayama', 'Bandhas & Mudras', 'Kundalini & Nadi', 'Ascetic sadhana'],
    keyTexts: ['Hatha Yoga Pradipika', 'Gheranda Samhita', 'Siddha Siddhanta Paddhati'],
    lineageWords: 'Adinath → Matsyendranath → Gorakhnath',
    aka: ['nath', 'natha', 'hatha', 'hatha-classical', 'hatha_classical', 'hatha-yoga', 'gorakhnath', 'gorakshanath'],
  },
  {
    slug: 'patanjala',
    name: 'Patanjala Yoga (Classical Raja Yoga)',
    short: 'The classical eight-limbed (Ashtanga) yoga codified by Maharishi Patanjali in the Yoga Sutras.',
    founder: 'Maharishi Patanjali',
    seat: 'Textual tradition (pan-India)',
    region: 'India',
    about: [
      'Patanjala Yoga is the philosophical bedrock of the whole tradition: Patanjali\u2019s Yoga Sutras define yoga as citta-vṛtti-nirodhaḥ — the stilling of the mind — and lay out the eight limbs (yama, niyama, āsana, prāṇāyāma, pratyāhāra, dhāraṇā, dhyāna, samādhi).',
      'It is less a "style" than the shared grammar to which nearly every lineage refers when it speaks of the path of yoga.',
    ],
    characteristics: ['Eight limbs (Ashtanga)', 'Meditation (Dhyana)', 'Ethical foundations', 'Samadhi', 'Yoga philosophy'],
    keyTexts: ['Patanjali Yoga Sutras'],
    aka: ['patanjala', 'patanjali', 'classical-yoga', 'raja', 'ashtanga-raja'],
  },
  {
    slug: 'the-yoga-institute',
    name: 'The Yoga Institute (Yogendra Parampara)',
    short: 'The world\u2019s oldest organised yoga centre (est. 1918), pioneering yoga for the householder.',
    founder: 'Shri Yogendra',
    seat: 'Santacruz, Mumbai',
    region: 'India',
    about: [
      'Founded in 1918 by Shri Yogendra, The Yoga Institute in Mumbai is widely regarded as the oldest organised yoga centre in the world. It brought yoga out of seclusion and adapted it for ordinary householders and for health.',
      'Its approach blends classical practice with therapeutic application and structured yoga education for teachers and families.',
    ],
    characteristics: ['Householder yoga', 'Therapeutic yoga', 'Classical Hatha', 'Yoga education'],
    aka: ['yogendra', 'the-yoga-institute', 'yoga-institute'],
  },
  {
    slug: 'viniyoga',
    name: 'Viniyoga (Desikachar)',
    short: 'Krishnamacharya\u2019s later teaching, adapting practice to the individual — breath-led and therapeutic.',
    founder: 'T.K.V. Desikachar',
    seat: 'Chennai',
    region: 'India',
    about: [
      'Viniyoga is the individualised, breath-centred approach developed from the later teaching of Tirumalai Krishnamacharya and carried forward by his son T.K.V. Desikachar. Practice is adapted to the person — their age, health, and goals — rather than the person to a fixed method.',
      'It is especially influential in yoga therapy and in vinyāsa-krama (intelligently sequenced) practice.',
    ],
    characteristics: ['Individualised practice', 'Breath-centred asana', 'Yoga therapy', 'Vinyasa krama'],
    aka: ['viniyoga', 'desikachar', 'kym'],
  },
  {
    slug: 'kriya-yoga',
    name: 'Kriya Yoga (Yogananda)',
    short: 'The meditative Kriya lineage brought to the world by Paramahansa Yogananda.',
    founder: 'Paramahansa Yogananda',
    seat: 'Ranchi (YSS) · Los Angeles (SRF)',
    region: 'India',
    about: [
      'Kriya Yoga is a lineage of pranayama-based meditation revived by Lahiri Mahasaya and made known worldwide by Paramahansa Yogananda through Autobiography of a Yogi. It emphasises inner energisation and God-realisation.',
      'It is stewarded by Yogoda Satsanga Society of India (YSS) and the Self-Realization Fellowship (SRF).',
    ],
    characteristics: ['Kriya pranayama', 'Meditation', 'Energisation', 'Self-realisation'],
    lineageWords: 'Mahavatar Babaji → Lahiri Mahasaya → Sri Yukteswar → Paramahansa Yogananda',
    aka: ['kriya', 'kriya-yoga', 'yogananda', 'srf', 'yss'],
  },
  {
    slug: 'vivekananda',
    name: 'Ramakrishna–Vivekananda (Raja Yoga)',
    short: 'The Raja Yoga and four-paths teaching of Swami Vivekananda, rooted in Sri Ramakrishna.',
    founder: 'Swami Vivekananda',
    seat: 'Belur Math, Kolkata',
    region: 'India',
    about: [
      'Swami Vivekananda\u2019s Raja Yoga reintroduced Patanjali\u2019s meditative path to the modern world and framed yoga within the four complementary paths — karma, bhakti, jnana and raja.',
      'The tradition, rooted in his master Sri Ramakrishna, is carried by the Ramakrishna Math and Mission with its emphasis on meditation and selfless service (seva).',
    ],
    characteristics: ['Raja Yoga', 'Four paths of yoga', 'Vedanta', 'Meditation', 'Seva'],
    aka: ['vivekananda', 'ramakrishna', 'ramakrishna-mission'],
  },
  {
    slug: 'sri-aurobindo',
    name: 'Integral (Purna) Yoga — Sri Aurobindo',
    short: 'The yoga of integral self-transformation taught by Sri Aurobindo and The Mother at Pondicherry.',
    founder: 'Sri Aurobindo & The Mother',
    seat: 'Pondicherry',
    region: 'India',
    about: [
      'Sri Aurobindo\u2019s Purna (Integral) Yoga seeks the transformation of the whole being — not withdrawal from life but the descent of a higher consciousness into everyday living.',
      'It synthesises the classical paths and is stewarded from the Sri Aurobindo Ashram in Pondicherry.',
    ],
    characteristics: ['Integral (Purna) Yoga', 'Self-transformation', 'Synthesis of yoga', 'Supramental aspiration'],
    aka: ['aurobindo', 'sri-aurobindo', 'purna-yoga', 'integral-purna'],
  },
  {
    slug: 'integral-yoga',
    name: 'Integral Yoga (Satchidananda)',
    short: 'The holistic, interfaith Integral Yoga of Swami Satchidananda, in the Sivananda stream.',
    founder: 'Swami Satchidananda',
    seat: 'Yogaville (Sivananda lineage)',
    region: 'India',
    about: [
      'A disciple of Swami Sivananda, Swami Satchidananda taught an "Integral Yoga" combining hatha, breathwork, meditation and selfless service, with a strong interfaith emphasis ("Truth is One, Paths are Many").',
      'It is distinct from Sri Aurobindo\u2019s Integral Yoga though it shares the name.',
    ],
    characteristics: ['Hatha + meditation', 'Interfaith', 'Holistic living', 'Sivananda stream'],
    aka: ['satchidananda', 'integral-yoga'],
  },
  {
    slug: 'kripalu',
    name: 'Kripalu Yoga',
    short: 'A meditative, prana-led practice of compassionate self-observation.',
    founder: 'Swami Kripalvananda (Amrit Desai)',
    seat: 'India → Kripalu Center',
    region: 'India',
    about: [
      'Kripalu Yoga, named for Swami Kripalvananda and popularised by Yogi Amrit Desai, treats āsana as "meditation in motion" — allowing prāṇa to guide the practice while the practitioner witnesses with non-judgemental awareness.',
    ],
    characteristics: ['Meditation-in-motion', 'Prana-led practice', 'Compassionate self-observation', 'Inner focus'],
    aka: ['kripalu', 'kripalvananda'],
  },
  {
    slug: 'ananda-marga',
    name: 'Ananda Marga Yoga & Tantra',
    short: 'A yoga-and-tantra path of meditation and service founded by Shrii Shrii Anandamurti.',
    founder: 'Shrii Shrii Anandamurti (P.R. Sarkar)',
    seat: 'Kolkata / Ananda Nagar',
    region: 'India',
    about: [
      'Ananda Marga ("Path of Bliss") teaches a systematic tantric meditation (Sahaja Yoga) alongside āsanas and the devotional dances Kaoshiki and Tandava, all set within a philosophy of Neohumanism and universal service.',
    ],
    characteristics: ['Tantra yoga', 'Meditation (Sahaja)', 'Asanas + Kaoshiki/Tandava', 'Neohumanism', 'Service'],
    aka: ['ananda-marga', 'anandamarga', 'ananda-marg'],
  },
  {
    slug: 'isha',
    name: 'Isha Yoga (Classical Hatha)',
    short: 'Classical Hatha Yoga and inner-engineering practices offered by the Isha Foundation.',
    founder: 'Sadhguru (Jaggi Vasudev)',
    seat: 'Coimbatore',
    region: 'India',
    about: [
      'The Isha Foundation offers classical Haṭha Yoga (including Surya Kriya and Angamardana) and meditative practices such as Shambhavi Mahamudra, framed within Sadhguru\u2019s "Inner Engineering" programmes.',
    ],
    characteristics: ['Classical Hatha', 'Inner Engineering', 'Surya Kriya', 'Shambhavi Mahamudra'],
    aka: ['isha', 'isha-yoga', 'sadhguru'],
  },
  {
    slug: 'art-of-living',
    name: 'Art of Living (Sudarshan Kriya)',
    short: 'Breath-based wellbeing centred on the Sudarshan Kriya, taught by the Art of Living.',
    founder: 'Gurudev Sri Sri Ravi Shankar',
    seat: 'Bengaluru',
    region: 'India',
    about: [
      'The Art of Living is best known for the Sudarshan Kriya — a rhythmic breathing practice — supported by prāṇāyāma, meditation and yoga, aimed at stress relief and emotional wellbeing.',
    ],
    characteristics: ['Sudarshan Kriya', 'Pranayama', 'Meditation', 'Breath-based wellbeing'],
    aka: ['art-of-living', 'sri-sri', 'sudarshan-kriya', 'aol'],
  },
  {
    slug: 'sri-vidya',
    name: 'Sri Vidya (Tantra Sadhana)',
    short: 'The Shakta tantric lineage of Devi worship, mantra and Sri Yantra upasana.',
    founder: 'Traditional (Shakta lineage)',
    seat: 'Pan-India (Shakta seats)',
    region: 'India',
    about: [
      'Sri Vidya is a revered Shakta tantric tradition centred on the worship of the Divine Mother through the Sri Yantra, mantra japa and refined ritual (upāsana). It integrates mantra, yantra and meditation to awaken inner energy.',
    ],
    characteristics: ['Sri Yantra upasana', 'Mantra sadhana', 'Kundalini', 'Devi worship', 'Tantra'],
    keyTexts: ['Saundarya Lahari', 'Lalita Sahasranama'],
    aka: ['sri-vidya', 'srividya', 'shakta', 'shri-vidya'],
  },
  {
    slug: 'kundalini-yoga',
    name: 'Kundalini Yoga (as taught by Yogi Bhajan)',
    short: 'A vigorous practice of kriyas, breath, mantra and meditation to awaken kundalini energy.',
    founder: 'Yogi Bhajan (Harbhajan Singh Khalsa)',
    seat: 'Punjab roots → 3HO (worldwide)',
    region: 'India',
    about: [
      'Rooted in Punjab and tantric-Sikh influences, the Kundalini Yoga popularised by Yogi Bhajan combines dynamic kriyās, breath (including Breath of Fire), mantra and meditation to awaken and channel kuṇḍalinī energy.',
      'It was largely spread internationally through the 3HO organisation.',
    ],
    characteristics: ['Kriyas', 'Breath of Fire', 'Mantra', 'Meditation', 'Kundalini awakening'],
    aka: ['kundalini', 'kundalini-yoga', '3ho'],
  },
  {
    slug: 'himalayan-tradition',
    name: 'Himalayan Tradition (Swami Rama)',
    short: 'The meditative Himalayan yoga-and-Sankhya tradition brought forward by Swami Rama.',
    founder: 'Swami Rama',
    seat: 'Himalayan Institute · Rishikesh / Himalaya',
    region: 'Nepal / Himalaya',
    about: [
      'The Himalayan Tradition, carried by Swami Rama of the Himalayan Institute, transmits a lineage of meditation, yoga nidra and prāṇāyāma grounded in Sankhya-Yoga philosophy — the contemplative yoga of the Himalayan cave masters.',
      'It emphasises systematic meditation leading toward the superconscious state.',
    ],
    characteristics: ['Meditation', 'Yoga Nidra', 'Pranayama', 'Sankhya-Yoga philosophy', 'Superconscious meditation'],
    aka: ['himalayan', 'himalayan-tradition', 'swami-rama', 'ahymsin'],
  },
  {
    slug: 'gayatri-pariwar',
    name: 'Gayatri Pariwar (Dev Sanskriti)',
    short: 'A Vedic-revival tradition of Gayatri sadhana, yagya and self-refinement.',
    founder: 'Pandit Shriram Sharma Acharya',
    seat: 'Shantikunj, Haridwar',
    region: 'India',
    about: [
      'The Gayatri Pariwar, founded by Pandit Shriram Sharma Acharya at Shantikunj (Haridwar), centres on Gayatri mantra sādhana, yajña, prāṇāyāma and a programme of self-refinement rooted in a modern revival of Vedic culture.',
    ],
    characteristics: ['Gayatri sadhana', 'Yagya', 'Pranayama', 'Self-refinement', 'Vedic revival'],
    aka: ['gayatri', 'gayatri-pariwar', 'dev-sanskriti', 'shriram-sharma', 'shantikunj'],
  },
];

const norm = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// alias → canonical catalog slug
const ALIAS_TO_SLUG: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const p of PARAMPARA_CATALOG) {
    m.set(norm(p.slug), p.slug);
    for (const a of p.aka ?? []) m.set(norm(a), p.slug);
  }
  return m;
})();

const BY_SLUG: Map<string, CatalogParampara> = new Map(PARAMPARA_CATALOG.map((p) => [p.slug, p]));

export function getCatalogParampara(slug: string): CatalogParampara | undefined {
  return BY_SLUG.get(slug);
}

export function catalogSlugs(): string[] {
  return PARAMPARA_CATALOG.map((p) => p.slug);
}

/** Resolve any teacher `parampara` value (varied casing/underscores) to a catalog slug, or null. */
export function matchCatalogSlug(raw: string): string | null {
  if (!raw) return null;
  return ALIAS_TO_SLUG.get(norm(raw)) ?? null;
}
