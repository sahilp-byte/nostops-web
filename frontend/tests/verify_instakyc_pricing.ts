// InstaKYC pricing invariants — single source of truth (lib/pricing.ts).
// Node 24 strips the TS types natively.
// Run: node tests/verify_instakyc_pricing.ts
import {
  INSTAKYC_PRICE_INR,
  INSTAKYC_GST_PCT,
  INSTAKYC_BASE_INR,
  INSTAKYC_GST_INR,
  instaKycPriceLabel,
} from '../lib/pricing.ts';

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    console.log(`  \u2713 ${name}`);
  } else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${String(got)})` : ''}`);
  }
}

console.log('INSTAKYC PRICING:');
check('current price is \u20b9279', INSTAKYC_PRICE_INR === 279, INSTAKYC_PRICE_INR);
check('GST rate is 18%', INSTAKYC_GST_PCT === 18, INSTAKYC_GST_PCT);
// Prompt 3 rule R3: exact to the paisa (no whole-rupee rounding of the split).
check('base + GST == total (paise)', Math.round(INSTAKYC_BASE_INR * 100) + Math.round(INSTAKYC_GST_INR * 100) === INSTAKYC_PRICE_INR * 100, `${INSTAKYC_BASE_INR}+${INSTAKYC_GST_INR}`);
check(
  'base derived GST-inclusive to the paisa',
  Math.round(INSTAKYC_BASE_INR * 100) === Math.round((INSTAKYC_PRICE_INR * 100 * 100) / (100 + INSTAKYC_GST_PCT)),
  INSTAKYC_BASE_INR,
);
check('label formats as \u20b9279', instaKycPriceLabel() === '\u20b9279', instaKycPriceLabel());
check('base label formats as \u20b9236.44', instaKycPriceLabel(INSTAKYC_BASE_INR) === '\u20b9236.44', instaKycPriceLabel(INSTAKYC_BASE_INR));
check('GST label formats as \u20b942.56', instaKycPriceLabel(INSTAKYC_GST_INR) === '\u20b942.56', instaKycPriceLabel(INSTAKYC_GST_INR));
check(
  'no legacy \u20b9799 in the price config',
  INSTAKYC_PRICE_INR !== 799 && INSTAKYC_BASE_INR !== 799 && INSTAKYC_GST_INR !== 799,
);

if (failures) {
  console.error(`\n\u2717 INSTAKYC PRICING FAILED \u2014 ${failures} assertion(s).`);
  process.exit(1);
}
console.log('\n\u2713 INSTAKYC PRICING PASSED \u2014 \u20b9279 all-in (\u20b9236.44 base + \u20b942.56 GST), single source of truth.');
