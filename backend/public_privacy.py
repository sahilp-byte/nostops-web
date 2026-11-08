"""B4.7 Workstream C — public payload minimisation at the gateway.

The main backend (pro-learn-connect-1) returns contact details, raw KYC / PAN /
bank flags, legacy and internal identifiers and test-data markers in several
PUBLIC (anonymous) teacher, council, retreat and venue reads. Until its owner
fixes those responses (see BACKEND_HANDOFF_B47_main_backend.md), this gateway
strips them before a public read reaches the browser, and replaces the raw KYC
flag with the single derived public trust state:

    nostops_verified = ID check passed (kyc_verified) AND empanelled   (owner decision)
    id_checked       = ID check passed

Private workflows are untouched: /me/ routes, admin routes and every non-GET
request are never rewritten.
"""
import json
import re
from typing import Any

RESTRICTED_KEYS = frozenset({
    "email", "phone", "mobile", "whatsapp", "contact_email", "contact_phone",
    "user_id", "pan", "pan_number", "aadhaar", "aadhaar_number",
    "city_coordinator_id", "is_test_pollution", "platform_fee_pct",
    "venue_cost_per_seat_inr", "password", "password_hash", "session_token",
    "totp_secret", "ifsc", "account_number", "upi_id", "documents",
    "is_verified", "verification_status",
})
RESTRICTED_PREFIXES = (
    "kyc_", "pan_", "aadhaar", "phone_", "email_", "bank_", "payout_", "legacy_",
    "didit_", "whatsapp", "admin_", "internal_", "test_", "suspended_", "verification_",
)

# Public, anonymous reads (path after /api/, already canonicalised).
_PUBLIC_READ = re.compile(
    r"^(?:"
    r"teachers/(?:directory(?:/facets)?|featured|teacher-of-month|nearby|matching|smart-match"
    r"|public/[^/]+|[^/]+/(?:reviews|endorsements))"
    r"|public-reviews/[^/]+"
    r"|yoga-teachers/[^/]+|users/[^/]+"  # B4.7 remediation: profile-by-id reads leak phone / user ids
    r"|council/(?:members(?:/[^/]+)?|wall-of-authority|hero-stats)"
    r"|retreats|retreats/rt_[^/]+"
    r"|venue-partners|venue-partners/[^/]+"
    r"|seo/.+"
    r")$"
)


def is_public_read(method: str, canonical_path: str) -> bool:
    p = canonical_path.strip("/")
    if method.upper() != "GET" or "/me/" in f"/{p}/" or p.startswith(("admin", "auth")):
        return False
    return bool(_PUBLIC_READ.match(p))


def _restricted(key: str) -> bool:
    k = key.lower()
    return k in RESTRICTED_KEYS or k.startswith(RESTRICTED_PREFIXES)


def sanitize(value: Any, withdrawn: frozenset = frozenset()) -> Any:
    if isinstance(value, list):
        return [sanitize(v, withdrawn) for v in value]
    if not isinstance(value, dict):
        return value
    out = {k: sanitize(v, withdrawn) for k, v in value.items() if not _restricted(str(k))}
    if "handle" in value and ("is_empanelled" in value or "kyc_verified" in value):
        # B4.8 — a Council/admin SUSPEND or REVOKE decision withdraws "Empanelled" publicly.
        empanelled = value.get("is_empanelled") is True and value.get("handle") not in withdrawn
        if "is_empanelled" in value:
            out["is_empanelled"] = empanelled
        id_checked = value.get("kyc_verified") is True
        out["id_checked"] = id_checked
        out["nostops_verified"] = id_checked and empanelled
    return out


def sanitize_body(content: bytes, withdrawn: frozenset = frozenset()) -> bytes:
    """Return the minimised JSON body, or the original bytes if it isn't JSON."""
    try:
        data = json.loads(content or b"null")
    except ValueError:
        return content
    return json.dumps(sanitize(data, withdrawn), ensure_ascii=False).encode("utf-8")
