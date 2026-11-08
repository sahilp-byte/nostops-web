"""
NOSTOPS Web — thin backend on :8001.

This service does NOT contain any business logic. All real logic (teachers,
bookings, payments, wallet, escrow) lives in the live NOSTOPS backend. This tiny
FastAPI app simply:
  1. exposes a local /api/health so the platform health-check passes, and
  2. transparently proxies every other /api/* request to the live backend, so
     browser (client-side) calls can be made same-origin (no CORS headaches).

Server-side rendering in Next.js talks to the live backend directly; this proxy
is only a convenience/health shim.
"""
import os
import re

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

load_dotenv()

import payment_guard as _pg  # noqa: E402
from urllib.parse import urlparse  # noqa: E402

# No built-in fallback host: the main backend comes ONLY from BACKEND_ORIGIN. A preview pod is the
# one with its own local Mongo; anywhere else (production) a missing or Preview target is refused.
TARGET = os.environ.get("BACKEND_ORIGIN", "").strip().rstrip("/")
ON_PREVIEW_POD = (urlparse(os.environ.get("MONGO_URL", "")).hostname or "").lower() in _pg.LOCAL_HOSTS
TARGET_OK = TARGET.startswith("https://") and (ON_PREVIEW_POD or not _pg.is_preview_suffix(urlparse(TARGET).hostname))

app = FastAPI(title="NOSTOPS Web Proxy")

# Teacher Pulse — an ISOLATED native feature backed by the local Mongo. Mounted
# BEFORE the catch-all proxy below so /api/pulse/* is served locally and is NOT
# forwarded to the remote business backend. The remote backend stays untouched.
from pulse import router as pulse_router  # noqa: E402

app.include_router(pulse_router)

# 1:1 Session Audit Ledger — another ISOLATED local feature (local Mongo). The
# remote business backend exposes no 1:1 admin endpoint, so the BFF records each
# booking/payment here for admin visibility. Mounted BEFORE the catch-all proxy
# so /api/audit/* is served locally and never forwarded to the remote backend.
from audit import router as audit_router  # noqa: E402

app.include_router(audit_router)

# Yogic Paramparā Knowledge Graph — another ISOLATED local feature (local Mongo,
# kg_* collections). Mounted BEFORE the catch-all proxy so /api/knowledge/* is
# served locally and never forwarded to the remote business backend, which stays
# untouched. Read endpoints are open (non-PII); writes require the internal secret.
from knowledge import router as knowledge_router  # noqa: E402

app.include_router(knowledge_router)

# AI helpers (bio polish) — ISOLATED local feature. Mounted BEFORE the catch-all
# proxy so /api/ai/* is served locally and never forwarded to the remote backend.
from ai import router as ai_router  # noqa: E402

app.include_router(ai_router)

# NOSTOPS Voices — teacher publishing & syndication (ISOLATED local feature,
# local Mongo voices_* collections). Mounted BEFORE the catch-all proxy so
# /api/voices/* is served locally and never forwarded to the remote backend.
from voices import router as voices_router  # noqa: E402

app.include_router(voices_router)

# Venue Centers — LOCAL FALLBACK store (ISOLATED). Remote POST /retreats/centers
# is 500ing for all owners; this keeps venue creation working. Mounted before
# the catch-all proxy so /api/venues/* is served locally.
from venues import router as venues_router  # noqa: E402

app.include_router(venues_router)

# Phase 1 — Global Venue Owner claims + owner-managed editing (ownership on venue_submissions).
from venue_ownership import router as venue_ownership_router  # noqa: E402

app.include_router(venue_ownership_router)

# Venue AI-Assisted Onboarding — PAID service (ISOLATED local feature, its OWN
# Cashfree account/keys + local Mongo ai_onboarding_* collections). Mounted
# BEFORE the catch-all proxy so /api/ai-onboarding/* is served locally and never
# forwarded to the remote business backend (whose payment flows stay untouched).
from ai_onboarding import router as ai_onboarding_router  # noqa: E402

app.include_router(ai_onboarding_router)

# Venue Partner Growth Engine — free, optional toolkit for venue owners (widgets, invitation,
# QR, attribution). LOCAL feature; public-safe data only (venue_growth.py).
from venue_growth import router as venue_growth_router  # noqa: E402

app.include_router(venue_growth_router)
# Venue Partner overview (admin), printable A4 posters and the monthly activity email.
import venue_growth_partners  # noqa: E402

