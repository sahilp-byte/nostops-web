# Programme detail pages (/programmes/<slug>) — HTTP/SEO/content regression checks.
# Usage: python3 tests/verify_programme_details.py [BASE_URL]
import json
import re
import sys
import requests

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000').rstrip('/')
PASS, FAIL = 0, 0


def check(cond, msg):
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        print('FAIL |', msg)


def meta(html, attr, key):
    m = re.search(r'<meta[^>]+%s="%s"[^>]*>' % (attr, re.escape(key)), html)
    if not m:
        return None
    c = re.search(r'content="([^"]*)"', m.group(0))
    return c.group(1) if c else None


lst = requests.get(BASE + '/programmes', timeout=30).text
slugs = sorted(set(re.findall(r'data-testid="programme-card-([a-z0-9-]+)"', lst)))
check(len(slugs) == 10, f'/programmes has 10 cards (got {len(slugs)})')
hrefs = set(re.findall(r'href="/programmes/([a-z0-9-]+)"', lst))
check(set(slugs) <= hrefs, 'every card links to /programmes/<slug>')
pathway = {}
for s in slugs:
    r = requests.get(f'{BASE}/programmes/{s}', timeout=30)
    h = r.text
    check(r.status_code == 200, f'{s} status {r.status_code}')
    for tid in ['programme-hero', 'programme-pathway', 'programme-dev-note', 'programme-title', 'programme-create',
                'programme-request-proposal', 'programme-dev-disclaimer', 'programme-outcomes', 'programme-audience',
                'programme-teacher', 'programme-facts', 'programme-cohorts', 'programme-related']:
        check(f'data-testid="{tid}"' in h, f'{s} has [{tid}]')
    check('In development' in h and 'pending Council review' in h, f'{s} dev note text')
    check('Council-Curated' in h, f'{s} Council-Curated chip')
    check(re.search(r'href="/app/org/events/new"[^>]*data-testid="programme-create"', h) is not None,
          f'{s} create href exact /app/org/events/new')
    check('href="#enquire"' in h and 'id="enquire"' in h, f'{s} #enquire anchor + target')
    for lab in ['At a glance', 'Group size', 'How often', 'Session length', 'Level', 'Languages']:
        check(lab in h, f'{s} facts "{lab}"')
    for c in ['/for-organisations/companies', '/for-organisations/educational-institutions', '/for-organisations/startup-networking-groups']:
        check(f'href="{c}"' in h, f'{s} cohort link {c}')
    check('₹' not in h and not re.search(r'\bINR\b|Rs\.\s?\d', h), f'{s} no price/₹')
    pw = re.search(r'data-testid="programme-pathway"[^>]*>([^<]+)<', h)
    pathway[s] = pw.group(1) if pw else None
    title = re.search(r'<title>([^<]*)</title>', h)
    t = title.group(1) if title else ''
    check(t.endswith('Programme · NOSTOPS') and f'— {pathway[s]} Programme' in t, f'{s} title "{t}"')
    d = meta(h, 'name', 'description') or ''
    check(50 <= len(d) <= 160, f'{s} desc len {len(d)}')
    rb = (meta(h, 'name', 'robots') or '').replace(' ', '')
    check('index' in rb and 'noindex' not in rb and 'follow' in rb, f'{s} robots "{rb}"')
    can = re.search(r'<link rel="canonical" href="([^"]+)"', h)
    check(can and can.group(1) == f'https://www.nostops.org/programmes/{s}', f'{s} canonical {can and can.group(1)}')
    check(meta(h, 'property', 'og:image') is not None, f'{s} og:image')
    check(meta(h, 'name', 'twitter:image') is not None, f'{s} twitter:image')
    check('BreadcrumbList' in h, f'{s} BreadcrumbList JSON-LD')
    related = re.findall(r'data-testid="programme-related-([a-z0-9-]+)"', h)
    pathway.setdefault('_rel', {})[s] = related
for s, rel in pathway['_rel'].items():
    for r in rel:
        check(pathway.get(r) == pathway[s], f'{s} related {r} same pathway ({pathway.get(r)} vs {pathway[s]})')
        check(r != s, f'{s} related excludes self')
r = requests.get(BASE + '/programmes/does-not-exist', timeout=30)
check(r.status_code == 404, f'does-not-exist status {r.status_code}')
sm = requests.get(BASE + '/sitemap.xml', timeout=60)
for s in slugs:
    check(f'https://www.nostops.org/programmes/{s}</loc>' in sm.text, f'sitemap has {s}')
check('programmes=10' in sm.headers.get('X-Sitemap-Counts', ''), f"X-Sitemap-Counts {sm.headers.get('X-Sitemap-Counts')}")
# Cohort landing pathway cards → programme detail
for page, tid in [('companies', 'companies'), ('educational-institutions', 'schools'), ('startup-networking-groups', 'startups')]:
    h = requests.get(f'{BASE}/for-organisations/{page}', timeout=30).text
    for k in ['mind', 'body', 'special-needs']:
        m = re.search(r'<a[^>]*data-testid="%s-pathway-%s"[^>]*>' % (tid, k), h) or \
            re.search(r'<a[^>]*href="[^"]*"[^>]*data-testid="%s-pathway-%s"' % (tid, k), h)
        href = re.search(r'href="([^"]+)"', m.group(0)).group(1) if m else None
        print(f'  {page} {k} -> {href}')
        check(href and re.fullmatch(r'/programmes/[a-z0-9-]+', href) and href.split('/')[-1] in slugs, f'{tid}-pathway-{k} href {href}')
print('pathways:', {k: v for k, v in pathway.items() if k != '_rel'})
print(f'==== {PASS} passed, {FAIL} failed ====')
sys.exit(1 if FAIL else 0)
