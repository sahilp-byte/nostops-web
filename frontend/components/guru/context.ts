// Ask AI Guru — page-context map + approved NOSTOPS-authored contextual prompts.
// Client-safe (no server imports). Single source for "where is the visitor and
// what are they likely trying to do", reused by the AskGuru widget. The opening
// greeting is ALWAYS NOSTOPS-authored here — the AI never invents the first line;
// the conversation only becomes dynamic after the user engages.

export type GuruPageType =
  | 'home'
  | 'teacher'
  | 'teacher_onboarding'
  | 'kyc'
  | 'empanelment'
  | 'venue'
  | 'retreat'
  | 'organisations'
  | 'programme'
  | 'event'
  | 'participant'
  | 'dashboard'
  | 'payment'
  | 'account'
  | 'support'
  | 'general';

export type PageCtx = {
  route: string;
  page_type: GuruPageType;
  journey?: string; // teacher | venue | retreat | organisation | participant (drives KB ordering)
  event_slug?: string;
  registration_open?: boolean;
  cohort?: 'company' | 'educational' | 'startup';
};

// Maps a page type to the KB "journey" the backend uses to order knowledge.
const JOURNEY: Partial<Record<GuruPageType, string>> = {
  teacher: 'teacher',
  teacher_onboarding: 'teacher',
  kyc: 'teacher',
  empanelment: 'teacher',
  venue: 'venue',
  retreat: 'retreat',
  organisations: 'organisation',
  programme: 'organisation',
  event: 'participant',
  participant: 'participant',
};

export function derivePageContext(pathname: string): PageCtx {
  const p = pathname || '/';
  let page_type: GuruPageType = 'general';
  let event_slug: string | undefined;

  if (p === '/') page_type = 'home';
  // Teacher onboarding / verification sub-stages (check BEFORE generic teacher)
  else if (/^\/app\/teacher\/(get-verified|kyc)/.test(p)) page_type = 'kyc';
  else if (/^\/app\/teacher\/empanelment/.test(p) || /^\/app\/teacher\/levels/.test(p)) page_type = 'empanelment';
  else if (/^\/app\/teacher\/onboarding/.test(p) || /^\/app\/teacher\/locked/.test(p)) page_type = 'teacher_onboarding';
  else if (/^\/app\/teacher\/retreats/.test(p)) page_type = 'retreat';
  else if (/^\/app\/?$/.test(p) || /^\/app\/admin\/?$/.test(p) || /^\/app\/teacher\/dashboard/.test(p)) page_type = 'dashboard';
  else if (/^\/(teachers|become-a-teacher|yoga-teachers|claim)/.test(p) || /^\/app\/teacher/.test(p)) page_type = 'teacher';
  // Venue
  else if (/^\/(venues)/.test(p) || /^\/app\/venue/.test(p)) page_type = 'venue';
  // Retreat (public)
  else if (/^\/retreats/.test(p)) page_type = 'retreat';
  // Organisations gateway + event creator
  else if (/^\/for-organisations/.test(p)) page_type = 'organisations';
  else if (/^\/app\/org\/events/.test(p)) page_type = 'programme';
  else if (/^\/app\/org/.test(p)) page_type = 'organisations';
  // Programmes catalogue
  else if (/^\/programmes/.test(p)) page_type = 'programme';
  // Public event
  else if (/^\/events\//.test(p)) {
    page_type = 'event';
    const m = p.match(/^\/events\/([^/]+)/);
    if (m) event_slug = m[1];
  }
  // Participant area ("My Programmes")
  else if (/^\/participant/.test(p)) page_type = 'participant';
  // Payments
  else if (/^\/(pay|cashfree-return)/.test(p) || /payment/.test(p)) page_type = 'payment';
  // Account / auth
  else if (/^\/(login|register|signup|reset|settings|notifications)/.test(p) || /^\/app\/settings/.test(p)) page_type = 'account';
  // Support/help content
  else if (/^\/(support|contact|faq|trust)/.test(p)) page_type = 'support';
  // Any other authed app screen
  else if (/^\/app/.test(p)) page_type = 'account';

  const ctx: PageCtx = { route: p, page_type };
  const j = JOURNEY[page_type];
  if (j) ctx.journey = j;
  if (event_slug) ctx.event_slug = event_slug;
  // Cohort-specific showcase pages get a tailored opening line.
  if (page_type === 'organisations') {
    if (/^\/for-organisations\/companies/.test(p)) ctx.cohort = 'company';
    else if (/^\/for-organisations\/educational-institutions/.test(p)) ctx.cohort = 'educational';
    else if (/^\/for-organisations\/startup-networking-groups/.test(p)) ctx.cohort = 'startup';
  }
  return ctx;
}