app.include_router(venue_growth_partners.router)

# One-time "add your profile photo" email for listed teachers without a photo (admin-triggered).
import teacher_photo_reminders  # noqa: E402

app.include_router(teacher_photo_reminders.router)

# Finish-your-profile reminders for teachers who claimed a provisional listing (automatic in production).
import claim_reminders  # noqa: E402

app.include_router(claim_reminders.router)

# City Coordinator applications — LOCAL store. Records a warm on-platform
# confirmation after an eligible teacher submits the external Jotform.
from coordinator import router as coordinator_router  # noqa: E402

app.include_router(coordinator_router)

# Teacher Discovery Engine — ISOLATED local feature (local Mongo discovery_*
# collections). Mounted BEFORE the catch-all proxy so /api/discovery/* is served
# locally and never forwarded to the remote business backend. Google Places
# discovery + classification + campaign control; admin-only via X-Pulse-* .
from discovery import router as discovery_router  # noqa: E402

app.include_router(discovery_router)

# NOSTOPS Verification + Empanelment Engine — ISOLATED local feature (local Mongo
# verification_* collections). Mounted BEFORE the catch-all proxy so
# /api/verification/* is served locally and never forwarded to the frozen remote
# business backend. PROMPT 1 = foundation/data-model only; purely additive and it
# never touches existing InstaKYC / Empanelment / Council / payment records.
from verification import router as verification_router  # noqa: E402

app.include_router(verification_router)

# NOSTOPS Institutional Program Engine — ISOLATED local feature (local Mongo
# inst_* collections). Mounted BEFORE the catch-all proxy so /api/institutional/*
# is served locally and never forwarded to the frozen remote business backend.
# PROMPT 1 = foundation/data-model only; purely additive — it never touches the
# existing teacher / HR / booking / payment / InstaKYC / Empanelment records.
from institutional import router as institutional_router  # noqa: E402

app.include_router(institutional_router)

# Phase 5B — teacher-created Space-linked programmes (inst_events host_kind=SPACE). Local; before the proxy.
from space_programmes import router as space_programmes_router  # noqa: E402

app.include_router(space_programmes_router)

# Phase 6 — participant registration + sandbox-only checkout for Space programmes (space_registrations).
from space_registrations import router as space_registrations_router  # noqa: E402

app.include_router(space_registrations_router)

# NOSTOPS "Ask AI Guru" — ISOLATED local product-support assistant. Mounted
# BEFORE the catch-all proxy so /api/guru/* is served locally. Composes the
# authoritative knowledge + guardrails (backend/guru package) into a system
# prompt and calls the local Emergent LLM pattern. Secured by X-Pulse-Secret;
# the BFF injects the signed-in role/auth context.
from guru.router import router as guru_router  # noqa: E402

app.include_router(guru_router)

# NOSTOPS Organisation Enquiries ("Request a proposal") — ISOLATED local lead
# store (Mongo org_enquiries). Mounted BEFORE the catch-all proxy so
# /api/org-enquiries/* is served locally. Shared-secret only; admin routes also
# require an admin X-Pulse-User identity set server-side by the BFF.
from org_enquiries import router as org_enquiries_router  # noqa: E402

app.include_router(org_enquiries_router)

# NOSTOPS Error Monitor — built-in error monitoring + email alerts (local Mongo
# monitor_*). Mounted before the catch-all proxy. The middleware below records
# every 5xx this service produces (payment paths as "payment") and any
# unhandled exception, without changing the response the client receives.
import monitoring  # noqa: E402

app.include_router(monitoring.router)

# NOSTOPS Daily Digest — 08:00 IST team email (enquiries + errors), triggered by
# the Emergent webhook-cron (/app/.emergent/crons.yml). Mounted before the proxy.
from digest import router as digest_router  # noqa: E402

app.include_router(digest_router)

# B4.8 — Council/admin trust review queue + free-empanelment policy config.
from trust_review import router as trust_review_router  # noqa: E402

app.include_router(trust_review_router)
from empanelment_policy import router as empanelment_policy_router  # noqa: E402  (Policy V2, founder-approved)
app.include_router(empanelment_policy_router)
# Payments Prompt 2A — the ONE provider-routing policy (Cashfree = India/INR, PayPal = international/USD).
from payment_routing import router as payment_routing_router  # noqa: E402
app.include_router(payment_routing_router)
# Prompt 3 — the canonical pricing engine's quote-only API (no orders, no writes; checkout stays off).
from pricing_api import router as pricing_router  # noqa: E402
app.include_router(pricing_router)
# Payments Prompt 2F — signed test runs (preview only): their emails go to a test outbox and their
# errors to a separate test log. Production ignores the tag (see test_tag.py).
import test_tag  # noqa: E402

