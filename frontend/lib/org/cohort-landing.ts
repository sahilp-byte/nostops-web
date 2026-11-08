// Per-cohort content for the "Work Better. Live Better." landing layout
// (components/org/CohortLanding.tsx). Programme cards feature REAL catalogue
// programmes (by id); photos are generic, illustrative scenes.
import type { CohortKey } from '@/lib/org/cohort-copy';
import type { InterestKey } from '@/lib/org/enquiry';

export type LandingPathway = { key: InterestKey; programmeId: string; img: string; alt: string };

export type CohortLandingConfig = {
  tid: string; // data-testid prefix
  crumb: string;
  heroImg: string;
  heroAlt: string;
  heroWords: string[];
  intro: string;
  programmesTitle: string;
  ctaTitle: string;
  ctaText: string;
  pathways: LandingPathway[]; // MIND, BODY, SPECIAL_NEEDS — in this order
};

export const COHORT_LANDING: Record<CohortKey, CohortLandingConfig> = {
  COMPANY: {
    tid: 'companies',
    crumb: 'Companies',
    heroImg: '/brand/org/hero.jpg',
    heroAlt: 'Rows of colleagues seated on yoga mats in a bright, plant-filled office atrium during a group meditation',
    heroWords: ['People', 'Culture', 'Balance', 'Performance'],
    intro:
      'Companies bring structured, Council-curated Yoga programmes to their people, delivered on-site by a NOSTOPS-verified teacher matched to the programme, location and schedule.',
    programmesTitle: 'Popular Programmes for Companies',
    ctaTitle: 'Bring yoga to your workplace',
    ctaText: 'Create a Council-curated programme for your teams, delivered by a NOSTOPS-verified teacher.',
    pathways: [
      { key: 'MIND', programmeId: 'NOSTOPS-PGM-2026-000002', img: '/brand/org/companies-mind.jpg',
        alt: 'Colleagues seated on yoga mats by an office window, eyes closed in a guided breathing practice led by a teacher' },
      { key: 'BODY', programmeId: 'NOSTOPS-PGM-2026-000007', img: '/brand/org/companies-body.jpg',
        alt: 'Four colleagues holding Warrior II pose on yoga mats in an open office with a city view' },
      { key: 'SPECIAL_NEEDS', programmeId: 'NOSTOPS-PGM-2026-000008', img: '/brand/org/companies-special-needs.jpg',
        alt: 'Colleagues on office chairs and wheelchairs doing seated, palms-together chair yoga' },
    ],
  },
  EDUCATIONAL_INSTITUTION: {
    tid: 'schools',
    crumb: 'Educational Institutions',
    heroImg: '/brand/org/education.jpg',
    heroAlt: 'Students and faculty seated on mats in a sunlit campus hall during a guided group meditation',
    heroWords: ['Students', 'Faculty', 'Focus', 'Wellbeing'],
    intro:
      'Schools, colleges and universities bring Council-curated Yoga programmes to students, faculty and staff, delivered on campus by a NOSTOPS-verified teacher matched to the programme, location and schedule.',
    programmesTitle: 'Popular Programmes for Campuses',
    ctaTitle: 'Bring yoga to your campus',
    ctaText: 'Create a Council-curated programme for your students and staff, delivered by a NOSTOPS-verified teacher.',
    pathways: [
      { key: 'MIND', programmeId: 'NOSTOPS-PGM-2026-000001', img: '/brand/org/schools-mind.jpg',
        alt: 'College students seated cross-legged on yoga mats in a sunlit hall, eyes closed in a breathing and focus practice' },
      { key: 'BODY', programmeId: 'NOSTOPS-PGM-2026-000006', img: '/brand/org/schools-body.jpg',
        alt: 'Students on yoga mats in a campus studio doing upright seated posture work, with backpacks along the wall' },
      { key: 'SPECIAL_NEEDS', programmeId: 'NOSTOPS-PGM-2026-000010', img: '/brand/org/schools-special-needs.jpg',
        alt: 'A small group of students, one in a wheelchair, seated on cushions and chairs in a quiet room for calm breathing' },
    ],
  },
  STARTUP_NETWORK: {
    tid: 'startups',
    crumb: 'Startup & Networking Groups',
    heroImg: '/brand/org/startup.jpg',
    heroAlt: 'Founders seated on yoga mats in a brick-walled co-working space, eyes closed in a shared meditation',
    heroWords: ['Founders', 'Teams', 'Energy', 'Community'],
    intro:
      'Founder circles and professional networks create shared, Council-curated Yoga programmes for their members, delivered on-site at a community venue by a NOSTOPS-verified teacher.',
    programmesTitle: 'Popular Programmes for Founder Networks',
    ctaTitle: 'Bring yoga to your community',
    ctaText: 'Create a Council-curated programme for your members and their teams, delivered by a NOSTOPS-verified teacher.',
    pathways: [
      { key: 'MIND', programmeId: 'NOSTOPS-PGM-2026-000004', img: '/brand/org/startups-mind.jpg',
        alt: 'Founders seated in a loose circle on yoga mats in a co-working space, hands on heart and belly, eyes closed' },
      { key: 'BODY', programmeId: 'NOSTOPS-PGM-2026-000005', img: '/brand/org/startups-body.jpg',
        alt: 'Young professionals holding a low lunge with arms raised on yoga mats in an open co-working space' },
      { key: 'SPECIAL_NEEDS', programmeId: 'NOSTOPS-PGM-2026-000009', img: '/brand/org/startups-special-needs.jpg',
        alt: 'Members seated on chairs with yoga blocks doing a gentle stretch; an older participant has a walking cane beside her' },
    ],
  },
};

/** Illustrative photo for a programme page: the cohort card photo featuring this
 *  programme, else the Companies photo for its pathway. */
export function programmeImage(programmeId: string, taxonomy: InterestKey): { img: string; alt: string } {
  const all = Object.values(COHORT_LANDING).flatMap((c) => c.pathways);
  const pw = all.find((p) => p.programmeId === programmeId) || COHORT_LANDING.COMPANY.pathways.find((p) => p.key === taxonomy) || all[0];
  return { img: pw.img, alt: pw.alt };
}
