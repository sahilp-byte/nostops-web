# iter185: SSR checks for distinct benefit lines (aim-lines) + "similar upcoming events" row on event pages, and /events directory.
import re
import sys
import requests
from bs4 import BeautifulSoup

BASE = sys.argv[1].rstrip('/')
S = requests.Session()
PASS = FAIL = 0
FAILS = []


def check(name, cond, info=''):
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        FAILS.append(f'{name} :: {info}')
        print(f'FAIL {name} :: {info}')


# Parse aim-lines.ts
AIM = dict(re.findall(r"^\s*'([^']+)':\s*'([^']+)',", open('/app/frontend/lib/events/aim-lines.ts').read(), re.M))
check('aim-lines parsed', len(AIM) == 30, len(AIM))
BAD = re.compile(r'\b(cure|cures|heal|heals|treat|treats|therapy|therapeutic|guarantee|guaranteed|diagnos|clinical|medical|disease|insomnia|anxiety disorder|depression|pain relief|will improve|proven)\b', re.I)
for k, v in AIM.items():
    check(f'aim-line non-clinical: {k}', not BAD.search(v), v)
check('aim-lines all distinct', len(set(AIM.values())) == len(AIM))

MONTHS = {m: i for i, m in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 1)}


def card_date(li):
    p = li.find('p')
    m = re.search(r'(\d{1,2}) (\w{3}) (\d{4})', p.get_text() if p else '')
    return f'{m.group(3)}-{MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}' if m else ''


def cards(section):
    out = []
    for li in section.select('li[data-testid^="event-card-"]'):
        out.append({'slug': li['data-testid'][len('event-card-'):], 'date': card_date(li), 'status': li.find_all('p')[-1].get_text(strip=True)})
    return out


r = S.get(f'{BASE}/events', timeout=60)
check('/events 200', r.status_code == 200, r.status_code)
soup = BeautifulSoup(r.text, 'html.parser')
up_sec = soup.select_one('[data-testid="events-upcoming"]')
past_sec = soup.select_one('[data-testid="events-past"]')
upcoming = cards(up_sec) if up_sec else []
past = cards(past_sec) if past_sec else []
print('UPCOMING:', [(c['slug'], c['date']) for c in upcoming])
print('PAST:', [(c['slug'], c['date'], c['status']) for c in past])
check('/events upcoming >=1', len(upcoming) >= 1)
check('/events upcoming sorted by date', [c['date'] for c in upcoming] == sorted(c['date'] for c in upcoming))
check('/events past has Ended', all(c['status'] == 'Ended' for c in past) and len(past) >= 1, past)
check('/events demo note', bool(soup.select_one('[data-testid="events-demo-note"]')))
check('/events no -qa- slugs', not any('-qa-' in c['slug'] for c in upcoming + past))
check('/events single h1', len(soup.find_all('h1')) == 1)

date_of = {c['slug']: c['date'] for c in upcoming + past}
up_slugs = {c['slug'] for c in upcoming}
all_slugs = [c['slug'] for c in upcoming + past]
pages = {}
for slug in all_slugs:
    rr = S.get(f'{BASE}/events/{slug}', timeout=60)
    check(f'{slug} 200', rr.status_code == 200, rr.status_code)
    pages[slug] = BeautifulSoup(rr.text, 'html.parser')
cohort = {}
for slug, sp in pages.items():
    el = sp.select_one('[data-guru-cohort]')
    cohort[slug] = el['data-guru-cohort'] if el else None
print('COHORTS:', cohort)

KIND = {'COMPANY': 'companies', 'EDUCATIONAL_INSTITUTION': 'campuses', 'STARTUP_NETWORK': 'founder and startup groups'}
FC = 'yoga-for-stress-resilience-founders-circle-mumbai'
FC_TEXTS = [('Pause & breathe', 'Guided practices to help participants slow down'), ('Move with care', 'Gentle yoga practices to support movement'), ('Reconnect as a community', 'Share a practice with fellow founders')]

