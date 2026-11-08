// Route-level verification for the PUBLIC /robots.txt and /sitemap.xml feeds.
// Tests the ACTUAL Next.js route responses (not just helper functions).
// Phase 3: the sitemap is generated from ONE manifest (lib/server/sitemap-manifest.ts),
// no longer proxied from the backend — so it is checked against the same live
// data sources the pages use.
//
// Usage:
//   node tests/verify_seo_feeds.mjs [SITE_BASE] [MAIN_BACKEND_BASE]
//   defaults: SITE_BASE=http://localhost:3000  MAIN_BACKEND_BASE=BACKEND_URL from frontend/.env
import { readFileSync } from 'node:fs';

const SITE = process.argv[2] || process.env.SITE_BASE || 'http://localhost:3000';
const envBackend = (() => {
  try {
    return (/^BACKEND_URL=(.*)$/m.exec(readFileSync(new URL('../.env', import.meta.url), 'utf8')) || [])[1]?.trim();
  } catch {
    return undefined;
  }
})();
const BACKEND = (process.argv[3] || process.env.BACKEND_BASE || envBackend || 'http://localhost:8001').replace(/\/$/, '');

const WWW = 'https://www.nostops.org';
const BARE = 'https://nostops.org';

let pass = 0;
let fail = 0;
function check(label, cond, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${cond ? '' : `  ${extra}`}`);
}

const locsOf = (xml) => [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((m) => m[1].trim());
const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, '') || '/'; } catch { return u; } };

async function main() {
  console.log(`SITE=${SITE}  BACKEND=${BACKEND}\n`);

  // ---------- robots.txt ----------
  const rRes = await fetch(`${SITE}/robots.txt`);
  const robots = await rRes.text();
  const rCT = rRes.headers.get('content-type') || '';
  check('robots Content-Type is text/plain', rCT.includes('text/plain'), `got: ${rCT}`);
  check('robots is not HTML/JSON', !robots.trim().startsWith('<') && !robots.trim().startsWith('{'));
  check('robots has canonical Sitemap line', robots.includes(`Sitemap: ${WWW}/sitemap.xml`));
  check('robots does NOT contain bare origin', !robots.includes(BARE + '/') && !robots.includes(`${BARE}/sitemap`));
  check('robots Sitemap does NOT expose /api/seo/', !robots.includes('/api/seo/'));
  check('robots keeps Disallow: /api/', robots.includes('Disallow: /api/'));
  check('robots keeps Disallow: /app/', robots.includes('Disallow: /app/'));
  check('robots keeps Disallow: /bff/', robots.includes('Disallow: /bff/'));
  // Phase 4 AI-agent policy: search/answer agents allowed, training-only agents blocked.
  const group = (ua) => (robots.split(/\n\s*\n/).find((g) => g.split('\n')[0].trim() === `User-agent: ${ua}`) || '');
  for (const ua of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', 'Claude-User']) {
    check(`robots allows ${ua}`, group(ua).includes('Allow: /') && !/Disallow: \/\s*$/m.test(group(ua)), group(ua) || '(missing)');
  }
  for (const ua of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'Amazonbot', 'Meta-ExternalAgent']) {
    check(`robots blocks training agent ${ua}`, /^Disallow: \/$/m.test(group(ua)) && !group(ua).includes('Allow: /'), group(ua) || '(missing)');
  }

  // ---------- sitemap.xml ----------
  const sRes = await fetch(`${SITE}/sitemap.xml`);
  const sitemap = await sRes.text();
  const sCT = sRes.headers.get('content-type') || '';
  const locs = locsOf(sitemap);
  const paths = locs.map(pathOf);
  const pathSet = new Set(paths);

  check('sitemap Content-Type is xml', sCT.includes('xml'), `got: ${sCT}`);
  check('sitemap looks like valid XML (declaration + urlset)',
    sitemap.trim().startsWith('<?xml') && /<urlset[\s>]/.test(sitemap) && sitemap.includes('</urlset>'));
  check('sitemap <loc>/</loc> counts match', (sitemap.match(/<loc>/g) || []).length === (sitemap.match(/<\/loc>/g) || []).length);
  check('sitemap <url>/</url> counts match', (sitemap.match(/<url>/g) || []).length === (sitemap.match(/<\/url>/g) || []).length);
  check('sitemap has URLs', locs.length > 0, `count: ${locs.length}`);
  check('EVERY <loc> uses www origin', locs.every((l) => l.startsWith(WWW + '/')), locs.filter((l) => !l.startsWith(WWW)).slice(0, 3).join(', '));
  check('NO duplicate <loc>', new Set(locs).size === locs.length);
  check('NO <loc> points to /api/seo/', !locs.some((l) => l.includes('/api/seo/')));
  check('no data family was skipped (X-Sitemap-Skipped: none)', (sRes.headers.get('x-sitemap-skipped') || '') === 'none', sRes.headers.get('x-sitemap-skipped') || '(header missing)');

  // lastmod: valid W3C dates where present, none in the future.
  const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((m) => m[1]);
  const today = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  check('every <lastmod> is YYYY-MM-DD and not in the future', lastmods.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today), lastmods.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 3).join(', '));

  // Required static + family entries.
  for (const p of ['/', '/about', '/teachers', '/retreats', '/retreats/host', '/venues', '/venues/all', '/programmes', '/levels',
    '/for-organisations', '/for-organisations/impact', '/for-organisations/resources', '/council', '/paramparas', '/yoga-parampara',
    '/gurus', '/scriptures', '/guides', '/voices', '/yoga-teachers', '/privacy', '/terms', '/refunds', '/trust', '/faq', '/contact']) {
    check(`route present: ${p}`, pathSet.has(p));
  }

  // Never listed: private/token/auth/noindex/redirect/removed routes.
  const forbidden = [
    [/^\/(app|participant|bff|api|booking-invite|admin)(\/|$)/, 'private area'],
    [/^\/(login|register|signup|join|choose-role|verify-otp|reset-password|emergent-callback)(\/|$)/, 'auth page'],
    [/^\/(search|saved|venues\/saved|venues\/compare|venues\/submit|venues\/ai-onboarding|list-your-venue\/enquire|cashfree-return)(\/|$)/, 'noindex / policy page'],
    [/^\/(teacher-pulse\/(t|join)|verify)\//, 'token page'],
    [/^\/events\/[^/]+\/register$/, 'event register page'],
    [/^\/teachers\/in\//, 'noindex teacher alias'],
    [/^\/(cities)\/|^\/for-(companies|educational-institutions|startup-networks)$/, 'redirect stub'],
    [/^\/gurukul-retreats$/, 'removed page'],
  ];
  for (const [re, label] of forbidden) check(`no ${label} in sitemap`, !paths.some((p) => re.test(p)), paths.filter((p) => re.test(p)).slice(0, 3).join(', '));
  check('no bare /retreats/{id} URLs (only canonical city-nested)', !paths.some((p) => /^\/retreats\/(?!in(\/|$)|host$)[^/]+$/.test(p)),
    paths.filter((p) => /^\/retreats\/(?!in(\/|$)|host$)[^/]+$/.test(p)).slice(0, 3).join(', '));

  // Teachers: EVERY eligible directory profile listed, nothing else (no cap).
  try {
    const dir = (await (await fetch(`${BACKEND}/api/teachers/directory?limit=1000`)).json())?.teachers || [];
    const eligible = (t) => !!t?.handle && t.public_profile_visible !== false && t.is_active !== false && !t.suspended_at;
    const want = new Set(dir.filter(eligible).map((t) => `/teachers/${t.handle}`));
    const listed = new Set(paths.filter((p) => /^\/teachers\/[^/]+$/.test(p)));
    const missing = [...want].filter((p) => !listed.has(p));
    const extra = [...listed].filter((p) => !want.has(p));
    // The site also retires some handles from public surfaces (isPublicHandleBlocked);
    // those profile pages 404, so they must NOT be listed. Anything else missing is a gap.
    const gaps = [];
    for (const p of missing) {
      const r = await fetch(`${SITE}${p}`, { redirect: 'manual' }).catch(() => null);
      if (r && r.status === 200) gaps.push(p);
    }
    check('every eligible, publicly served teacher profile is listed', gaps.length === 0, gaps.slice(0, 5).join(', '));
    check('no ineligible teacher profile is listed', extra.length === 0, extra.slice(0, 5).join(', '));
    const tBlocks = [...sitemap.matchAll(/<url>(.*?)<\/url>/g)].map((m) => m[1]).filter((b) => /\/teachers\/[^/<]+<\/loc>/.test(b));
    check('teacher URLs carry <lastmod>', tBlocks.length > 0 && tBlocks.every((b) => b.includes('<lastmod>')), `${tBlocks.filter((b) => !b.includes('<lastmod>')).length} without`);
  } catch (e) {
    check('teacher directory reachable for comparison', false, e?.message);
  }

  console.log(`\nsitemap <loc> count: ${locs.length}  (lastmod on ${lastmods.length})`);
  console.log(`counts: ${sRes.headers.get('x-sitemap-counts')}`);
  console.log(`==== ${pass} passed, ${fail} failed ====`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('TEST ERROR:', e);
  process.exit(1);
});
