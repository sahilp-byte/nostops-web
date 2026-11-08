// Regression guard for PROMPT 05/42 — "Nearby Attractions" is removed from the
// NOSTOPS venue + retreat content pipeline, while genuine GEOGRAPHIC DISCOVERY
// (near-me search, distance venue discovery, nearby cities, nearby-retreat
// discovery) and the venue->retreat binding are preserved intact.
//
// Two layers:
//   1. SOURCE-LEVEL (deterministic): the venue/retreat content + import/display
//      pipeline files no longer carry a Nearby Attractions field/render; the
//      geo-discovery + venue_partner_id binding identifiers still exist.
//   2. HTTP (best-effort): public /venues, /retreats and /sitemap.xml stay 200
//      and SEO/binding is unaffected; any live venue/retreat detail page emits
//      no "Nearby" attractions section, FAQ answer or structured data.
//
// Usage:
//   node tests/verify_no_nearby.mjs [SITE_BASE]
//   default: SITE_BASE=http://localhost:3000
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SITE = process.argv[2] || process.env.SITE_BASE || 'http://localhost:3000';

let pass = 0;
let fail = 0;
function check(label, cond, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${cond ? '' : `  ${extra}`}`);
}

const read = (rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

// Matches the removed FEATURE only: "nearbyAttractions" / "nearby_attractions"
// / "nearby attractions". Does NOT match geographic-discovery words such as
// nearbyVenues, nearbyCities, nearbyRetreats, getNearbyVenues, NearbyPanel.
const ATTRACTION_RE = /nearby[_\s]?attraction/i;

// --- Layer 1: source-level feature removal ----------------------------------
const CONTENT_FILES = [
  'lib/server/venues.ts',
  'lib/server/retreats.ts',
  'lib/server/venue-review.ts',
  'lib/server/retreat-host.ts',
  'lib/retreat-draft.ts',
  'lib/retreat-duplicate.ts',
  'app/(public)/venues/[venue_id]/page.tsx',
  'app/(public)/retreats/in/[city]/[retreat]/page.tsx',
  'app/app/admin/venue-review/[id]/page.tsx',
  'app/bff/teacher/retreats/create/route.ts',
  'components/app/teacher/HostRetreatWizard.tsx',
];

console.log('----- SOURCE: Nearby Attractions removed -----');
for (const f of CONTENT_FILES) {
  const src = read(f);
  check(`file present: ${f}`, src != null, 'missing');
  if (src == null) continue;
  const hits = src.split('\n').filter((l) => ATTRACTION_RE.test(l));
  check(`no Nearby Attractions in ${f}`, hits.length === 0, hits.slice(0, 2).join(' | '));
}

// --- Layer 2: geographic discovery + binding preserved ----------------------
console.log('\n----- SOURCE: geographic discovery + venue binding preserved -----');
const venuesSrc = read('lib/server/venues.ts') || '';
check('getNearbyVenues() preserved', /getNearbyVenues/.test(venuesSrc));
check('getRetreatsAtVenue() preserved', /getRetreatsAtVenue/.test(venuesSrc));
check('venue->retreat binding via venuePartnerId preserved', /venuePartnerId\s*===\s*venueId/.test(venuesSrc));
check('NearbyPanel component present', read('components/app/learner/NearbyPanel.tsx') != null);
check('near-me BFF route present', read('app/bff/nearby/route.ts') != null);
const btCity = read('app/(public)/become-a-teacher/[city]/page.tsx') || '';
check('nearby cities / nearby retreats discovery preserved',
  /nearbyCities/.test(btCity) && /nearbyRetreats/.test(btCity));
const discover = read('app/app/discover/page.tsx') || '';
check('distance-based nearby-venues discovery preserved',
  /getNearbyVenues/.test(discover) && /nearby-venues/.test(discover));

// --- Layer 3: HTTP (best-effort; skips gracefully if site not running) ------
async function http() {
  console.log(`\n----- HTTP (best-effort) SITE=${SITE} -----`);
  let sitemap = '';
  try {
    const s = await fetch(`${SITE}/sitemap.xml`);
    sitemap = await s.text();
    check('sitemap.xml 200', s.ok, `status ${s.status}`);
    check('sitemap still advertises /venues (SEO/binding intact)', /\/venues(<|\/)/.test(sitemap));
  } catch (e) {
    console.log(`SKIP | sitemap.xml unreachable (${e.message})`);
    return;
  }
  for (const path of ['/venues', '/retreats']) {
    try {
      const r = await fetch(`${SITE}${path}`);
      check(`${path} 200`, r.ok, `status ${r.status}`);
    } catch (e) {
      console.log(`SKIP | ${path} unreachable (${e.message})`);
    }
  }
  // Probe a live venue + retreat detail page from the sitemap, if any.
  const venueUrl = (sitemap.match(/<loc>([^<]*\/venues\/[^<]+)<\/loc>/i) || [])[1];
  const retreatUrl = (sitemap.match(/<loc>([^<]*\/retreats\/in\/[^<]+)<\/loc>/i) || [])[1];
  for (const [label, url] of [['venue', venueUrl], ['retreat', retreatUrl]]) {
    if (!url) {
      console.log(`SKIP | no live ${label} detail page in sitemap`);
      continue;
    }
    try {
      const r = await fetch(url);
      const html = await r.text();
      const hasSection = /<h3[^>]*>\s*Nearby\s*<\/h3>/i.test(html);
      const hasFaqOrLd = /Nearby:\s/i.test(html);
      check(`live ${label} page has no Nearby section`, !hasSection, url);
      check(`live ${label} page FAQ/schema has no "Nearby:" text`, !hasFaqOrLd, url);
    } catch (e) {
      console.log(`SKIP | ${label} detail unreachable (${e.message})`);
    }
  }
}

await http();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
