// Rendered-HTML SEO metadata check (Phase 3). Crawls every URL in the public
// sitemap (read-only GETs, Googlebot UA so metadata is in <head>) and checks
// each indexable page has: 200, no noindex, a unique <title>, a 50–160 char
// description, a self-referencing www canonical, og:image + twitter:image
// (1200×630, with alt text) and JSON-LD that parses with @context/@type.
// Also checks known noindex routes carry no misleading canonical and are not
// listed in the sitemap.
//
// Usage: node tests/verify_seo_metadata.mjs [SITE_BASE] [--limit=N] [--concurrency=N]
const args = process.argv.slice(2);
const SITE = args.find((a) => !a.startsWith('--')) || process.env.SITE_BASE || 'http://localhost:3000';
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const CONC = Number((args.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1] || 4);
const WWW = 'https://www.nostops.org';
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Public routes that must stay noindex (route matrix §5 C) — sampled with real paths.
const NOINDEX_SAMPLES = ['/search', '/saved', '/venues/saved', '/venues/compare', '/list-your-venue/enquire', '/venues/ai-onboarding', '/venues/ai-onboarding/result', '/programmes/compare', '/programmes/compare?p=yoga-for-focus-attention,yoga-for-better-sleep'];

let pass = 0;
let fail = 0;
const failures = [];
function check(label, cond, extra = '') {
  if (cond) pass++;
  else {
    fail++;
    failures.push(`${label}${extra ? `  ${extra}` : ''}`);
  }
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const head = (html) => html.slice(0, Math.max(html.indexOf('</head>'), 0) || html.length);
const meta = (h, attr, key) => {
  const re = new RegExp(`<meta[^>]*${attr}="${key.replace(/[:]/g, '\\:')}"[^>]*>`, 'gi');
  return [...h.matchAll(re)].map((m) => decode((/content="([^"]*)"/i.exec(m[0]) || [])[1] || ''));
};

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual' });
  return { status: r.status, html: r.status === 200 ? await r.text() : '' };
}

function inspect(path, html) {
  const h = head(html);
  const title = decode((/<title>([\s\S]*?)<\/title>/i.exec(h) || [])[1] || '').trim();
  const desc = meta(h, 'name', 'description')[0] || '';
  const robots = (meta(h, 'name', 'robots')[0] || '').toLowerCase();
  const canon = decode((/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i.exec(h) || /<link[^>]*href="([^"]*)"[^>]*rel="canonical"/i.exec(h) || [])[1] || '');
  const og = meta(h, 'property', 'og:image');
  const ogW = meta(h, 'property', 'og:image:width');
  const ogH = meta(h, 'property', 'og:image:height');
  const ogAlt = meta(h, 'property', 'og:image:alt');
  const tw = meta(h, 'name', 'twitter:image');
  const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  return { path, title, desc, robots, canon, og, ogW, ogH, ogAlt, tw, ld };
}

function validateLd(blocks) {
  const errs = [];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b);
      const nodes = Array.isArray(j) ? j : j['@graph'] ? [j, ...j['@graph']] : [j];
      for (const n of nodes) {
        if (n === j && j['@graph']) continue;
        if (!n['@type']) errs.push('missing @type');
      }
      const ctxOk = Array.isArray(j) ? j.every((n) => n['@context']) : !!j['@context'];
      if (!ctxOk) errs.push('missing @context');
    } catch (e) {
      errs.push(`invalid JSON (${String(e.message).slice(0, 40)})`);
    }
  }
  return errs;
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]).catch((e) => ({ error: String(e?.message || e), item: items[idx] }));
    }
  }));
  return out;
}