type Cohort = NonNullable<PageCtx['cohort']>;

// Institutional cohort key (COMPANY / EDUCATIONAL_INSTITUTION / STARTUP_NETWORK)
// -> the short cohort used for tailored greetings.
export function cohortFromKey(k?: string | null): PageCtx['cohort'] {
  if (k === 'COMPANY') return 'company';
  if (k === 'EDUCATIONAL_INSTITUTION') return 'educational';
  if (k === 'STARTUP_NETWORK') return 'startup';
  return undefined;
}

export type OpeningPrompt = {
  key: string; // dismissal key (page_type[:role])
  greeting: string;
  questions: string[];
};

const G = {
  home: {
    greeting:
      "👋 New to NOSTOPS? I'm your guide — I can help you get started, find opportunities and understand how the platform works.",
    questions: ['How do I get started with NOSTOPS?', 'What do I benefit from by registering?'],
  },
  teacher_public: {
    greeting:
      'Looking at Yoga teaching opportunities? I can help you create your NOSTOPS profile, understand verification, or explore how teachers can earn through the platform.',
    questions: ['How do I create my teacher profile?', 'How can I earn through NOSTOPS?', 'How do I become an Empanelled Teacher?'],
  },
  teacher_user: {
    greeting:
      'You already have a NOSTOPS Teacher Profile. Would you like help with verification, empanelment, teaching opportunities or retreats?',
    questions: ['How do institutional programmes work?', 'Can I host my own retreat?', 'How do I become an Empanelled Teacher?'],
  },
  teacher_onboarding: {
    greeting:
      'Need help getting started? I can walk you through creating your profile, verification and empanelment.',
    questions: ['How do I create my teacher profile?', 'How does verification work?'],
  },
  kyc: {
    greeting:
      'Need help completing verification? I can explain what happens next and help you understand the verification process.',
    questions: ['What is InstaKYC?', 'How does verification work?'],
  },
  empanelment: {
    greeting:
      'Working towards empanelment? I can explain teacher levels, what empanelment means and what unlocks on the platform.',
    questions: ['How do I become an Empanelled Teacher?', 'What are teacher levels?'],
  },
  venue_public: {
    greeting:
      'Interested in listing your venue? I can explain how teachers and retreat hosts discover venues on NOSTOPS.',
    questions: ['Why should I list my venue?', 'How do teachers find my venue?', 'How can teachers contact me?'],
  },
  venue_user: {
    greeting:
      'Managing your venue on NOSTOPS? I can help with listing, how teachers and hosts discover you, and hosting retreats or programmes.',
    questions: ['How do teachers find my venue?', 'Can I host Yoga retreats?', 'How can my venue be used for institutional programmes?'],
  },
  retreat: {
    greeting:
      'Thinking about hosting a Yoga retreat? I can explain how NOSTOPS connects retreat hosts, venues, teachers and participants.',
    questions: ['How do I create a retreat?', 'How does NOSTOPS help retreat hosts?', 'How do participants register?'],
  },
  organisations: {
    greeting:
      'Looking to bring Yoga to your organisation? I can explain how Companies, Educational Institutions and Startup & Networking Groups can create Council-curated programmes.',
    questions: ['How can my organisation start Yoga?', 'What are Council-curated programmes?', 'How does teacher matching work?'],
  },
  org_company: {
    greeting:
      'I can explain how your organisation can create a Council-curated Yoga programme and have NOSTOPS match a verified teacher.',
    questions: ['How can my company start Yoga?', 'How does teacher matching work?', 'See a demonstration programme'],
  },
  org_educational: {
    greeting:
      'I can show you how a campus programme moves from a Council-curated programme to a published event.',
    questions: ['How does a campus programme work?', 'How does teacher matching work?', 'See a demonstration programme'],
  },
  org_startup: {
    greeting:
      'I can show you how your founder network can create a shared Yoga programme.',
    questions: ['How can our network start Yoga?', 'How does teacher matching work?', 'See a demonstration programme'],
  },
  programme_creator: {
    greeting:
      "I can help you create an event, understand your organisation's programmes, or manage participant activity.",
    questions: ['How does teacher matching work?', 'Can participants register themselves?'],
  },
  programme: {
    greeting:
      'Exploring Council-curated programmes? I can explain the Mind, Body and Special Needs pillars and how to bring one to your organisation.',
    questions: ['What are Council-curated programmes?', 'How can my organisation start Yoga?'],
  },
  event: {
    greeting:
      'Interested in this programme? I can explain how registration works or help you create a similar programme for your organisation.',
    questions: ['How do I register?', 'How can my organisation start Yoga?'],
  },
  participant: {
    greeting:
      'Looking for help with your programme? I can help you understand your booking, upcoming sessions, attendance and feedback.',
    questions: ['How do I know whether my booking is confirmed?', 'How do I provide feedback?'],
  },
  account: {
    greeting: 'Need a hand with your account? I can help with sign-in, verification and getting set up.',
    questions: ['How do I log in or create an account?', 'How do I complete verification?'],
  },
  payment: {
    greeting: 'Questions about a payment? I can explain how payments work on NOSTOPS and what to expect.',
    questions: ['How are payments handled on NOSTOPS?', 'I have a problem with a booking or payment.'],
  },
  support: {
    greeting: "Looking for help? Ask me anything about NOSTOPS and I'll do my best — or we can raise a support request.",
    questions: ['How do I get started with NOSTOPS?', 'How do I contact NOSTOPS Support?'],
  },
};

