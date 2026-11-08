"""Read-only route health check for the LOCAL web preview (http://localhost:3000).

Fetches sitemap.xml + every header/footer link on the homepage and records the
HTTP status of each URL (no redirects followed). GET only — never writes.
Usage: python /app/scripts/launch_route_check.py [out.json]
"""
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

BASE = "http://localhost:3000"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/launch_route_check.json"


def status(path: str):
    try:
        r = requests.get(BASE + path, allow_redirects=False, timeout=120)
        return path, r.status_code, r.headers.get("location", "")
    except Exception as e:  # network/timeout
        return path, 0, str(e)[:80]


sm = requests.get(f"{BASE}/sitemap.xml", timeout=120).text
paths = sorted({re.sub(r"^https?://[^/]+", "", u) or "/" for u in re.findall(r"<loc>([^<]+)</loc>", sm)})
home = requests.get(BASE + "/", timeout=120).text
chrome = sorted({h for h in re.findall(r'href="(/[^"#?]*)', home) if not h.startswith(("/_next", "/bff", "/brand"))})
todo = sorted(set(paths) | set(chrome))
with ThreadPoolExecutor(max_workers=6) as ex:
    rows = list(ex.map(status, todo))
bad = [r for r in rows if r[1] >= 400 or r[1] == 0]
redirects = [r for r in rows if 300 <= r[1] < 400]
json.dump({"sitemap": len(paths), "chrome_links": len(chrome), "checked": len(rows), "bad": bad, "redirects": redirects},
          open(OUT, "w"), indent=1)
print(f"sitemap={len(paths)} chrome={len(chrome)} checked={len(rows)} bad={len(bad)} redirects={len(redirects)}")
for b in bad[:40]:
    print("BAD", b)