async function main() {
  const sm = await fetch(`${SITE}/sitemap.xml`).then((r) => r.text());
  let locs = [...sm.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  console.log(`SITE=${SITE}  sitemap URLs=${locs.length}`);
  check('sitemap has no duplicate <loc>', new Set(locs).size === locs.length);
  check('every sitemap <loc> is www', locs.every((l) => l.startsWith(`${WWW}/`)));
  if (LIMIT) locs = locs.slice(0, LIMIT);

  const pages = await pool(locs, CONC, async (loc) => {
    const path = loc.slice(WWW.length) || '/';
    const { status, html } = await get(`${SITE}${path}`);
    return { loc, status, ...(status === 200 ? inspect(path, html) : { path }) };
  });

  const titles = new Map();
  const dump = (args.find((a) => a.startsWith('--json=')) || '').split('=')[1];
  if (dump) (await import('node:fs')).writeFileSync(dump, JSON.stringify(pages.map(({ ld, ...p }) => ({ ...p, ldCount: ld?.length || 0 })), null, 1));
  for (const p of pages) {
    if (p.error) { check(`fetch ${p.item}`, false, p.error); continue; }
    const id = p.path;
    check(`${id} returns 200`, p.status === 200, `got ${p.status}`);
    if (p.status !== 200) continue;
    check(`${id} indexable (no noindex)`, !p.robots.includes('noindex'), p.robots);
    check(`${id} has <title>`, !!p.title);
    if (id !== '/') check(`${id} title is "Page name · NOSTOPS"`, p.title.endsWith(' · NOSTOPS') && !/NOSTOPS\s*·\s*NOSTOPS|— NOSTOPS ·/.test(p.title), p.title);
    titles.set(p.title, [...(titles.get(p.title) || []), id]);
    check(`${id} description 50–160 chars`, p.desc.length >= 50 && p.desc.length <= 160, `len=${p.desc.length}`);
    const selfCanon = p.canon === p.loc || (id === '/' && p.canon.replace(/\/$/, '') === p.loc.replace(/\/$/, ''));
    check(`${id} self canonical`, selfCanon, `canonical=${p.canon || '(none)'}`);
    check(`${id} og:image`, p.og.length > 0);
    check(`${id} og:image 1200×630`, p.ogW[0] === '1200' && p.ogH[0] === '630', `w=${p.ogW[0]} h=${p.ogH[0]}`);
    check(`${id} og:image:alt`, !!(p.ogAlt[0] || '').trim());
    check(`${id} twitter:image`, p.tw.length > 0);
    const ldErr = validateLd(p.ld);
    check(`${id} JSON-LD present`, p.ld.length > 0);
    check(`${id} JSON-LD valid`, ldErr.length === 0, ldErr.join('; '));
  }
  for (const [t, ids] of titles) check(`unique title "${t.slice(0, 60)}"`, ids.length === 1, ids.slice(0, 4).join(', '));

  // Opt-in (--render-og=N): the share image of one page per route family must
  // actually render (image/*). Sequential and capped — compiling many image
  // routes at once can overload a dev server.
  const ogCap = Number((args.find((a) => a.startsWith('--render-og=')) || '').split('=')[1] || 0);
  const sampled = new Set();
  for (const p of pages) {
    if (sampled.size >= ogCap) break;
    if (!p.og?.length) continue;
    const fam = p.path.split('/').slice(0, 2).join('/') + (p.path.split('/').length > 2 ? '/*' : '');
    if (sampled.has(fam)) continue;
    sampled.add(fam);
    const img = p.og[0].replace(WWW, SITE);
    const r = await fetch(img, { headers: { 'User-Agent': UA } }).catch(() => null);
    const ct = r?.headers.get('content-type') || '';
    check(`${fam} og:image renders`, !!r && r.status === 200 && ct.startsWith('image/'), `${r?.status} ${ct} ${img}`);
  }

  // noindex routes: never in the sitemap, and no canonical pointing elsewhere.
  for (const path of NOINDEX_SAMPLES) {
    const { status, html } = await get(`${SITE}${path}`);
    if (status !== 200) { check(`${path} (noindex sample) loads`, false, `got ${status}`); continue; }
    const p = inspect(path, html);
    check(`${path} is noindex`, p.robots.includes('noindex'), p.robots || '(none)');
    check(`${path} no misleading canonical`, !p.canon || p.canon === `${WWW}${path}`, p.canon);
    check(`${path} not in sitemap`, !sm.includes(`<loc>${WWW}${path}</loc>`));
  }
  check('no /app, /participant, /bff or token URL in sitemap', !/<loc>[^<]*\/(app|participant|bff|api|booking-invite)\//.test(sm));

  // Summarise failures by check type so large crawls stay readable.
  const byType = new Map();
  for (const f of failures) {
    const k = f.replace(/^\S+\s/, '').replace(/\s{2}.*$/, '');
    byType.set(k, [...(byType.get(k) || []), f]);
  }
  for (const [k, list] of byType) {
    console.log(`\nFAIL x${list.length} | ${k}`);
    for (const f of list.slice(0, 12)) console.log(`   - ${f}`);
    if (list.length > 12) console.log(`   … ${list.length - 12} more`);
  }
  console.log(`\npages crawled: ${pages.length}`);
  console.log(`==== ${pass} passed, ${fail} failed ====`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('TEST ERROR:', e);
  process.exit(1);
});
