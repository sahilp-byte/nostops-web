// Ask AI Guru — guided categories + suggested questions (static copy).
// Mirrors the product brief exactly; questions are phrased as a first-time user
// would ask them.

export type GuruCategory = {
  id: string;
  label: string;
  icon: string;
  questions: string[];
};

// Shown on the welcome screen before any category is chosen.
export const FIRST_TIME_QUESTIONS: string[] = [
  'How do I get started with NOSTOPS?',
  'How do I create my profile?',
  'What do I benefit from by registering?',
  'How can I earn through NOSTOPS?',
  'How do I become an Empanelled Teacher?',
];

export const GURU_CATEGORIES: GuruCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: '🧭',
    questions: [
      'How do I get started with NOSTOPS?',
      'What is NOSTOPS?',
      'What do I benefit from by registering?',
      'Which role is right for me?',
    ],
  },
  {
    id: 'teachers',
    label: 'Teachers',
    icon: '🧘',
    questions: [
      'How can I earn through NOSTOPS?',
      'How do I create my teacher profile?',
      'What is InstaKYC?',
      'How do I become an Empanelled Teacher?',
      'Can I host my own retreat?',
      'How do institutional programmes work?',
    ],
  },
  {
    id: 'venues',
    label: 'Venues',
    icon: '🏛️',
    questions: [
      'Why should I list my venue?',
      'How do teachers discover my venue?',
      'How can teachers contact me?',
      'Can I host Yoga retreats?',
      'How can my venue be used for institutional programmes?',
    ],
  },
  {
    id: 'retreats',
    label: 'Retreats',
    icon: '🌿',
    questions: [
      'How do I create a retreat?',
      'How do I find teachers?',
      'How do venues work?',
      'How does NOSTOPS help retreat hosts?',
      'How do participants register?',
    ],
  },
  {
    id: 'organisations',
    label: 'Organisations',
    icon: '🏢',
    questions: [
      'How can my company start Yoga?',
      'How can a college create a programme?',
      'Can a BNI group create a programme?',
      'How does teacher matching work?',
      'Can participants register themselves?',
      'What are Council-curated programmes?',
    ],
  },
  {
    id: 'participants',
    label: 'Participants',
    icon: '🙋',
    questions: [
      'How do I register?',
      'Where can I see my programmes?',
      'How do I know whether my booking is confirmed?',
      'How do I provide feedback?',
    ],
  },
  {
    id: 'account-payments',
    label: 'Account & Payments',
    icon: '💳',
    questions: [
      'How do I log in or create an account?',
      'How are payments handled on NOSTOPS?',
      'How do I complete verification?',
      'I have a problem with a booking or payment.',
    ],
  },
  {
    id: 'technical-help',
    label: 'Technical Help',
    icon: '🛠️',
    questions: [
      'A page isn’t loading for me.',
      'I can’t sign in to my account.',
      'Something isn’t working as expected.',
      'How do I contact NOSTOPS Support?',
    ],
  },
];

// Support Request categories (mirrors backend/guru/support.py CATEGORIES).
export const SUPPORT_CATEGORIES: string[] = [
  'Account & Login',
  'Teacher Profile',
  'Verification / KYC',
  'Empanelment',
  'Venue',
  'Retreat',
  'Organisation',
  'Programme',
  'Event',
  'Participant',
  'Payment',
  'Technical Problem',
  'Other',
];

// Suggests a support category from the current page type.
export function categoryForPage(pageType?: string): string {
  const map: Record<string, string> = {
    kyc: 'Verification / KYC',
    empanelment: 'Empanelment',
    teacher: 'Teacher Profile',
    teacher_onboarding: 'Teacher Profile',
    venue: 'Venue',
    retreat: 'Retreat',
    organisations: 'Organisation',
    programme: 'Programme',
    event: 'Event',
    participant: 'Participant',
    payment: 'Payment',
    account: 'Account & Login',
  };
  return map[pageType || ''] || 'Other';
}
