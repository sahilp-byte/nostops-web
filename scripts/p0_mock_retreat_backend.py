"""P2 retreat-page check — a tiny LOCAL stand-in for the main backend (test only).

The live backend has no public retreat, so a valid page can't be rendered against it. This
mock serves one made-up public retreat (rt_qap0valid01) and one that fails (rt_qap0fail500);
every other GET is passed through to the live backend read-only. Non-GET calls are refused
here (never forwarded). Run: python3 p0_mock_retreat_backend.py 9911
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError

LIVE = "https://pro-learn-connect-1.emergent.host"
RETREAT = {
    "retreat_id": "rt_qap0valid01", "title": "Himalayan Silence Retreat", "status": "published",
    "description": "A made-up retreat used only to check the page renders.", "theme": "silence",
    "venue_name": "Mock Ashram", "venue_city": "Rishikesh", "state": "Uttarakhand", "country": "India",
    "start_date": "2027-03-10", "end_date": "2027-03-14", "price_per_seat_inr": 24000,
    "seats_total": 20, "seats_remaining": 12, "seats_filled": 8, "tier": "public", "inclusions": ["Meals"],
}


class H(BaseHTTPRequestHandler):
    def _json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        p = self.path.split("?")[0]
        if p == "/api/retreats":
            return self._json(200, {"retreats": [RETREAT]})
        if p == "/api/retreats/rt_qap0valid01":
            return self._json(200, RETREAT)
        if p.startswith("/api/retreats/rt_qap0valid01/"):
            return self._json(200, {"confirmed_count": 8, "seats_total": 20})
        if p.startswith("/api/retreats/rt_qap0fail500"):
            return self._json(500, {"detail": "mock failure"})
        if p.startswith("/api/retreats/rt_"):
            return self._json(404, {"detail": "Retreat not found"})
        if p.startswith("/api/seo/retreat/"):
            ok = p.endswith("rt_qap0valid01")
            return self._json(200 if ok else 404, {"meta": {}, "jsonld": []} if ok else {"detail": "not found"})
        try:
            with urlopen(Request(LIVE + self.path, headers={"Accept": "application/json"}), timeout=20) as r:
                return self._json(r.status, json.loads(r.read() or b"{}"))
        except HTTPError as e:
            return self._json(e.code, {"detail": "upstream"})
        except Exception:  # noqa: BLE001
            return self._json(502, {"detail": "upstream unreachable"})

    def _refuse(self):
        self._json(405, {"detail": "mock: writes are never forwarded"})

    do_POST = do_PUT = do_PATCH = do_DELETE = _refuse

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1] if len(sys.argv) > 1 else 9911)), H).serve_forever()
