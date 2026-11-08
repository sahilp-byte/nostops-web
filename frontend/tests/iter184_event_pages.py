# Iteration 184: SSR checks for event landing pages, /events directory, regressions.
import re, json, sys, requests

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://localhost:3000'
ok = fail = 0
def check(name, cond, extra=''):
    global ok, fail
    if cond: ok += 1; print(f'PASS {name}')
    else: fail += 1; print(f'FAIL {name} {extra}')

def get(p):
    return requests.get(BASE + p, timeout=60, allow_redirects=False)

def tid(html, t):
    return f'data-testid="{t}"' in html

def text_of(html):
    h = re.sub(r'<script.*?</script>', ' ', html, flags=re.S)
    h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'\s+', ' ', h).replace('&amp;', '&').replace('&#x27;', "'").replace('&quot;', '"')

# 1-6 Founders Circle
FC = '/events/yoga-for-stress-resilience-founders-circle-mumbai'
r = get(FC); h = r.text; t = text_of(h)
check('FC 200', r.status_code == 200, r.status_code)
check('FC single h1', h.count('<h1') == 1, h.count('<h1'))
for x in ['event-hero', 'event-photo-note', 'event-eyebrow', 'event-heading', 'event-tags', 'illustrative-banner',
          'event-details-card', 'event-status-past', 'event-date', 'event-time', 'event-location', 'event-organiser',
          'badge-demo', 'event-past', 'event-explore-upcoming', 'event-value', 'event-benefit-1', 'event-benefit-2',
          'event-benefit-3', 'event-lower', 'event-about-session', 'event-teacher', 'teacher-confirmed-note',
          'event-what-to-expect', 'event-audience', 'event-organisation', 'suitability-note', 'events-cta',
          'events-cta-all', 'events-cta-host']:
    check(f'FC testid {x}', tid(h, x))
for x in ['register-cta', 'register-closed', 'badge-teacher-verified', 'event-fee']:
    check(f'FC no {x}', not tid(h, x))
check('FC no /register link', f'href="{FC}/register' not in h)
check('FC no ₹', '₹' not in t)
check('FC no Verified teacher', '✓ Verified NOSTOPS teacher' not in t)
for s in ['FOUNDERS CIRCLE' if 'FOUNDERS CIRCLE' in t else 'Founders Circle', 'NOSTOPS Demonstration', 'Yoga for Stress Resilience',
          'A shared pause for the people building what comes next.', 'Mind', 'Stress Relief', 'Focus', 'Community',
          'Council-Curated', 'In development', 'Past event', 'Sun, 11 Oct 2026', '7:30 – 8:30 AM (IST) · 60 min', 'Mumbai',
          'The Commons — Bandra Kurla Complex', 'Founders Circle Mumbai', 'Demonstration organisation',
          'Open to Founders Circle Mumbai members only', 'This event has already taken place.',
          'You don’t have to build through stress alone.', 'Pause & breathe', 'Move with care', 'Reconnect as a community',
          'About the Teacher-Led Session', 'Rohan Kulkarni · Teacher confirmed',
          'NOSTOPS verification not yet complete · Demonstration event', 'About our Teachers', 'What to Expect',
          'Ease everyday stress', 'Build resilience', 'Support calm and balance', '60-minute session', 'Up to 30 participants',
          'All levels', 'English, Hindi, Marathi', 'Who Is This For?', 'About the Organisation',
          'Explore more NOSTOPS programmes', 'More events, more opportunities', 'View All Events', 'Host an Event']:
    check(f'FC text "{s}"', s in t)
check('FC breadcrumb aria-current', re.search(r'aria-current="page"[^>]*>Yoga for Stress Resilience', h) is not None)
check('FC hero img', 'founders-hero.jpg' in h)
check('FC robots noindex', re.search(r'<meta name="robots" content="noindex, ?nofollow"', h) is not None)
check('FC title', '<title>Yoga for Stress Resilience — Founders Circle Mumbai · NOSTOPS</title>' in h,
      re.search(r'<title>(.*?)</title>', h).group(1) if re.search(r'<title>(.*?)</title>', h) else '')
check('FC og:image', 'property="og:image"' in h)
check('FC no Event JSON-LD', re.search(r'"@type":"(Education)?Event"', h) is None)
# what-to-expect section no clock times
m = re.search(r'data-testid="event-what-to-expect"(.*?)data-testid="event-audience"', h, re.S)
check('FC what-to-expect no times', m and not re.search(r'\d{1,2}:\d{2}', text_of(m.group(1))))
check('/teachers 200', get('/teachers').status_code == 200)
check('/programmes 200', get('/programmes').status_code == 200)
check('/programmes/compare 200', get('/programmes/compare').status_code == 200)
rh = get('/app/org/events/new')
print('  host redirect:', rh.status_code, rh.headers.get('location'))

