// Phase A regression checks (Organisation Events & Programme audit) — pure logic
// that does not need a browser. Node 24 strips the TS types natively.
// Run: node tests/verify_phase_a.ts
import { cohortFromKey, derivePageContext, openingPrompt } from '../components/guru/context.ts';
import { INTERESTS, PARTICIPANTS, PARTICIPANT_LABELS, labelOf } from '../lib/org/enquiry.ts';
import { UNAPPROVED_BANDS } from '../lib/org/pricing.ts';

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`  \u2713 ${name}`);
  else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}

console.log('OEA-26 · cohort-aware AI Guru greetings:');
check('cohortFromKey maps the three cohorts', cohortFromKey('COMPANY') === 'company' && cohortFromKey('EDUCATIONAL_INSTITUTION') === 'educational' && cohortFromKey('STARTUP_NETWORK') === 'startup');
check('cohortFromKey ignores unknown keys', cohortFromKey('X') === undefined && cohortFromKey(null) === undefined);
const evCtx = derivePageContext('/events/some-event');
const evEdu = openingPrompt({ ...evCtx, cohort: 'educational' }, null, false)!;
check('campus event greeting mentions campus', /campus/i.test(evEdu.greeting), evEdu.greeting);
check('campus event never asks "my company"', !evEdu.questions.some((q) => /my company/i.test(q)), evEdu.questions);
const evStart = openingPrompt({ ...evCtx, cohort: 'startup' }, null, false)!;
check('network event asks about the network', evStart.questions.some((q) => /network/i.test(q)), evStart.questions);
const evCo = openingPrompt({ ...evCtx, cohort: 'company' }, null, false)!;
check('company event keeps company wording', evCo.questions.some((q) => /my company/i.test(q)), evCo.questions);
const evNone = openingPrompt(evCtx, null, false)!;
check('cohort-unknown event is neutral (no "my company")', !evNone.questions.some((q) => /my company/i.test(q)), evNone.questions);
const wiz = derivePageContext('/app/org/events/new');
check('wizard route is the programme page type', wiz.page_type === 'programme', wiz.page_type);
const wizEdu = openingPrompt({ ...wiz, cohort: 'educational' }, 'hr', true)!;
check('wizard (education) talks about students', wizEdu.questions.some((q) => /students/i.test(q)), wizEdu.questions);
const wizStart = openingPrompt({ ...wiz, cohort: 'startup' }, 'learner', true)!;
check('wizard creator greeting for any signed-in org user', wizStart.questions.some((q) => /members/i.test(q)), wizStart.questions);
check('cohort greetings have distinct dismissal keys', new Set([evEdu.key, evStart.key, evCo.key, evNone.key]).size === 4);
const orgs = openingPrompt(derivePageContext('/for-organisations'), null, false)!;
check('generic organisations page is neutral', !orgs.questions.some((q) => /my company/i.test(q)), orgs.questions);

console.log('OEA-14 · enquiry participant bands match the price tiers:');
const labels = PARTICIPANTS.map((p) => p.label);
for (const t of UNAPPROVED_BANDS) {
  check(`band "${t.min}–${t.max}" offered`, labels.includes(`${t.min}–${t.max}`), labels);
}
check('no age-like "Under 18" option', !labels.includes('Under 18'), labels);
check('legacy keys still display', labelOf(PARTICIPANT_LABELS, '18_28') === '18–28' && labelOf(PARTICIPANT_LABELS, '100_PLUS') === '100+');

console.log('OEA-27 · Special Needs copy is not medicalised:');
const sn = INTERESTS.find((i) => i.key === 'SPECIAL_NEEDS')!;
check('label stays "Special Needs"', sn.label === 'Special Needs');
check('description avoids medical wording', !/health|medical|clinical|condition|therap|patient|disorder|learning needs/i.test(sn.desc), sn.desc);

if (failures) {
  console.error(`\n\u2717 PHASE A CHECKS FAILED \u2014 ${failures} assertion(s).`);
  process.exit(1);
}
console.log('\n\u2713 PHASE A CHECKS PASSED');
