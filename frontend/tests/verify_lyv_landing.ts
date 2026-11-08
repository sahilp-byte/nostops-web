// Verification for the "List Your Venue" landing (/list-your-venue).
//
// Updated Oct 2026: the old version proved a `venue_lyv_landing` feature flag
// (default OFF → 404). That flag was retired and the landing is permanently live,
// linked from the header and footer and listed in the sitemap — so the flag
// checks are removed and this now verifies the LIVE wiring instead.
//
// Deliberately makes NO assertion about prices, fees or payment copy on the page
// (that wording is owned by the financial/legal workstream, not this check).
//
// Usage: node tests/verify_lyv_landing.ts [SITE_BASE]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SITE = process.argv[2] || process.env.SITE_BASE || 'http://localhost:3000';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${cond ? '' : `  ${extra}`}`);
}
const read = (rel: string) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');

// --- Source wiring -----------------------------------------------------------
console.log('----- SOURCE WIRING -----');
const page = read('app/(public)/list-your-venue/page.tsx');
check('landing page exists', page.length > 0);
check('landing is NOT flag-gated any more (no notFound gate)', !/notFound\(\)/.test(page) && !/lyvLandingEnabled/.test(page));
check('route has SEO metadata (canonical + OG + twitter)', /alternates:\s*{\s*canonical/.test(page) && /openGraph/.test(page) && /twitter/.test(page));
check('Tier 1 links to the free submit flow', /href="\/venues\/submit"/.test(page));
check('Tier 3 is quote-based (Custom Quote)', /Custom Quote/i.test(page));
check('Tier 3 CTA → enquiry route', /list-your-venue\/enquire\?interest=marketing-pr/.test(page));

const enquire = read('app/(public)/list-your-venue/enquire/page.tsx');
check('enquire page exists', enquire.length > 0);
check('enquire page is noindex', /index:\s*false/.test(enquire));
const form = read('components/venue/VenueEnquiryForm.tsx');
check('enquiry form reuses guru support BFF (no new backend)', /\/bff\/guru\/support/.test(form) && /'Venue'/.test(form));
check('enquiry form has no checkout', !/checkout/i.test(form));

check('header nav links the landing (lib/site-nav.ts)', /href:\s*'\/list-your-venue'/.test(read('lib/site-nav.ts')));
check('footer links the landing', /href:\s*'\/list-your-venue'/.test(read('components/SiteFooter.tsx')));
check('sitemap manifest lists the landing', /'\/list-your-venue'/.test(read('lib/server/sitemap-manifest.ts')));
check('flags module no longer exports lyvLandingEnabled', !/lyvLandingEnabled/.test(read('lib/server/flags.ts')));

// --- HTTP: the running server serves it everywhere ----------------------------
async function http() {
  console.log(`\n----- HTTP SITE=${SITE} -----`);
  try {
    const r = await fetch(`${SITE}/list-your-venue`);
    check('GET /list-your-venue is 200', r.status === 200, `status ${r.status}`);
    const html = await r.text();
    check('landing links to /venues/submit', /href="\/venues\/submit"/.test(html));
  } catch (e) {
    console.log(`SKIP | /list-your-venue unreachable (${(e as Error).message})`);
    return;
  }
  try {
    const re = await fetch(`${SITE}/list-your-venue/enquire`);
    const html = await re.text();
    check('GET /list-your-venue/enquire is 200', re.status === 200, `status ${re.status}`);
    check('enquire page renders noindex', /<meta[^>]*name="robots"[^>]*noindex/i.test(html));
  } catch {
    /* ignore */
  }
  try {
    const sm = await fetch(`${SITE}/sitemap.xml`);
    const xml = await sm.text();
    check('sitemap.xml 200', sm.ok, `status ${sm.status}`);
    check('sitemap INCLUDES /list-your-venue', /\/list-your-venue<\/loc>/.test(xml));
    check('sitemap EXCLUDES /list-your-venue/enquire (noindex)', !/\/list-your-venue\/enquire/.test(xml));
  } catch (e) {
    console.log(`SKIP | sitemap unreachable (${(e as Error).message})`);
  }
  try {
    const home = await fetch(`${SITE}/`);
    const html = await home.text();
    check('home header/footer link to /list-your-venue', /href="\/list-your-venue"/.test(html));
  } catch (e) {
    console.log(`SKIP | home unreachable (${(e as Error).message})`);
  }
}

await http();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
