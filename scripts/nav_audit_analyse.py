"""Analyse /tmp/nav_audit/crawl.json -> prints audit findings."""
import json
from collections import defaultdict, Counter

d = json.load(open('/tmp/nav_audit/crawl.json'))
pages = d['pages']
links = d['links']
sm = pages.pop('__sitemap__', {})
SITE = 'https://www.nostops.org'


def status_of(p):
    r = pages.get(p)
    return r['status'] if r else 'UNCRAWLED'


print('SITEMAP', sm.get('count'), 'locs')
print('PAGES', len(pages))
print('STATUS', Counter(str(r['status']) for r in pages.values()))

# 1. broken targets
print('\n== BROKEN TARGETS (non-200 final) ==')
bad = {p: r for p, r in pages.items() if r['status'] != 200}
for p, r in sorted(bad.items()):
    srcs = sorted({(l['src'], l['region']) for l in links if l['href'] == p})
    print(f"{r['status']} {p} chain={[c['status'] for c in r['chain']]} final={r['final']} from={srcs[:4]} (+{max(0,len(srcs)-4)})")

# 2. links that go through redirects
print('\n== LINKS POINTING AT REDIRECTS ==')
red = {p: r for p, r in pages.items() if r['chain']}
for p, r in sorted(red.items()):
    srcs = sorted({l['region'] for l in links if l['href'] == p})
    n = len({l['src'] for l in links if l['href'] == p})
    print(f"{p} -> {' -> '.join(str(c['status'])+':'+str(c['to']) for c in r['chain'])} final={r['status']} | linked from {n} pages regions={srcs}")

# 3. canonical mismatches on 200 html
print('\n== CANONICAL MISMATCH ==')
for p, r in sorted(pages.items()):
    if r['status'] != 200 or r.get('ctype') != 'text/html':
        continue
    can = r.get('canonical')
    path = p.split('?')[0]
    if can is None:
        print('NO-CANONICAL', p, r.get('robots'))
        continue
    exp = SITE + (path if path != '/' else '')
    if can.rstrip('/') != exp.rstrip('/'):
        print('MISMATCH', p, '->', can, '| robots', r.get('robots'))

# 4. sitemap entries non 200 / redirect / noindex
print('\n== SITEMAP ISSUES ==')
for l in sm.get('locs', []):
    r = pages.get(l)
    if not r:
        print('UNCRAWLED', l); continue
    if r['status'] != 200 or r['chain'] or (r.get('robots') or '').startswith('noindex'):
        print(r['status'], l, r['chain'], r.get('robots'))

# 5. header/footer link sets per template
print('\n== HEADER/FOOTER CONSISTENCY ==')
hdr = defaultdict(list); ftr = defaultdict(list)
for l in links:
    if l['region'] == 'header':
        hdr[l['src']].append((l['href'], l['text']))
    elif l['region'] == 'footer':
        ftr[l['src']].append((l['href'], l['text']))
hsig = Counter(tuple(v) for v in hdr.values())
fsig = Counter(tuple(sorted(set(v))) for v in ftr.values())
print('header variants:', len(hsig))
for sig, n in hsig.most_common():
    print(' ', n, 'pages:', sig)
print('footer variants:', len(fsig))
base = fsig.most_common(1)[0][0] if fsig else ()
for sig, n in fsig.most_common():
    diff_add = set(sig) - set(base); diff_rm = set(base) - set(sig)
    print(' ', n, 'pages; +', sorted(diff_add)[:6], '-', sorted(diff_rm)[:6])
print('FOOTER base:', base)
no_chrome = [p for p, r in pages.items() if r['status'] == 200 and r.get('ctype') == 'text/html' and not (r.get('has_header') and r.get('has_footer'))]
print('pages without header/footer:', no_chrome[:40])

# 6. inconsistent labels for same destination
print('\n== LABELS PER DESTINATION (top internal targets) ==')
lab = defaultdict(Counter)
for l in links:
    lab[l['href']][l['text']] += 1
for href in ['/', '/teachers', '/retreats', '/retreats/host', '/venues', '/list-your-venue', '/for-organisations', '/for-companies', '/for-organisations/companies', '/city-coordinator', '/become-a-teacher', '/signup', '/register', '/join', '/login', '/about', '/contact', '/yoga-teachers', '/venues/submit', '/programmes', '/trust', '/how-it-works', '/philosophy']:
    if href in lab:
        print(href, dict(lab[href].most_common(8)))

# 7. orphan routes: crawled 200 pages linked only from sitemap
print('\n== /app links on public pages (auth-gated) ==')
app_links = Counter(l['href'].split('?')[0] for l in links if l['href'].startswith('/app') and not l['src'].startswith('/app'))
print(app_links.most_common(30))

# 8. duplicate pages: legacy for-* titles
print('\n== TITLE/H1 DUPLICATES ==')
t = defaultdict(list)
for p, r in pages.items():
    if r['status'] == 200 and r.get('title'):
        t[r['title']].append(p)
for k, v in t.items():
    if len(v) > 1:
        print(k, v[:6])
