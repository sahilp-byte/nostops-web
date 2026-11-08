"""Navigation / route audit crawler (read-only).

Crawls every discoverable internal route of the local Next.js server starting
from '/', the sitemap and the shared header/footer, without following
redirects automatically (so redirect chains are recorded). Writes
/tmp/nav_audit/crawl.json for analysis.
"""
import asyncio
import json
import re
import sys
from urllib.parse import urljoin, urlparse, urldefrag

import httpx
from bs4 import BeautifulSoup

BASE = 'http://localhost:3000'
SITE_HOSTS = {'www.nostops.org', 'nostops.org', 'localhost:3000'}
MAX_PAGES = int(sys.argv[1]) if len(sys.argv) > 1 else 1200
CONCURRENCY = 4
SKIP_PREFIXES = ('/_next', '/bff', '/brand', '/api/')
OUT = '/tmp/nav_audit/crawl.json'

pages: dict = {}
links: list = []
queue: asyncio.Queue = asyncio.Queue()
seen: set = set()


def norm(href: str, src: str):
    if not href:
        return None
    href = href.strip()
    if href.startswith(('mailto:', 'tel:', 'javascript:', 'whatsapp:', 'sms:')):
        return None
    if href.startswith('#'):
        return None
    absu = urljoin(BASE + src, href)
    absu, _ = urldefrag(absu)
    u = urlparse(absu)
    if u.netloc not in SITE_HOSTS:
        return None
    path = u.path or '/'
    if u.query:
        path += '?' + u.query
    return path


def region_of(a):
    for p in a.parents:
        if p.name == 'header':
            return 'header'
        if p.name == 'footer':
            return 'footer'
        if p.name == 'nav' and (p.get('aria-label') or '').lower() == 'breadcrumb':
            return 'breadcrumb'
    return 'main'


def enqueue(path: str):
    if path in seen or len(seen) >= MAX_PAGES:
        return
    if path.startswith(SKIP_PREFIXES):
        return
    seen.add(path)
    queue.put_nowait(path)


async def fetch(client: httpx.AsyncClient, path: str):
    rec = {'status': None, 'chain': [], 'final': path}
    cur = path
    for _ in range(6):
        try:
            r = await client.get(BASE + cur, follow_redirects=False, timeout=90)
        except Exception as e:  # noqa: BLE001
            rec['status'] = f'ERR {type(e).__name__}'
            return rec, None
        if r.status_code in (301, 302, 303, 307, 308):
            loc = r.headers.get('location', '')
            nxt = norm(loc, cur) or loc
            rec['chain'].append({'from': cur, 'status': r.status_code, 'to': nxt})
            if not nxt or not nxt.startswith('/'):
                rec['status'] = r.status_code
                rec['final'] = nxt
                return rec, None
            cur = nxt
            continue
        rec['status'] = r.status_code
        rec['final'] = cur
        ctype = r.headers.get('content-type', '')
        rec['ctype'] = ctype.split(';')[0]
        rec['x_robots'] = r.headers.get('x-robots-tag')
        return rec, (r.text if 'html' in ctype else None)
    rec['status'] = 'REDIRECT_LOOP'
    return rec, None


async def worker(client):
    while True:
        path = await queue.get()
        try:
            rec, html = await fetch(client, path)
            if html:
                soup = BeautifulSoup(html, 'html.parser')
                can = soup.find('link', rel='canonical')
                rec['canonical'] = can.get('href') if can else None
                rob = soup.find('meta', attrs={'name': 'robots'})
                rec['robots'] = rob.get('content') if rob else None
                rec['title'] = soup.title.get_text(strip=True) if soup.title else None
                h1 = soup.find('h1')
                rec['h1'] = h1.get_text(' ', strip=True)[:120] if h1 else None
                rec['has_header'] = soup.find('header') is not None
                rec['has_footer'] = soup.find('footer') is not None
                for a in soup.find_all('a', href=True):
                    tgt = norm(a['href'], rec['final'])
                    if not tgt:
                        continue
                    links.append({
                        'src': path,
                        'href': tgt,
                        'raw': a['href'],
                        'text': a.get_text(' ', strip=True)[:80] or (a.get('aria-label') or '')[:80],
                        'region': region_of(a),
                    })
                    enqueue(tgt)
            pages[path] = rec
            if len(pages) % 25 == 0:
                print(f'{len(pages)} fetched, {queue.qsize()} queued', flush=True)
        finally:
            queue.task_done()


async def main():
    async with httpx.AsyncClient(headers={'User-Agent': 'NOSTOPS-nav-audit/1.0'}) as client:
        try:
            sm = await client.get(BASE + '/sitemap.xml', timeout=120)
            locs = re.findall(r'<loc>([^<]+)</loc>', sm.text)
            pages['__sitemap__'] = {'count': len(locs), 'locs': [norm(l, '/') for l in locs]}
        except Exception as e:  # noqa: BLE001
            locs = []
            pages['__sitemap__'] = {'error': str(e)}
        enqueue('/')
        for l in locs:
            p = norm(l, '/')
            if p:
                enqueue(p)
        tasks = [asyncio.create_task(worker(client)) for _ in range(CONCURRENCY)]
        await queue.join()
        for t in tasks:
            t.cancel()
    import os
    os.makedirs('/tmp/nav_audit', exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump({'pages': pages, 'links': links}, f)
    print('DONE', len(pages), 'pages', len(links), 'links')


if __name__ == '__main__':
    asyncio.run(main())
