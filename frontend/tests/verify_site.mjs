// Unit tests for lib/site.ts canonical-origin helpers.
// Run: node tests/verify_site.mjs   (executed via `npm run test:site`)
// This file is .mjs so it is ignored by tsc/Next but runnable by Node (which
// strips types from the imported .ts on the fly).
import { canonical, toWww, SITE_URL } from '../lib/site.ts';

let pass = 0;
let fail = 0;
function eq(label, got, want) {
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${ok ? '' : `\n   got:  ${got}\n   want: ${want}`}`);
}

console.log('SITE_URL =', SITE_URL);
eq('canonical("/")', canonical('/'), 'https://www.nostops.org/');
eq('canonical("/teachers")', canonical('/teachers'), 'https://www.nostops.org/teachers');
eq('canonical("/teachers/foo")', canonical('/teachers/foo'), 'https://www.nostops.org/teachers/foo');
eq('canonical dedupe slashes', canonical('//teachers///foo'), 'https://www.nostops.org/teachers/foo');
eq('canonical no leading slash', canonical('teachers'), 'https://www.nostops.org/teachers');
eq('canonical keeps query+hash', canonical('/teachers?q=1&x=2#top'), 'https://www.nostops.org/teachers?q=1&x=2#top');
eq('canonical strips trailing slash', canonical('/teachers/'), 'https://www.nostops.org/teachers');
eq('canonical("/sitemap.xml")', canonical('/sitemap.xml'), 'https://www.nostops.org/sitemap.xml');
eq('toWww bare https', toWww('https://nostops.org/teachers/foo'), 'https://www.nostops.org/teachers/foo');
eq('toWww bare http -> https', toWww('http://nostops.org/x'), 'https://www.nostops.org/x');
eq('toWww already www', toWww('https://www.nostops.org/x'), 'https://www.nostops.org/x');
eq('toWww nostops.app unchanged', toWww('https://www.nostops.app/x'), 'https://www.nostops.app/x');
eq('toWww subdomain unchanged', toWww('https://api.nostops.org/x'), 'https://api.nostops.org/x');
eq('toWww external unchanged', toWww('https://instagram.com/foo'), 'https://instagram.com/foo');
eq('toWww relative unchanged', toWww('/relative'), '/relative');

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fail > 0) process.exit(1);
