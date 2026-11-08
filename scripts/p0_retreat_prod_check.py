"""P2 retreat city / detail pages — HTTP check against PRODUCTION builds (not the dev server).

Ports (started by the operator from a `next build` copy of the website):
  3100 → live main backend (read-only GETs)      — real data: no public retreats exist
  3101 → local mock backend (p0_mock_retreat_backend.py) — one valid + one failing retreat
  3102 → unreachable backend                     — a genuine backend outage
Prints one line per case and writes /app/test_reports/p0/retreat_pages_prod_check.json.
"""
import json
import sys

import requests

CASES = [
    # (port, path, expected status set, must-contain text or None, label)
    (3100, "/retreats/in/rishikesh", {404}, None, "live: city with no retreats → 404 (was 500)"),
    (3100, "/retreats/in/karjat", {404}, None, "live: second city from the error log → 404 (was 500)"),
    (3100, "/retreats/in/rishikesh/yoga-retreat-rishikesh-rt_1cf46fdf0f", {404}, None, "live: hidden QA retreat → 404 (was 500)"),
    (3100, "/retreats/in/india/x-rt_doesnotexist", {404}, None, "live: missing retreat → 404 (was 500)"),
    (3100, "/retreats", {200}, None, "live: retreat listing still 200"),
    (3101, "/retreats/in/rishikesh", {200}, "Himalayan Silence Retreat", "mock: valid city page renders"),
    (3101, "/retreats/in/rishikesh/himalayan-silence-retreat-rishikesh-mar-2027-rt_qap0valid01", {200},
     "Himalayan Silence Retreat", "mock: valid detail page renders"),
    (3101, "/retreats/in/rishikesh/himalayan-silence-retreat-rishikesh-mar-2027-rt_qap0valid01?cohort=qa&via=wa", {200},
     "Himalayan Silence Retreat", "mock: valid detail page with invite query renders"),
    (3101, "/retreats/in/goa/old-title-rt_qap0valid01", {308, 301}, None, "mock: stale slug → permanent redirect"),
    (3101, "/retreats/in/rishikesh/x-rt_qap0nothere", {404}, None, "mock: missing retreat → 404"),
    (3101, "/retreats/in/atlantis", {404}, None, "mock: city with no retreats → 404"),
    (3101, "/retreats/in/rishikesh/x-rt_qap0fail500", {500}, None, "mock: backend 500 for the retreat → error page"),
    (3101, "/retreats/in/x/%25E0%25A4%25A", {404, 400}, None, "malformed: bad escape in slug"),
    (3101, "/retreats/in/x/..%2F..%2Fadmin%2Fusers", {404, 400}, None, "malformed: path traversal in slug"),
    (3101, "/retreats/in/x/" + "a" * 3000, {404, 400, 414}, None, "malformed: 3,000-char slug"),
    (3101, "/retreats/in/x/%3Cscript%3Ert_1%3C%2Fscript%3E", {404, 400}, None, "malformed: markup in slug"),
    (3101, "/retreats/in/RISHI%20KESH", {404, 400}, None, "malformed: city with space / capitals"),
    (3101, "/retreats/in/rishikesh/rt_", {404}, None, "malformed: empty id"),
    (3102, "/retreats/in/rishikesh", {500}, None, "outage: city page → error page, not 404"),
    (3102, "/retreats/in/rishikesh/x-rt_qap0valid01", {500}, None, "outage: detail page → error page, not 404"),
]
# A 500 renders the site's error screen in the browser; the HTML must never carry the
# server-side reason or the backend address.
LEAKS = ("retreat backend unavailable", "retreat list unavailable", "127.0.0.1:9", "pro-learn-connect")


def main():
    rows, fails = [], 0
    for port, path, want, text, label in CASES:
        try:
            r = requests.get(f"http://127.0.0.1:{port}{path}", timeout=60, allow_redirects=False)
            code, body = r.status_code, r.text
        except requests.RequestException as e:
            code, body = 0, str(e)
        ok = code in want and (text is None or text in body) and not (code >= 500 and any(x in body for x in LEAKS))
        fails += 0 if ok else 1
        rows.append({"label": label, "port": port, "path": path[:120], "status": code, "pass": ok})
        print(f"{'PASS' if ok else 'FAIL'} {code} {label}")
    json.dump(rows, open("/app/test_reports/p0/retreat_pages_prod_check.json", "w"), indent=1)
    print(f"{len(rows) - fails}/{len(rows)} passed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