// Cohort-aware variants (OEA-26): the wording matches who the programme is for
// (employees / students / members) instead of assuming a company everywhere.
const EVENT_BY_COHORT: Record<Cohort, { greeting: string; questions: string[] }> = {
  company: {
    greeting:
      'Interested in this workplace programme? I can explain how registration works or help your company create a similar programme.',
    questions: ['How do I register?', 'How can my company start Yoga?'],
  },
  educational: {
    greeting:
      'Interested in this campus programme? I can explain how registration works or help your institution create a similar programme for students and staff.',
    questions: ['How do I register?', 'How does a campus programme work?'],
  },
  startup: {
    greeting:
      'Interested in this community programme? I can explain how registration works or help your network create a similar programme for its members.',
    questions: ['How do I register?', 'How can our network start Yoga?'],
  },
};

const CREATOR_BY_COHORT: Record<Cohort, { greeting: string; questions: string[] }> = {
  company: {
    greeting: 'I can help you create a programme for your teams, choose a Council-curated programme, or manage employee registrations.',
    questions: ['How does teacher matching work?', 'Can employees register themselves?'],
  },
  educational: {
    greeting: 'I can help you create a campus programme for students and staff, plan it around your academic calendar, or manage registrations.',
    questions: ['How does teacher matching work?', 'Can students register themselves?'],
  },
  startup: {
    greeting: "I can help you create a shared programme for your network's members and their teams, or manage member registrations.",
    questions: ['How does teacher matching work?', 'Can members register themselves?'],
  },
};

