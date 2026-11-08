// Ready-made proposal email templates for the admin Org Enquiries pipeline.
// Built from the enquiry plus the SAME shared copy the public site uses
// (lib/org/pricing, lib/org/enquiry), so a proposal never quotes different
// figures from the website. Output is plain text the admin edits before sending;
// the backend escapes it and lays out paragraphs / "• " bullet lists.
import type { OrgEnquiry } from '@/lib/server/org-enquiries';
import { COHORT_RATES, FEE_STORY, MONTH_STEPS, PHASES, SESSIONS_PER_MONTH, SESSIONS_PER_WEEK, UNAPPROVED_BANDS_TEXT, estimate, inr, inrRate, type Months } from '@/lib/org/pricing';
import { DURATIONS, ENQ_COHORTS, INTERESTS, PARTICIPANT_LABELS, START_PERIODS, labelOf } from '@/lib/org/enquiry';

export type ProposalTemplateKey = 'programme' | 'call';
export type ProposalDraft = { key: ProposalTemplateKey; label: string; hint: string; subject: string; body: string };

// PHASES[0] is the 1-month starter; PHASES[1..3] are the 3 / 6 / 12-month phases.
const PHASE_BY_DURATION: Record<string, number> = { '1_MONTH': 0, '3_MONTHS': 1, '6_MONTHS': 2, '12_MONTHS': 3 };
const MONTHS_BY_DURATION: Record<string, Months> = { '1_MONTH': 1, '3_MONTHS': 3, '6_MONTHS': 6, '12_MONTHS': 12 };
const mo = (m: number) => `${m} month${m === 1 ? '' : 's'}`;

function planLines(duration: string): string[] {
  const idx = PHASE_BY_DURATION[duration];
  if (idx === undefined) {
    const p = PHASES[1];
    return [
      `• We usually recommend starting with ${p.phase.replace(' · ', ', ')}: ${p.title} (${p.desc}), then extending to 6 or 12 months once you see the impact. A 1-month starter (${SESSIONS_PER_MONTH} sessions) is also available.`,
    ];
  }
  const phases = idx === 0 ? [PHASES[0]] : PHASES.slice(1, idx + 1);
  return phases.map((p) => `• ${p.phase}: ${p.title}. ${p.desc}`);
}

function investmentLines(e: OrgEnquiry): string[] {
  const cohort = e.cohort in COHORT_RATES ? (e.cohort as keyof typeof COHORT_RATES) : 'COMPANY';
  const c = COHORT_RATES[cohort];
  // Prompt 3C: list rate only; the suspended group-size discounts carry the UNAPPROVED label.
  const lines = [`• List rate: ${inrRate(c.rate)} per participant per session, ${SESSIONS_PER_WEEK} sessions a week (${SESSIONS_PER_MONTH} a month), for any group size and length`];
  if (!c.unapprovedBands) lines.push(`• Exclusive campus rate for students and faculty only (a flat rate, no further discounts)`);
  lines.push(`• Per participant at the list rate: ${MONTH_STEPS.map((m) => `${mo(m)} ${inr(estimate(cohort, m, 0).perPerson)}`).join(' · ')}`);
  const months = MONTHS_BY_DURATION[e.duration];
  if (months) {
    lines.push(`• For your group (${labelOf(PARTICIPANT_LABELS, e.participants)} people, ${mo(months)}): about ${inr(estimate(cohort, months, 0).perPerson)} per participant at the list rate`);
  }
  if (c.unapprovedBands) lines.push(`• ${UNAPPROVED_BANDS_TEXT}`);
  lines.push(`• ${FEE_STORY}`);
  return lines;
}

function programmeTemplate(e: OrgEnquiry): ProposalDraft {
  const interests = e.interests.map((k) => INTERESTS.find((i) => i.key === k)).filter(Boolean) as typeof INTERESTS;
  const body = [
    `Dear ${e.contact_name},`,
    `Thank you for your enquiry (${e.ref}) about a Yoga programme for ${e.organisation_name}. Based on what you shared with us, here is our proposal.`,
    [
      'What you told us',
      `• Organisation type: ${labelOf(ENQ_COHORTS, e.cohort)}`,
      `• City: ${e.city}`,
      `• Approx. participants: ${labelOf(PARTICIPANT_LABELS, e.participants)}`,
      `• Preferred duration: ${labelOf(DURATIONS, e.duration)}`,
      `• Preferred start: ${labelOf(START_PERIODS, e.start_period)}`,
    ].join('\n'),
    ['Recommended programme', ...interests.map((i) => `• ${i.label}: ${i.desc}`)].join('\n'),
    [
      'How it runs',
      '• Delivered on-site by a NOSTOPS-provided, Council-vetted teacher',
      '• Programmes curated by the NOSTOPS Council of Gurus',
      ...planLines(e.duration),
    ].join('\n'),
    ['Indicative investment', ...investmentLines(e)].join('\n'),
    'Next steps\nReply to this email to go ahead, or tell us a good time for a short call. We will then finalise dates, the venue and your teacher.',
    'Warm regards,\nThe NOSTOPS team',
  ].join('\n\n');
  return {
    key: 'programme',
    label: 'Full programme proposal',
    hint: 'Their details, matching programme pillars, duration and list-rate pricing (group-size discounts are unapproved and not offered).',
    subject: `Your NOSTOPS programme proposal · ${e.organisation_name} (${e.ref})`.slice(0, 200),
    body,
  };
}

function callTemplate(e: OrgEnquiry): ProposalDraft {
  const body = [
    `Dear ${e.contact_name},`,
    `Thank you for reaching out about a Yoga programme for ${e.organisation_name} (${e.ref}). We would love to understand your goals in a little more detail before we put a tailored proposal together.`,
    'Could we set up a short 20-minute call? Use the "Book a call" button below to suggest a time, or simply reply with two or three slots that suit you.',
    'Warm regards,\nThe NOSTOPS team',
  ].join('\n\n');
  return {
    key: 'call',
    label: 'Personal note + book a call',
    hint: 'A short personal note with a "Book a call" button.',
    subject: `Next steps for ${e.organisation_name}'s Yoga programme (${e.ref})`.slice(0, 200),
    body,
  };
}

export function buildProposalTemplates(e: OrgEnquiry): ProposalDraft[] {
  return [programmeTemplate(e), callTemplate(e)];
}