# 7 Other events
OTHERS = ['yoga-for-energy-stamina-scaleup-founders-network', 'yoga-for-focus-attention-arclight-technologies',
          'yoga-for-strength-mobility-meridian-biosystems', 'yoga-for-focus-attention-wias-campus',
          'yoga-for-posture-back-care-vitm-campus', 'yoga-for-focus-attention-acme-mumbai-nov-18-2026',
          ]
# p5 event belongs to 'QA P5 Seed Org' -> hidden by the QA rule (expected 404)
check('p5 QA-org event hidden (404)', get('/events/yoga-for-focus-p5-trust-signals-nov-24-2026').status_code == 404)
for s in OTHERS:
    r = get(f'/events/{s}'); h = r.text; t = text_of(h)
    eb = re.search(r'data-testid="event-eyebrow"[^>]*>(.*?)<', h)
    h1 = re.search(r'data-testid="event-heading"[^>]*>(.*?)</h1>', h, re.S)
    d = re.search(r'data-testid="event-date"(.*?)</div></div>', h, re.S)
    JE = '"@type":"Event"'; rb = re.search(r'<meta name="robots" content="([^"]+)"', h)
    reg = re.search(r'data-testid="register-cta"[^>]*>(.*?)<', h)
    href = re.search(r'href="([^"]+)"[^>]*data-testid="register-cta"', h) or re.search(r'data-testid="register-cta"[^>]*href="([^"]+)"', h)
    closed = re.search(r'data-testid="register-closed"[^>]*>(.*?)<', h)
    print(f'--- {s}: {r.status_code} eyebrow={eb and eb.group(1)!r} h1={h1 and text_of(h1.group(1))!r}')
    lm = re.search(r'data-testid="event-location"(.*?)</div></div>', h, re.S)
    print(f'    date={d and text_of(d.group(1))[:120]!r} loc={lm and text_of(lm.group(1))[:90]!r}')
    print(f'    reg={reg and reg.group(1)!r} href={href and href.group(1)!r} closed={closed and closed.group(1)!r} sessions={tid(h,"event-sessions")} '
          f'jsonld_event={JE in h} bc={"BreadcrumbList" in h} robots={rb and rb.group(1)}')
    check(f'{s} 200', r.status_code == 200)
    check(f'{s} single h1', h.count('<h1') == 1)
    check(f'{s} not past', not tid(h, 'event-status-past') and not tid(h, 'event-past'))
    check(f'{s} Programme aim', 'Programme aim' in t)
    check(f'{s} reg block', bool(reg) or bool(closed))
    check(f'{s} cta', tid(h, 'events-cta-all') and tid(h, 'events-cta-host'))
    if 'acme' in s or 'p5' in s:
        bcj = re.search(r'"BreadcrumbList".*?</script>', h, re.S)
        check(f'{s} Event JSON-LD', re.search(r'"@type":"(Education)?Event"', h) is not None)
        check(f'{s} Breadcrumb pos2 Events', bcj and re.search(r'"position":2,"name":"Events","item":"https://www.nostops.org/events"', bcj.group(0)) is not None,
              bcj.group(0)[:400] if bcj else '')

# 8 directory
r = get('/events'); h = r.text; t = text_of(h)
check('/events 200', r.status_code == 200)
check('/events h1', re.search(r'<h1[^>]*>Yoga Events</h1>', h) is not None)
check('/events single h1', h.count('<h1') == 1)
for x in ['events-demo-note', 'events-upcoming', 'events-past', 'events-cta', 'events-cta-host']:
    check(f'/events {x}', tid(h, x))
check('/events no cta-all', not tid(h, 'events-cta-all'))
check('/events no -qa-', '-qa-' not in h)
check('/events canonical', 'rel="canonical" href="https://www.nostops.org/events"' in h)
check('/events robots index', re.search(r'<meta name="robots" content="index, ?follow', h) is not None)
up = re.search(r'data-testid="events-upcoming"(.*?)data-testid="events-past"', h, re.S).group(1)
cards = re.findall(r'data-testid="event-card-([^"]+)"', up)
print('upcoming cards:', cards)
pastcards = re.findall(r'data-testid="event-card-([^"]+)"', h.split('data-testid="events-past"')[1])
print('past cards:', pastcards)
check('/events FC in past', 'yoga-for-stress-resilience-founders-circle-mumbai' in pastcards)
dates = re.findall(r'(\w{3}, \d{1,2} \w{3} 20\d\d)', text_of(up))
print('upcoming dates:', dates)
from datetime import datetime
ds = [datetime.strptime(x, '%a, %d %b %Y') for x in dates]
check('/events sorted', ds == sorted(ds))
for s in OTHERS:
    check(f'/events has {s}', s in cards)

# 9 regressions
for p in ['/for-organisations/companies', '/for-organisations/educational-institutions', '/for-organisations/startup-networking-groups', '/venues']:
    check(f'{p} 200', get(p).status_code == 200)
for s in OTHERS[:3] + OTHERS[5:]:
    rr = get(f'/events/{s}/register')
    print(f'  register {s}: {rr.status_code} {rr.headers.get("location","")}')

print(f'\nTOTAL pass={ok} fail={fail}')
