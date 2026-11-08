"""
NOSTOPS "Ask AI Guru" — CTA registry.

Every CTA maps to a workflow that ACTUALLY EXISTS in the app. The Guru must
never offer an action that has no destination. resolve_ctas() filters by the
caller's auth state / role and resolves role-based and contextual links, so the
Guru is only ever shown CTAs that are valid for the current user on the current
page.

auth:  "any"  → anyone (anonymous or signed-in)
       "anon" → only when NOT signed in
       "required" → only when signed in (optionally gated by `roles`)
role_href / href_template let a single CTA resolve to the right destination.
"""
from typing import Optional

CTA_REGISTRY: dict[str, dict] = {
    # Teachers
    "become_a_teacher": {
        "label": "Create My Teacher Profile",
        "href": "/become-a-teacher",
        "auth": "any",
    },
    "claim_profile": {
        "label": "Claim My Profile",
        "href": "/claim",
        "auth": "any",
    },
    "complete_verification": {
        "label": "Complete Verification",
        "href": "/app/teacher/get-verified",
        "auth": "required",
        "roles": ["teacher"],
    },
    "create_retreat": {
        "label": "Create a Retreat",
        "href": "/app/teacher/retreats/new",
        "auth": "required",
        "roles": ["teacher"],
    },
    # Venues
    "list_my_venue": {
        "label": "List My Venue",
        "href": "/venues/submit",
        "role_href": {"venue": "/app/venue/centers/new"},
        "auth": "any",
    },
    "explore_venues": {"label": "Explore Venues", "href": "/venues", "auth": "any"},
    # Organisations / programmes
    "for_organisations": {"label": "For Organisations", "href": "/for-organisations", "auth": "any"},
    "create_programme": {"label": "Create a Programme", "href": "/app/org/events/new", "auth": "any"},
    "explore_programmes": {"label": "Explore Programmes", "href": "/programmes", "auth": "any"},
    # Participants / seekers
    "find_a_teacher": {"label": "Find a Teacher", "href": "/teachers", "auth": "any"},
    "explore_retreats": {"label": "Explore Retreats", "href": "/retreats", "auth": "any"},
    "register_for_event": {
        "label": "Register for This Event",
        "href_template": "/events/{event_slug}/register",
        "contextual": "event_slug",
        "gated_on": "registration_open",
        "auth": "any",
    },
    "my_programmes": {
        "label": "My Programmes",
        "href": "/participant",
        "role_href": {"organisation": "/app/org/dashboard", "hr": "/app/org/dashboard"},
        "auth": "any",
    },
    # Account / dashboard / support
    "open_dashboard": {
        "label": "Open My Dashboard",
        "role_href": {
            "teacher": "/app/teacher/dashboard",
            "organisation": "/app/org/dashboard",
            "hr": "/app/org/dashboard",
            "venue": "/app/venue",
            "coordinator": "/app/coordinator",
            "admin": "/app/admin",
        },
        "auth": "required",
    },
    "log_in": {"label": "Log In", "href": "/login", "auth": "anon"},
    # Human escalation. Until the in-chat Support Request lands (later prompt),
    # this routes to the existing human-support page.
    "create_support_request": {
        "label": "Create Support Request",
        "href": "/contact",
        "auth": "any",
    },
}


def _role_of(context: Optional[dict]) -> str:
    return ((context or {}).get("role") or "").strip().lower()


def _is_authed(context: Optional[dict]) -> bool:
    return bool((context or {}).get("authenticated"))


def resolve_ctas(ids: list[str], context: Optional[dict] = None) -> list[dict]:
    """Return [{id,label,href}] for the valid subset of `ids` given context.

    Drops CTAs whose workflow does not apply (wrong auth state, wrong role, or a
    contextual CTA whose required context value — e.g. event_slug — is missing).
    """
    context = context or {}
    role = _role_of(context)
    authed = _is_authed(context)
    out: list[dict] = []
    seen: set[str] = set()
    for cid in ids:
        spec = CTA_REGISTRY.get(cid)
        if not spec or cid in seen:
            continue
        auth = spec.get("auth", "any")
        if auth == "anon" and authed:
            continue
        if auth == "required" and not authed:
            continue
        roles = spec.get("roles")
        if roles and role not in roles:
            continue
        # Gate (e.g. only offer "Register" when registration is actually open).
        gate = spec.get("gated_on")
        if gate and not context.get(gate):
            continue
        # Resolve destination
        href = spec.get("href")
        if spec.get("role_href"):
            href = spec["role_href"].get(role, href)
        if spec.get("href_template"):
            key = spec.get("contextual")
            val = (context.get(key) if key else None) or ""
            if not val:
                continue  # contextual CTA with no value — never offer it
            href = spec["href_template"].format(**{key: val})
        if not href:
            continue
        out.append({"id": cid, "label": spec["label"], "href": href})
        seen.add(cid)
    return out


def render_cta_catalog(context: Optional[dict] = None) -> str:
    """Describe the CTAs the Guru is allowed to offer RIGHT NOW (for the prompt)."""
    all_ids = list(CTA_REGISTRY.keys())
    valid = resolve_ctas(all_ids, context)
    if not valid:
        return "No actionable CTAs are available for this user right now."
    lines = ["Available CTAs (offer ONLY these; use the exact id and label):"]
    for c in valid:
        lines.append(f"- id={c['id']} · label=\"{c['label']}\" · href={c['href']}")
    return "\n".join(lines)
