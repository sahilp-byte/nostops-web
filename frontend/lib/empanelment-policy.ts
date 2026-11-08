// Empanelment Policy V2 (founder-approved, 2026-06) — the TEXT shown on the
// website. Evaluation itself happens only in the backend (empanelment_policy.py);
// these numbers mirror it and a backend test checks they stay identical.
export const POLICY_VERSION = 'EMPANELMENT_POLICY_V2_2026_06';
export const MIN_SUCCESSFUL_SESSIONS = 5;
export const MIN_GENUINE_REVIEWS = 10;
export const MIN_AVG_RATING = 3.5;
export const POSITIVE_MIN_STARS = 3;
export const FAST_TRACK_FEE_INR = 4999;

// "Not approved" BEFORE the Council interaction needs one of these documented
// reasons. Incomplete progress is deliberately not a reason.
export const DECLINE_REASONS: { code: string; label: string }[] = [
  { code: 'FALSE_EVIDENCE', label: 'False or copied evidence or credentials' },
  { code: 'SAFETY_CONDUCT', label: 'Safety or conduct concern' },
  { code: 'TEACHER_WITHDREW', label: 'Teacher asked to withdraw' },
  { code: 'DUPLICATE_ACCOUNT', label: 'Duplicate or wrong account' },
];

export const FREE_PATH_STEPS = [
  { title: 'Five successful 1:1 sessions', desc: `Complete at least ${MIN_SUCCESSFUL_SESSIONS} 1:1 sessions on NOSTOPS. A paid session counts once NOSTOPS has confirmed the payment. Refunded sessions and sessions not yet marked completed do not count.` },
  { title: 'Ten genuine reviews', desc: `Reviews from at least ${MIN_GENUINE_REVIEWS} different learners who each completed a NOSTOPS session with you. One review per learner. Reviews from outside NOSTOPS do not count.` },
  { title: 'Rating and feedback', desc: `An average of ${MIN_AVG_RATING}★ or more, and more than half of those reviews at ${POSITIVE_MIN_STARS}★ or above.` },
  { title: 'Council interaction', desc: 'A conversation with a member of the NOSTOPS Council of Yoga Gurus about your teaching and philosophy.' },
  { title: 'Final decision', desc: 'A Council guru or NOSTOPS admin makes the decision, then a NOSTOPS admin activates it. Nothing is approved automatically.' },
];

export const FREE_PATH_SUMMARY = `${MIN_SUCCESSFUL_SESSIONS} successful 1:1 sessions · ${MIN_GENUINE_REVIEWS} genuine reviews from different learners · ${MIN_AVG_RATING}★ average with more than half at ${POSITIVE_MIN_STARS}★+ · a Council interaction · a final Council decision · admin activation.`;

export const FAST_TRACK_TERMS = [
  'Your payment buys a priority 30–45 minute peer-review interview with a Council guru. That interview is your Council interaction.',
  'A Council guru or NOSTOPS admin then decides on merit, and a NOSTOPS admin activates an approval.',
  'Payment never guarantees approval and never adds a badge by itself.',
];

export const REVIEWS_HOW_TO =
  `You need ${MIN_GENUINE_REVIEWS} reviews from ${MIN_GENUINE_REVIEWS} different learners, but only ${MIN_SUCCESSFUL_SESSIONS} sessions. ` +
  'The other reviews come from more learners who complete a NOSTOPS session with you, such as more 1:1 sessions with new learners. ' +
  'After each completed session, the learner is invited to leave one review from their NOSTOPS account.';
