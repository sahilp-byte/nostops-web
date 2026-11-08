// NOSTOPS evergreen pillar guides — the reusable editorial content system
// behind /guides and /guides/{slug}. Content is AI-assisted and published under
// the NOSTOPS Editorial Team for ongoing review. Every claim here reflects the
// platform's actual, teacher-first model; no rankings, cures or unverified
// statistics are asserted, and lineage/credentials are never inferred (the
// public teacher, city, Paramparā, retreat and venue pages remain the source of
// truth). Each guide links contextually to the real NOSTOPS pages it supports.

export type GuideFaq = { q: string; a: string };
export type GuideSection = { heading: string; body: string[]; bullets?: string[] };
export type GuideLink = { label: string; href: string };

export type Guide = {
  slug: string;
  topic: string;
  title: string;
  description: string;
  eyebrow: string;
  directAnswer: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
  related: GuideLink[];
  updated: string; // ISO date
};

export const GUIDE_REVIEWER = 'NOSTOPS Editorial Team';
const UPDATED = '2026-06-01';

export const GUIDES: Guide[] = [
  {
    slug: 'how-to-choose-a-yoga-teacher',
    topic: 'Finding a teacher',
    eyebrow: 'Guide · Choosing a teacher',
    title: 'How to Choose a Yoga Teacher',
    description:
      'A practical guide to choosing the right yoga teacher — match verified training and lineage to your goal, judge how they actually teach, and practise safely.',
    directAnswer:
      'Choose a yoga teacher by matching their verified training and lineage to your specific goal, checking how they teach (style, class size, language and pace), and confirming they teach safely for your body. On NOSTOPS every listed teacher has a verified public profile showing their tradition, experience and specialisations, so you can compare teachers on substance rather than marketing.',
    sections: [
      {
        heading: 'Start with your goal, not the trend',
        body: [
          'The “best” teacher is the one who is right for what you want from practice. A seeker recovering from a back injury, a professional managing stress, and a student who wants to study classical philosophy each need a different teacher — even in the same city.',
          'Decide your primary goal first, then look for teachers whose specialisations genuinely match it.',
        ],
        bullets: [
          'Stress, sleep & calm — look for breath-led, gentle or restorative teaching.',
          'Strength & mobility — look for a structured asana method and clear progression.',
          'Injury or a health condition — look for therapeutic experience and a careful, individualised approach.',
          'Philosophy & tradition — look for a documented lineage and scriptural study.',
          'Pregnancy or seniors — look for teachers who name that experience explicitly.',
        ],
      },
      {
        heading: 'Look for verified training and a clear lineage',
        body: [
          'Certifications vary widely, so treat them as a starting point rather than proof. What matters more is a teacher’s lineage (Paramparā), the depth of their study, and whether an independent platform has verified their identity and claims.',
          'On NOSTOPS, teacher profiles show the tradition and lineage a teacher practises within, their experience, and a verification status — and our teaching Levels explain what a teacher at each level has demonstrated. Tradition, style and certification are not the same thing: a “style” (how a class looks) sits inside a broader living tradition and is transmitted through a lineage.',
        ],
      },
      {
        heading: 'Judge the teaching, not just the credentials',
        body: [
          'Credentials tell you what a teacher has studied; a trial class tells you how they teach. Notice class size, how clearly they cue, whether they offer modifications, the language they teach in, and whether you feel seen rather than rushed.',
          'A good teacher adapts the practice to the student. Be cautious of anyone who makes everyone do the same thing regardless of ability or injury.',
        ],
      },
      {
        heading: 'Safety, consent and red flags',
        body: [
          'Share any medical conditions, injuries or pregnancy before you begin, and expect a teacher to ask. A trustworthy teacher never promises to “cure” disease, pressures you into packages, or applies hands-on adjustments without asking first.',
          'Consent, transparency and humility are signs of an authentic teacher — the same values the Guru–Shishya Paramparā is built on.',
        ],
      },
    ],
    faqs: [
      { q: 'How much experience should a yoga teacher have?', a: 'There is no single number — depth of study and the fit with your goal matter more than years alone. NOSTOPS profiles show a teacher’s experience and specialisations so you can judge relevance, not just tenure.' },
      { q: 'Group classes or private sessions?', a: 'Group classes build community and are more affordable; private sessions suit injuries, specific goals or faster progress. Many teachers offer both — start with whichever matches your goal and budget.' },
      { q: 'Is an online teacher as good as an in-person one?', a: 'Online works well for breath, philosophy and consistency; in-person is better when you want hands-on guidance or are new to a physically demanding practice. Choose based on your goal and how much individual feedback you need.' },
      { q: 'How does NOSTOPS verify teachers?', a: 'NOSTOPS verifies a teacher’s identity and the claims on their public profile and shows a verification status and teaching Level. We publish only what is verified and never infer a teacher’s lineage or credentials.' },
      { q: 'What should a first class cost?', a: 'Prices vary by city, format and experience. Ask about trial-class rates and package pricing up front — clear, honest pricing is itself a good sign.' },
    ],
    related: [
      { label: 'Browse the Teacher Directory', href: '/teachers' },
      { label: 'Find teachers by city', href: '/yoga-teachers' },
      { label: 'Understand NOSTOPS teaching Levels', href: '/levels' },
      { label: 'How we verify & build trust', href: '/trust' },
      { label: 'Find your tradition', href: '/find-your-tradition' },
    ],
    updated: UPDATED,
  },
  {
    slug: 'guru-shishya-parampara',
    topic: 'Tradition & lineage',
    eyebrow: 'Guide · Paramparā',
    title: 'Guru–Shishya Paramparā & Authentic Yoga Knowledge',
    description:
      'What Guru–Shishya Paramparā means, how it differs from tradition, sampradāya, lineage, method and style, and why documented lineage signals authentic yoga.',
    directAnswer:
      'Guru–Shishya Paramparā is the living, person-to-person transmission of yoga from a realised teacher (guru) to a committed student (shishya) across generations. It is what keeps knowledge authentic: not just techniques, but the understanding, ethics and context behind them. On NOSTOPS, lineage is documented from verified source material — we show a teacher’s tradition and lineage rather than inferring it.',
    sections: [
      {
        heading: 'What Paramparā means',
        body: [
          'Paramparā literally means “one after another” — an uninterrupted succession in which a teacher passes living knowledge to a student, who in time becomes a teacher. It is transmission by relationship and practice, not only by books or courses.',
          'This is why yoga is described as a living tradition: each generation receives, practises and passes it forward.',
        ],
      },
      {
        heading: 'Tradition, sampradāya, lineage, method and style — not the same thing',
        body: [
          'These words are often used interchangeably, which blurs real meaning. Keeping them distinct is central to understanding authentic yoga.',
        ],
        bullets: [
          'Tradition — the broad, enduring stream of yogic knowledge and values.',
          'Sampradāya — an established school or doctrinal community within that tradition.',
          'Paramparā — the specific teacher-to-student chain through which it is transmitted.',
          'Guru lineage — the named succession of teachers a practitioner belongs to.',
          'Methodology — the structured way a school teaches and sequences practice.',
          'Style — how a class looks and feels; the most surface-level of these terms.',
          'Institution — an organisation that may teach a tradition, distinct from the lineage itself.',
        ],
      },
      {
        heading: 'Why lineage matters for authentic practice',
        body: [
          'A documented lineage gives practice context and accountability. It situates a teacher within a stream of knowledge, with teachers they can name and texts they study — rather than a brand assembled from trends.',
          'Lineage is not a claim of superiority over other paths; it is a way of honouring where knowledge comes from and keeping it intact.',
        ],
      },
      {
        heading: 'How NOSTOPS documents lineage',
        body: [
          'NOSTOPS maps yoga’s living traditions, the Paramparās within them, the Gurus (Ācāryas) who carried them and the scriptures (Śāstra) that anchor them — and links teachers to the tradition they practise within.',
          'We use verified source data and never infer a teacher’s lineage, credentials or Council status. Where something is not verified, we do not assert it.',
        ],
      },
    ],
    faqs: [
      { q: 'Is Paramparā the same as a yoga style?', a: 'No. A style is how a class looks; a Paramparā is the lineage through which knowledge is transmitted. A single tradition can express itself through several styles.' },
      { q: 'Do I need a guru to practise yoga?', a: 'You can begin practising with any good teacher. The Guru–Shishya relationship becomes meaningful when you want to study deeply and carry a tradition forward with guidance.' },
      { q: 'How can I tell if a teacher has a real lineage?', a: 'Look for a named tradition and teachers, study of core texts, and independent verification. NOSTOPS shows a teacher’s documented tradition and lineage on their profile.' },
      { q: 'Does lineage make one tradition better than another?', a: 'No. Lineage is about authenticity and continuity, not hierarchy between paths.' },
    ],
    related: [
      { label: "Explore yoga's living traditions", href: '/yoga-parampara' },
      { label: 'Browse Paramparās', href: '/paramparas' },
      { label: 'Gurus (Ācāryas) of yoga', href: '/gurus' },
      { label: 'Yoga scriptures (Śāstra)', href: '/scriptures' },
      { label: 'The NOSTOPS philosophy', href: '/philosophy' },
    ],
    updated: UPDATED,
  },
  {
    slug: 'corporate-yoga-programmes',
    topic: 'Yoga for companies',
    eyebrow: 'Guide · For companies',
    title: 'Yoga for Companies: Running a Corporate Programme',
    description:
      'How to run a workplace yoga programme — formats that fit office life, choosing verified teachers, and setting up sessions employees actually attend.',
    directAnswer:
      'A corporate yoga programme works best when it fits how your team actually works: short, regular on-site sessions at a time your people can attend, led by verified teachers who can adapt to mixed ability and desk-bound bodies. Start small, make it easy to join, and choose teachers on NOSTOPS whose experience matches your goals.',
    sections: [
      {
        heading: 'Why companies offer yoga',
        body: [
          'Workplace yoga is usually introduced to help teams manage stress, counter the effects of long hours at a desk, and build a sense of shared wellbeing. It is most effective as a sustained habit, not a one-off event.',
          'Set a clear, honest intention — reducing desk strain, supporting focus, or simply giving teams a regular reset — rather than expecting dramatic outcomes overnight.',
        ],
      },
      {
        heading: 'Formats that fit office life',
        body: ['Choose a format that removes friction for employees:'],
        bullets: [
          'Onsite sessions — a meeting room or open space, before work, at lunch or end of day.',
          'Desk & chair yoga — short, equipment-free sessions for teams who can’t get to a mat.',
          'Workshops & off-sites — periodic deep-dives, or a teacher-led retreat for a team reset.',
        ],
      },
      {
        heading: 'Choosing the right teacher',
        body: [
          'Mixed-ability groups need a teacher who can scale a class so beginners feel comfortable and experienced practitioners stay engaged. Look for teachers with group and corporate experience and a calm, inclusive style.',
          'On NOSTOPS you can review verified teacher profiles and shortlist those whose specialisations fit a workplace setting.',
        ],
      },
      {
        heading: 'Set it up to succeed',
        body: [
          'Protect a consistent time slot, communicate it well, and keep joining effortless. Gather simple feedback after a few weeks and adjust the format and timing based on what your team actually attends.',
          'NOSTOPS’ For Organisations programmes help you structure sessions and work with teachers across locations.',
        ],
      },
    ],
    faqs: [
      { q: 'How often should corporate yoga run?', a: 'A regular weekly slot usually works better than occasional long sessions — consistency is what builds the habit and the benefit.' },
      { q: 'What if employees have never done yoga?', a: 'Choose a teacher experienced with beginners and mixed groups. Good teachers offer modifications so everyone can take part safely.' },
      { q: 'Do we need special equipment or space?', a: 'No. Chair and mat-free formats run in a meeting room; mat classes just need a clear, quiet space.' },
      { q: 'Can one programme cover multiple offices?', a: 'Each NOSTOPS programme runs in person in one city, led by a verified local teacher. Offices in different cities can each run their own programme.' },
    ],
    related: [
      { label: 'For Organisations · Companies', href: '/for-organisations/companies' },
      { label: 'Programmes overview', href: '/programmes' },
      { label: 'Browse verified teachers', href: '/teachers' },
    ],
    updated: UPDATED,
  },
  {
    slug: 'yoga-for-educational-institutions',
    topic: 'Yoga for education',
    eyebrow: 'Guide · For institutions',
    title: 'Yoga for Schools, Colleges & Universities',
    description:
      'How educational institutions can introduce yoga — age-appropriate formats, supporting students through exam stress, and choosing verified teachers.',
    directAnswer:
      'Yoga in schools and colleges works best when it is age-appropriate, woven into the routine, and led by teachers experienced with young people. Keep sessions simple, inclusive and consistent, and use verified NOSTOPS teachers who can adapt to different age groups and abilities.',
    sections: [
      {
        heading: 'Why institutions introduce yoga',
        body: [
          'Schools, colleges and universities bring in yoga to help students manage stress, build focus and attention, and develop healthy movement habits early. For staff, it offers a shared way to reset during demanding terms.',
          'The aim is steady support for wellbeing, not performance claims — set expectations accordingly.',
        ],
      },
      {
        heading: 'Make it age-appropriate',
        body: ['Design the programme around who is practising:'],
        bullets: [
          'Teenagers — stress, sleep and focus, with space for self-regulation.',
          'College & university — managing pressure, long study hours and exam stress.',
          'Faculty & staff — regular, accessible classes that fit a busy timetable.',
        ],
      },
      {
        heading: 'Supporting exam and term-time stress',
        body: [
          'Simple breath practices and short resets are especially useful before exams and during high-pressure periods. A good teacher can give students practical tools they can use on their own, not just in class.',
        ],
      },
      {
        heading: 'Choosing teachers and setting up',
        body: [
          'Prioritise teachers experienced with the relevant age group and comfortable in group settings. Fit sessions into the existing timetable, keep participation easy, and review what’s working each term.',
          'NOSTOPS’ For Organisations programmes help institutions plan sessions and work with verified teachers.',
        ],
      },
    ],
    faqs: [
      { q: 'Is yoga safe for children?', a: 'Yes, when it is age-appropriate and taught by an experienced teacher who keeps practices playful, gentle and inclusive.' },
      { q: 'Can yoga fit into a packed school timetable?', a: 'Short, regular sessions integrate well and are easier to sustain than occasional long classes. NOSTOPS Council programmes run 30–60 minutes a session.' },
      { q: 'How does it help during exams?', a: 'Breath and relaxation techniques give students simple tools to steady themselves before and during high-pressure periods.' },
      { q: 'How do we find a suitable teacher?', a: 'Shortlist verified NOSTOPS teachers with experience in your age group, and let NOSTOPS For Organisations help coordinate.' },
    ],
    related: [
      { label: 'For Organisations · Educational Institutions', href: '/for-organisations/educational-institutions' },
      { label: 'Programmes overview', href: '/programmes' },
      { label: 'Browse verified teachers', href: '/teachers' },
    ],
    updated: UPDATED,
  },
  {
    slug: 'yoga-for-startups-and-networking-groups',
    topic: 'Yoga for startups',
    eyebrow: 'Guide · For startups & groups',
    title: 'Yoga for Startups & Networking Groups',
    description:
      'How startups and professional networks can use yoga to manage burnout and build community — flexible formats, events and choosing the right teacher.',
    directAnswer:
      'For startups and networking groups, yoga is a practical way to counter burnout and bring people together. Flexible, low-friction formats — short team sessions, event add-ons, or a group retreat — work best, led by a verified teacher who can hold an energetic, mixed-ability room. NOSTOPS helps you find teachers and structure sessions that fit a fast-moving culture.',
    sections: [
      {
        heading: 'Why fast-moving teams use yoga',
        body: [
          'Startup and founder life runs on long hours and high pressure, which makes sustainable resets valuable. Networking groups use yoga to create a shared, human experience that strangers can enjoy together — a better icebreaker than another panel.',
        ],
      },
      {
        heading: 'Formats that fit the pace',
        body: ['Keep it flexible and easy to say yes to:'],
        bullets: [
          'Short team sessions — a regular reset that fits around sprints and deadlines.',
          'Event add-ons — a morning class or wind-down session at an offsite or meetup.',
          'Community classes — recurring sessions that give a network a reason to gather.',
          'Group retreats — a teacher-led reset that doubles as team or community building.',
        ],
      },
      {
        heading: 'Choosing the right teacher',
        body: [
          'Mixed groups of busy professionals need a teacher who can read the room, keep things accessible, and make newcomers feel at ease. Look for group-class experience and an inclusive, grounded style.',
          'Browse verified teachers on NOSTOPS and shortlist those suited to lively, mixed-ability settings.',
        ],
      },
    ],
    faqs: [
      { q: 'We’re a tiny team — is that too small?', a: 'Not at all. Small teams often benefit most from a short, regular session, and formats scale down easily.' },
      { q: 'Can yoga be part of a networking event?', a: 'Yes — a short class is a memorable, inclusive way to open or close an event and help people connect.' },
      { q: 'How do we handle very different fitness levels?', a: 'A good teacher offers options so everyone — from first-timers to regulars — can take part comfortably.' },
      { q: 'Can we combine it with a team offsite?', a: 'A teacher-led retreat is an ideal way to pair a genuine reset with team or community building.' },
    ],
    related: [
      { label: 'For Organisations · Startup & Networking Groups', href: '/for-organisations/startup-networking-groups' },
      { label: 'Programmes overview', href: '/programmes' },
      { label: 'Teacher-led retreats', href: '/retreats' },
    ],
    updated: UPDATED,
  },
  {
    slug: 'finding-yoga-teachers-in-your-city',
    topic: 'City discovery',
    eyebrow: 'Guide · City discovery',
    title: 'How to Find Yoga Teachers in Your City',
    description:
      'A simple way to find and shortlist verified yoga teachers in your city — what city directory pages show, local vs online, and how to compare teachers well.',
    directAnswer:
      'To find a yoga teacher in your city, start from a verified city directory, filter by what you want (tradition, style or focus), and shortlist two or three teachers to try. On NOSTOPS, each city page lists verified teachers with their tradition, experience and specialisations, so you can compare locally without sifting through ads.',
    sections: [
      {
        heading: 'Start from a verified city directory',
        body: [
          'A directory of verified teachers is more reliable than open search, because the identities and claims have been checked. NOSTOPS city pages bring together the verified teachers active in a given city, each with a public profile you can read before you reach out.',
        ],
      },
      {
        heading: 'Local, online, or both',
        body: [
          'In-person classes suit hands-on learning, community and routine; online widens your choice and suits breath, philosophy and consistency. Many teachers offer both, so you’re not limited to who is nearest.',
        ],
      },
      {
        heading: 'What a city page shows you',
        body: ['Use the profile details to compare teachers on substance:'],
        bullets: [
          'The tradition and lineage a teacher practises within.',
          'Their experience and specialisations.',
          'Verification status and teaching Level.',
          'Styles and the languages they teach in.',
        ],
      },
      {
        heading: 'Shortlist and reach out',
        body: [
          'Pick two or three teachers whose focus matches your goal, read their profiles in full, and arrange a trial where possible. The right fit is about goal, approach and rapport — not just proximity.',
        ],
      },
    ],
    faqs: [
      { q: 'What if my city has only a few teachers listed?', a: 'Consider nearby cities and online teachers — a verified online teacher can be a better fit than a closer one who doesn’t match your goal.' },
      { q: 'Are the teachers on city pages verified?', a: 'Yes. NOSTOPS city pages list verified teachers and show each teacher’s verification status and teaching Level.' },
      { q: 'How many teachers should I try before choosing?', a: 'Shortlisting two or three and trying a class with each is usually enough to find a good fit.' },
      { q: 'Can I search by tradition or style?', a: 'Yes — city and directory pages let you focus on the tradition, style or specialisation you’re looking for.' },
    ],
    related: [
      { label: 'Find teachers by city', href: '/yoga-teachers' },
      { label: 'Browse the full Teacher Directory', href: '/teachers' },
      { label: 'How to choose a yoga teacher', href: '/guides/how-to-choose-a-yoga-teacher' },
      { label: 'Understand teaching Levels', href: '/levels' },
    ],
    updated: UPDATED,
  },
  {
    slug: 'teacher-led-retreats-and-approved-venues',
    topic: 'Retreats & venues',
    eyebrow: 'Guide · Retreats & venues',
    title: 'Teacher-Led Retreats & Approved Venues',
    description:
      'What a teacher-led yoga retreat is, why approved venues matter, how to choose a retreat, and how teachers can host one on NOSTOPS.',
    directAnswer:
      'A teacher-led retreat is a multi-day practice led by a yoga teacher you trust, usually at a dedicated venue. On NOSTOPS, retreats are created by teachers and hosted at approved venues — so you travel with a teacher whose approach you know, in a space suited to practice. Choose a retreat by the teacher and tradition first, then the venue and dates.',
    sections: [
      {
        heading: 'What a teacher-led retreat is',
        body: [
          'A teacher-led retreat is built around a specific teacher and their students, rather than a generic package. The teacher sets the intention, the practice and the pace, and often brings their own community along.',
          'This is the heart of the NOSTOPS model: the teacher stays central, and the retreat is an extension of their teaching.',
        ],
      },
      {
        heading: 'Why approved venues matter',
        body: [
          'An approved venue is a space suited to real practice — with the right hall, food, rooms and setting — and a track record of hosting retreats well. Choosing an approved venue reduces surprises and lets the teacher focus on teaching.',
          'NOSTOPS venue profiles show capacity, facilities, best season, how to get there and the kind of retreats a venue suits.',
        ],
      },
      {
        heading: 'How to choose a retreat',
        body: ['Decide in this order:'],
        bullets: [
          'The teacher — whose approach, tradition and style you want to practise with.',
          'The focus — rest, deepening practice, philosophy, or a specific goal.',
          'The venue — setting, facilities, food and best season for your dates.',
          'The practicalities — location, getting there, dates and group size.',
        ],
      },
      {
        heading: 'For teachers: hosting a retreat',
        body: [
          'Teachers on NOSTOPS can select an approved venue, agree the economics, set a participant price, build a cohort and invite their own group — with participant payments handled for them and their share recorded in their NOSTOPS wallet.',
          'See how the retreat flywheel works, or list a venue to host teacher-led retreats.',
        ],
      },
    ],
    faqs: [
      { q: 'How is a teacher-led retreat different from a holiday package?', a: 'It is built around a specific teacher and their practice, not a generic itinerary — you travel with a teacher whose approach you already trust.' },
      { q: 'What makes a venue “approved”?', a: 'An approved venue is suited to practice — hall, food, rooms and setting — with a track record of hosting retreats. NOSTOPS venue profiles show facilities, capacity and best season.' },
      { q: 'Should I choose by destination or by teacher?', a: 'Start with the teacher and the focus of the retreat, then weigh the venue and dates. The teacher shapes the experience most.' },
      { q: 'Can any teacher host a retreat on NOSTOPS?', a: 'Teachers can create retreats at approved venues, set their price, build a cohort and invite their group, with payments handled by NOSTOPS.' },
    ],
    related: [
      { label: 'Browse retreats', href: '/retreats' },
      { label: 'Approved venues', href: '/venues' },
      { label: 'Host a retreat', href: '/retreats/host' },
      { label: 'How the retreat flywheel works', href: '/how-it-works' },
      { label: 'List your venue', href: '/list-your-venue' },
    ],
    updated: UPDATED,
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