for slug, sp in pages.items():
    # --- benefits
    bens = [sp.select_one(f'[data-testid="event-benefit-{i}"]') for i in (1, 2, 3)]
    check(f'{slug} 3 benefit cards', all(bens), [bool(b) for b in bens])
    if all(bens):
        if slug == FC:
            for b, (t, txt) in zip(bens, FC_TEXTS):
                tx = b.get_text(' ', strip=True)
                check(f'{slug} FC benefit {t}', t in tx and txt in tx, tx)
        else:
            bodies = []
            for b in bens:
                title = b.find(['h3', 'h4', 'h2'])
                title_t = title.get_text(strip=True) if title else ''
                ps = [p.get_text(' ', strip=True) for p in b.find_all('p')]
                body = next((p for p in ps if p in AIM.values()), None)
                check(f'{slug} benefit "{title_t}" body matches AIM_LINES[title]', AIM.get(title_t) is not None and body == AIM.get(title_t), f'title={title_t} ps={ps}')
                check(f'{slug} benefit "{title_t}" Programme aim label', 'Programme aim' in b.get_text(' ', strip=True))
                bodies.append(body)
            check(f'{slug} benefit bodies distinct', len(set(bodies)) == 3 and None not in bodies, bodies)
    # --- similar row
    sim = sp.select_one('[data-testid="event-similar"]')
    others_up = sorted([s for s in up_slugs if s != slug], key=lambda s: date_of[s])
    same = [s for s in others_up if cohort.get(s) == cohort.get(slug)]
    other = [s for s in others_up if cohort.get(s) != cohort.get(slug)]
    expected = (same + other)[:3]
    if not expected:
        check(f'{slug} similar hidden when none', sim is None)
        continue
    check(f'{slug} similar row present', sim is not None)
    if not sim:
        continue
    got = [li['data-testid'][len('event-card-'):] for li in sim.select('li[data-testid^="event-card-"]')]
    print(f'{slug} [{cohort.get(slug)}] similar ->', [(g, cohort.get(g)) for g in got])
    check(f'{slug} similar 2-3 cards', 2 <= len(got) <= 3 or len(got) == len(expected), len(got))
    check(f'{slug} similar excludes self', slug not in got)
    check(f'{slug} similar no past', all(g in up_slugs for g in got), got)
    check(f'{slug} similar order expected', got == expected, f'got={got} expected={expected}')
    h2 = sim.find('h2').get_text(strip=True)
    matches = sum(1 for g in got if cohort.get(g) == cohort.get(slug))
    check(f'{slug} similar heading', h2 == ('Similar upcoming events' if matches else 'Other upcoming events'), h2)
    note = sim.select_one('[data-testid="event-similar-note"]')
    kind = KIND.get(cohort.get(slug))
    if matches == 0:
        check(f'{slug} no note when no matches', note is None)
    else:
        exp_note = f'More upcoming events from {kind}.' if matches == len(got) else f'Events from {kind} first, then other upcoming NOSTOPS events.'
        check(f'{slug} similar note', note is not None and note.get_text(strip=True) == exp_note, note.get_text(strip=True) if note else None)
    a = sim.select_one('[data-testid="event-similar-all"]')
    check(f'{slug} see-all link /events', a is not None and a.get('href') == '/events')
    # position: after share/about section, before EventsCta band
    html = str(sp)
    i_sim = html.find('data-testid="event-similar"')
    i_cta = html.find('data-testid="events-cta"')
    i_share = max(html.find('data-testid="event-organisation"'), html.find('data-testid="suitability-note"'))
    check(f'{slug} similar before CTA', i_cta == -1 or i_sim < i_cta, (i_sim, i_cta))
    check(f'{slug} similar after share/about', i_share == -1 or i_share < i_sim, (i_share, i_sim))

print(f'\nRESULT: {PASS}/{PASS + FAIL} pass')
for f in FAILS:
    print(' -', f)