app.include_router(test_tag.router)
# Intro-video library — Cloudflare R2 storage + local Mongo metadata (BFF-only, X-Pulse-Secret).
import intro_videos  # noqa: E402

app.include_router(intro_videos.router)
# Homepage featured teachers + website removals (admin "Delete" for teachers / venues).
import site_curation  # noqa: E402

app.include_router(site_curation.router)
# Guru Nominations (Phase 1) — signed-in nominations, admin pipeline, Council publication gate.
import guru_nominations  # noqa: E402

app.include_router(guru_nominations.router)
# Festive Complimentary InstaKYC campaign engine (NOSTOPS_FESTIVE_INSTA_KYC_2026).
import festive_kyc  # noqa: E402

app.include_router(festive_kyc.router)

# Phase 2 — NOSTOPS Spaces India-only PIN + locality reference data (never used by Global Venues)
import spaces_localities  # noqa: E402

app.include_router(spaces_localities.router)

# Phase 3 — NOSTOPS Spaces listing, owner onboarding and admin verification
import spaces  # noqa: E402
import community_partners  # noqa: E402  (Phase 7 — mounted before spaces so /api/spaces/partners/* is never shadowed)
import teacher_service_localities  # noqa: E402  (Phase 7 — teacher service PIN codes; mounted before spaces too)

app.include_router(community_partners.router)
app.include_router(teacher_service_localities.router)
import spaces_locality_coverage  # noqa: E402  (Phase 8B.1.7 — admin locality coverage; mounted before spaces)

app.include_router(spaces_locality_coverage.router)
app.include_router(spaces.router)

# Phase 4 — Teacher → Space enquiries (no money, no booking)
import space_enquiries  # noqa: E402

app.include_router(space_enquiries.router)


@app.middleware("http")
async def _error_monitor(request: Request, call_next):
    path = request.url.path
    tagged = test_tag.activate(request.headers)
    try:
        try:
            response = await call_next(request)
        except Exception as exc:  # noqa: BLE001 — unhandled → recorded, generic 500
            await monitoring.record(
                "payment" if monitoring.is_payment_path(path) else "server",
                f"backend {request.method}", f"Unhandled {type(exc).__name__}: {str(exc)[:200]}", path=path, status=500,
            )
            return JSONResponse({"detail": "Internal server error"}, status_code=500)
        if response.status_code >= 500 and not path.startswith("/api/monitoring"):
            await monitoring.record(
                "payment" if monitoring.is_payment_path(path) else "server",
                f"backend {request.method}", f"HTTP {response.status_code}", path=path, status=response.status_code,
            )
        return response
    finally:
        test_tag.reset(tagged)

import admin_gate  # noqa: E402
import cashfree_diag  # noqa: E402
import financial_lock  # noqa: E402
import payment_guard  # noqa: E402
import payment_routing  # noqa: E402
import paypal_webhook  # noqa: E402
import preview_isolation  # noqa: E402
import public_privacy  # noqa: E402
import retreat_eligibility  # noqa: E402

_client: httpx.AsyncClient | None = None

# B4.7 / Workstream D — upstream routes that start a checkout or create a payment
# order. In preview (or with no host) they are refused before anything is sent.
# Prompt 2A: PayPal capture and the legacy Razorpay InstaKYC link/poll are payment calls too.
_PAYMENT_WRITE = re.compile(
    r"(^|/)(payments?|wallet|checkout)(/|$)|cashfree|(^|/)v1/payments/|order|top-?up|fast-track"
    r"|(^|/)pay(/|$)|(^|/)reserve(/|$)|subscribe|refund|payout|capture"
    r"|(^|/)kyc/sandbox/(create|verify)-payment(/|$)"
)

HOP_BY_HOP = {
    "host", "content-length", "connection", "keep-alive", "transfer-encoding",
    "upgrade", "proxy-authenticate", "proxy-authorization", "te", "trailers",
    "content-encoding",
    "x-nostops-test-tag",  # Prompt 2F — the test tag never leaves this preview
}