// Dashboard Q&A: one greeting + quick questions per persona.
const DASHBOARD_BY_ROLE: Record<string, { greeting: string; questions: string[] }> = {
  teacher: {
    greeting: 'Welcome to your teacher dashboard. Ask me about your profile, InstaKYC, empanelment, bookings or earnings.',
    questions: ['What should I do next on my dashboard?', 'How do I claim the free festive InstaKYC?', 'How do I become an Empanelled Teacher?', 'How can I earn through NOSTOPS?'],
  },
  learner: {
    greeting: 'Welcome to your practice dashboard. Ask me about booking a 1:1 session, your bookings or finding the right teacher.',
    questions: ['How do I book a 1:1 session?', 'How do I find the right teacher for me?', 'How do I know whether my booking is confirmed?', 'How do I join a retreat?'],
  },
  organisation: {
    greeting: 'Welcome to your organisation dashboard. Ask me about creating a programme, teacher matching or managing registrations.',
    questions: ['How do I create a programme for my organisation?', 'How does teacher matching work?', 'Can participants register themselves?', 'How are payments handled on NOSTOPS?'],
  },
  council: {
    greeting: 'Welcome to your Council dashboard. Ask me about reviewing teachers, empanelment or Council-curated programmes.',
    questions: ['How does Council empanelment review work?', 'What are teacher levels?', 'What are Council-curated programmes?'],
  },
  admin: {
    greeting: 'Welcome to the admin dashboard. Ask me how NOSTOPS works for teachers, organisations and seekers.',
    questions: ['How does teacher verification work?', 'How does teacher matching work?', 'How does the festive InstaKYC campaign work?'],
  },
  venue: {
    greeting: 'Welcome to your venue dashboard. Ask me about your listing, teacher partnerships or hosting retreats.',
    questions: ['How do teachers find my venue?', 'Can I host Yoga retreats?', 'How can my venue be used for institutional programmes?'],
  },
};

function dashboardRole(role: string | null): string {
  switch (role) {
    case 'teacher':
    case 'coordinator':
      return 'teacher';
    case 'organisation':
    case 'hr':
    case 'corporate':
      return 'organisation';
    case 'guru':
    case 'council':
      return 'council';
    case 'admin':
      return 'admin';
    case 'venue':
      return 'venue';
    default:
      return 'learner';
  }
}

// Returns the approved contextual greeting for this page + (known) role, or null
// when a page type has no special greeting (then no bubble is shown).
export function openingPrompt(ctx: PageCtx, role: string | null, authed: boolean): OpeningPrompt | null {
  const isTeacher = role === 'teacher';
  const isVenue = role === 'venue';
  // Anyone signed in on the organisation workspace (/app/org/*) is acting as an Event Creator.
  const isOrg = role === 'organisation' || role === 'hr' || /^\/app\/org\//.test(ctx.route);
  const pick = (key: string, g: { greeting: string; questions: string[] }): OpeningPrompt => ({ key, ...g });
  const creator = (key: string): OpeningPrompt =>
    ctx.cohort ? pick(`${key}:${ctx.cohort}`, CREATOR_BY_COHORT[ctx.cohort]) : pick(key, G.programme_creator);

  switch (ctx.page_type) {
    case 'home':
      return pick('home', G.home);
    case 'teacher':
      return authed && isTeacher ? pick('teacher:user', G.teacher_user) : pick('teacher', G.teacher_public);
    case 'teacher_onboarding':
      return pick('teacher_onboarding', G.teacher_onboarding);
    case 'kyc':
      return pick('kyc', G.kyc);
    case 'empanelment':
      return pick('empanelment', G.empanelment);
    case 'venue':
      return authed && isVenue ? pick('venue:user', G.venue_user) : pick('venue', G.venue_public);
    case 'retreat':
      return pick('retreat', G.retreat);
    case 'organisations':
      if (!(authed && isOrg) && ctx.cohort === 'company') return pick('organisations:company', G.org_company);
      if (!(authed && isOrg) && ctx.cohort === 'educational') return pick('organisations:educational', G.org_educational);
      if (!(authed && isOrg) && ctx.cohort === 'startup') return pick('organisations:startup', G.org_startup);
      return authed && isOrg ? creator('organisations:user') : pick('organisations', G.organisations);
    case 'programme':
      return authed && isOrg ? creator('programme:creator') : pick('programme', G.programme);
    case 'event':
      return ctx.cohort ? pick(`event:${ctx.cohort}`, EVENT_BY_COHORT[ctx.cohort]) : pick('event', G.event);
    case 'participant':
      return pick('participant', G.participant);
    case 'account':
      return authed ? null : pick('account', G.account); // signed-in users never get the sign-in help tip
    case 'payment':
      return pick('payment', G.payment);
    case 'support':
      return pick('support', G.support);
    case 'dashboard': {
      if (!authed) return null;
      const r = dashboardRole(role);
      return pick(`dashboard:${r}`, DASHBOARD_BY_ROLE[r]);
    }
    default:
      return null; // 'general' → no proactive bubble
  }
}