@app.on_event("startup")
async def _startup() -> None:
    global _client
    _client = httpx.AsyncClient(base_url=TARGET if TARGET_OK else "https://backend-not-configured.invalid",
                                timeout=30.0, follow_redirects=True)
    # Venue Partner monthly activity email: checks every 30 min, sends once on the 1st (09:00 IST).
    # Off on a preview pod (manual runs only); claimed in Mongo so replicas never double-send.
    import asyncio as _asyncio
    # Owner instruction (Spaces launch): automated emails stay OFF unless AUTO_EMAIL_LOOPS_ENABLED=TRUE is set.
    if os.environ.get("AUTO_EMAIL_LOOPS_ENABLED", "").upper() == "TRUE":
        app.state.venue_monthly_task = _asyncio.create_task(venue_growth_partners.auto_loop())
        # Finish-your-profile reminders (claimed listings): every 30 min in IST daytime; off on a preview pod.
        app.state.claim_reminder_task = _asyncio.create_task(claim_reminders.auto_loop())
    # Phase 2: load the India PIN/locality dataset in the background (idempotent, version-keyed).
    app.state.in_pincodes_task = _asyncio.create_task(spaces_localities.ensure_dataset())
    # Self-seed the Yogic Paramparā Knowledge Graph so a fresh deploy populates
    # its production DB automatically (idempotent; best-effort; never blocks API).
    try:
        import asyncio
        await asyncio.to_thread(_bootstrap_knowledge_graph)
    except Exception as exc:  # noqa: BLE001
        print("knowledge-graph bootstrap skipped:", exc)
    # Self-seed the public DEMONSTRATION ecosystem (6 organisations / reused
    # Council programmes / demo teachers / 6 public events) so a fresh deploy
    # shows the NOSTOPS institutional model end to end. Idempotent (keyed by
    # demo_seed_key — never duplicates); best-effort; never blocks the API.
    # Owner instruction (production replacement): demonstration / QA records are created ONLY on a
    # preview pod (or with DEMO_SEED_ENABLED=TRUE). Production startup never adds them.
    if not (ON_PREVIEW_POD or os.environ.get("DEMO_SEED_ENABLED", "").upper() == "TRUE"):
        return
    try:
        import seed_demo_ecosystem
        await seed_demo_ecosystem.main()
        # Phase B1.1 (owner-approved for production): one clearly labelled, non-bookable
        # illustrative Special Needs example per cohort (DRAFT/PRIVATE/CLOSED, no slug,
        # no date, no teacher). Idempotent; adds only these 3 records.
        import seed_special_needs_examples
        await seed_special_needs_examples.ensure()
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger("startup").exception("demo-ecosystem seed skipped: %s", exc)


def _bootstrap_knowledge_graph() -> None:
    try:
        from knowledge_migrate import bootstrap as kg_bootstrap
        kg_bootstrap()
    except Exception as exc:  # noqa: BLE001
        print("kg seed skipped:", exc)
        return
    # First-run only: derive real teacher/city inventory from the live directory.
    try:
        import knowledge_bridge as bridge
        if bridge.DB.kg_teacher_parampara.count_documents({"source": "directory-bridge"}) == 0:
            bridge.rebuild()
    except Exception as exc:  # noqa: BLE001
        print("kg bridge skipped:", exc)


@app.on_event("shutdown")
async def _shutdown() -> None:
    if _client is not None:
        await _client.aclose()


@app.get("/api/health")
async def health() -> dict:
    return {"status": "healthy", "proxy": True, "target": TARGET if TARGET_OK else None, "backend_configured": TARGET_OK}


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy(path: str, request: Request) -> Response:
    assert _client is not None
    if not TARGET_OK:  # never fall back to another environment
        return JSONResponse({"error": "backend_not_configured"}, status_code=503)
    # FINANCIAL SAFETY AUDIT: money actions and state-changing reads are refused
    # FIRST, before anything (even the admin role check) reaches the main backend.
    body = await request.body()
    # Fail closed: an encoded "?" / "#" (%3F / %23) or a control character arrives here decoded
    # and would be re-parsed by httpx as a query/fragment delimiter, so the upstream would see
    # a different (possibly money) route than the one checked below. No real route has them.
    if any(c in s for s in (path, admin_gate._canonical(path)) for c in "?#") or any(ord(c) < 32 for c in path):
        return JSONResponse({"detail": "bad path"}, status_code=400)
    locked_rule = financial_lock.rule_for(request.method, path, request.url.query, body)
    if locked_rule:
        return financial_lock.refuse(locked_rule)
    canonical = admin_gate._canonical(path)
    # Payments Prompt 2A — upstream routes that break the provider-routing policy (international
    # via Cashfree; the retired Razorpay InstaKYC link) are refused before anything is sent.
    routing_refusal = payment_routing.gateway_refusal(request.method, canonical)
    if routing_refusal is not None:
        return routing_refusal
    # Payments Prompt 2B — an order-creation route must carry the buyer's billing country
    # (X-Billing-Country) and route to Cashfree in INR; retired payment links and a PayPal
    # checkout that isn't approved yet are refused. Nothing is forwarded otherwise.
    checkout_refusal = payment_routing.gateway_checkout_refusal(request.method, canonical, request.headers, body)
    if checkout_refusal is not None:
        return checkout_refusal
    # Payments Prompt 2D — preview is view-only for the real main backend: no write leaves a
    # preview / local / unknown host (sign-in/out only). Applied before every outbound write below.
    preview_refusal = preview_isolation.refusal(request.method, path, request.headers)
    # PayPal notifications are verified HERE (signature, environment, merchant, once per event)
    # before anything is forwarded; unverifiable → refused (fail closed).
    if canonical == paypal_webhook.PATH:
        if preview_refusal is not None:
            return preview_refusal
        return await paypal_webhook.handle(_client, request, body)
    # Inbound payment notifications pass the lock (they record money coming in) but must at
    # least carry the provider's signature; the main backend verifies it.
    if financial_lock.unsigned_webhook(request.method, canonical, request.headers):
        return JSONResponse({"detail": "bad webhook"}, status_code=400)
    # P2 — the Cashfree diagnostic: admin-only, minimal and briefly cached at the gateway.
    if canonical == cashfree_diag.PATH:
        return await cashfree_diag.handle(_client, request.method, request.headers)
    # MB-03 / MB-05 at the gateway: an empanelment grant or Fast-Track decision needs a
    # recorded Policy V2 case (approval + admin activation, or a recorded "not approved").
    import empanelment_policy  # noqa: E402 — local import keeps startup order unchanged
    refused = await empanelment_policy.gateway_policy_check(request.method, admin_gate._canonical(path), body)
    if refused:
        return JSONResponse({"detail": refused, "policy_version": empanelment_policy.POLICY_VERSION}, status_code=409)
    # B5.1 / TVR-01: admin-only upstream routes require an administrator here,
    # server-side, before anything is forwarded (see admin_gate.py).
    admin_path = admin_gate.is_admin_path(path)
    if admin_path:
        denied = await admin_gate.check(_client, request.method, path, request.headers)
        if denied is not None:
            return denied
    if (request.method.upper() not in ("GET", "HEAD", "OPTIONS") and _PAYMENT_WRITE.search(canonical)
            and payment_guard.ingress_blocked(request.headers)):
        return JSONResponse({"detail": payment_guard.DISABLED_DETAIL, "payments_disabled": True}, status_code=503)
    # Payments Prompt 2D — no seat or group hold once the retreat has started (read from the
    # retreat itself, in its own time zone; a date sent by the client is never used).
    closed = await retreat_eligibility.gateway_check(_client, request.method, path, request.headers)
    if closed is not None:
        return closed
    if preview_refusal is not None:
        return preview_refusal
    fwd_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP
    }
    if admin_path and request.method.upper() == "OPTIONS":
        # Preflights skip the role check, so they never carry credentials upstream.
        fwd_headers = admin_gate.without_credentials(fwd_headers)
    try:
        upstream = await _client.request(
            request.method,
            f"/api/{path}",
            params=request.query_params,
            headers=fwd_headers,
            content=body if body else None,
        )
    except httpx.RequestError as exc:
        return JSONResponse(
            {"error": "upstream_unreachable", "detail": str(exc)}, status_code=502
        )

    resp_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in HOP_BY_HOP
    }
    content = upstream.content
    # B4.7 / Workstream C — public reads never carry contact details, raw KYC
    # flags, internal ids or test markers to the browser.
    if public_privacy.is_public_read(request.method, canonical) and "json" in (upstream.headers.get("content-type") or ""):
        import trust_review  # B4.8 — reviewer SUSPEND / REVOKE decisions update public reads
        try:
            withdrawn = frozenset(await trust_review.withdrawn_handles())
        except Exception:  # noqa: BLE001 — never break a public read on a lookup failure
            withdrawn = frozenset()
        content = public_privacy.sanitize_body(content, withdrawn)
    return Response(
        content=content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
    )
