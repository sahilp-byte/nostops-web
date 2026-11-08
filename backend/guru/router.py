"""
NOSTOPS "Ask AI Guru" — local chat endpoint.

ISOLATED local feature mounted BEFORE the catch-all proxy so /api/guru/* is
served locally and never forwarded to the remote business backend. It composes
the authoritative knowledge + guardrails (the `guru` package) into a system
message and calls the established local Emergent LLM pattern (same as ai.py:
emergentintegrations + Claude Sonnet + EMERGENT_LLM_KEY). Stateless: the client
holds the transcript and the safe page/user context, which the BFF enriches with
the signed-in role before calling here (secured by X-Pulse-Secret).

Non-streaming by design: the full reply is needed to parse and strip the
[[CTA:<id>]] tokens the model emits, so the app can render only verified action
buttons.
"""
import hmac
import os
import re
import uuid
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .cta import render_cta_catalog, resolve_ctas
from .guardrails import FALLBACK_MESSAGE, GURU_MODEL, build_system_prompt
from .knowledge import assemble_knowledge_text
from . import health_safety
from . import support as support_store

load_dotenv()

SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

router = APIRouter(prefix="/api/guru", tags=["guru"])

MAX_HISTORY = 12
# Also accepts the malformed "[[for_organisations]]" form (no "CTA:" prefix) so it
# never shows as literal text; unknown ids are dropped by resolve_ctas.
CTA_TOKEN = re.compile(r"\[\[\s*(?:CTA\s*:\s*)?([a-z_]+)\s*\]\]", re.IGNORECASE)
_CONTEXT_KEYS = ("role", "page_type", "route", "journey", "onboarding_stage", "event_slug")


def _check_secret(x_pulse_secret: Optional[str]) -> None:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)


class GuruChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[Turn] = Field(default_factory=list)
    context: dict = Field(default_factory=dict)
    session_id: Optional[str] = Field(default=None, max_length=80)


def _safe_context(raw: dict) -> dict:
    """Whitelist + coerce the context the BFF forwards. Nothing private here."""
    out: dict = {"authenticated": bool(raw.get("authenticated"))}
    if raw.get("registration_open") is True:
        out["registration_open"] = True
    for k in _CONTEXT_KEYS:
        v = raw.get(k)
        if isinstance(v, str) and v.strip():
            out[k] = v.strip()[:120]
    return out


def _parse_reply(raw: Optional[str]) -> tuple[str, list[str]]:
    """Strip the [[CTA:id]] tokens from a model reply; return (text, cta_ids)."""
    raw = (raw or "").strip()
    cta_ids = [m.lower() for m in CTA_TOKEN.findall(raw)]
    reply = re.sub(r"\n{3,}", "\n\n", CTA_TOKEN.sub("", raw).strip()).strip()
    return reply, cta_ids


def _build_user_text(history: list[Turn], message: str) -> str:
    recent = history[-MAX_HISTORY:]
    if not recent:
        return message.strip()
    lines = ["RECENT CONVERSATION (context only — do not repeat it back verbatim):"]
    for t in recent:
        who = "User" if t.role == "user" else "Guru"
        lines.append(f"{who}: {t.content.strip()}")
    lines.append("")
    lines.append("NEW USER MESSAGE:")
    lines.append(message.strip())
    return "\n".join(lines)


@router.post("/chat")
async def chat(payload: GuruChatIn, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)

    ctx = _safe_context(payload.context or {})
    session_id = payload.session_id or f"guru-{uuid.uuid4().hex}"
    await support_store.record_chat(ctx.get("page_type"), ctx.get("role"))

    system = build_system_prompt(
        ctx,
        assemble_knowledge_text(ctx),
        render_cta_catalog(ctx),
    )
    user_text = _build_user_text(payload.history, payload.message)

    def _fallback(extra: str = ""):
        ctas = resolve_ctas(["create_support_request"], ctx)
        reply = FALLBACK_MESSAGE + (f" {extra}" if extra else "")
        return {"reply": reply, "ctas": ctas, "session_id": session_id}

    if not EMERGENT_LLM_KEY:
        return _fallback()

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system,
        ).with_model(*GURU_MODEL)
        raw = await llm.send_message(UserMessage(text=user_text))
    except Exception:  # noqa: BLE001 — never 5xx the chat UI; degrade to human support.
        return _fallback("Please try again in a moment.")

    reply, cta_ids = _parse_reply(raw)
    if not reply:
        return _fallback()

    # Health safety (guardrail rule 7, enforced in code): never name a programme in
    # reply to a named condition — one rewrite, then a fixed safe answer.
    user_turns = [payload.message] + [t.content for t in payload.history if t.role == "user"][-3:]
    if health_safety.condition_named(user_turns) and health_safety.names_programme(reply):
        try:
            retry, retry_ctas = _parse_reply(
                await llm.send_message(UserMessage(text=health_safety.REWRITE_INSTRUCTION))
            )
        except Exception:  # noqa: BLE001
            retry, retry_ctas = "", []
        if retry and not health_safety.names_programme(retry):
            reply, cta_ids = retry, retry_ctas
        else:
            reply, cta_ids = health_safety.SAFE_CONDITION_REPLY, health_safety.SAFE_CONDITION_CTAS

    ctas = resolve_ctas(cta_ids, ctx)
    # If the model used the fallback wording, always ensure a human path is offered.
    if FALLBACK_MESSAGE.split(".")[0] in reply and not any(c["id"] == "create_support_request" for c in ctas):
        ctas = ctas + resolve_ctas(["create_support_request"], ctx)

    return {"reply": reply, "ctas": ctas, "session_id": session_id}


# ─────────────────────────── SUPPORT REQUESTS ──────────────────────────────
class SupportIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    category: str = Field(min_length=1, max_length=60)
    issue: str = Field(min_length=1, max_length=4000)
    name: Optional[str] = Field(default=None, max_length=120)
    role: Optional[str] = Field(default=None, max_length=40)
    summary: Optional[str] = Field(default=None, max_length=500)
    conversation: list[Turn] = Field(default_factory=list)
    context: dict = Field(default_factory=dict)
    reference: Optional[str] = Field(default=None, max_length=200)
    priority: Optional[str] = Field(default=None, max_length=12)


class SupportUpdateIn(BaseModel):
    status: Optional[str] = Field(default=None, max_length=24)
    assignee: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=4000)
    note_author: Optional[str] = Field(default=None, max_length=120)


@router.get("/support/meta")
async def support_meta(x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    return {"categories": support_store.CATEGORIES, "statuses": support_store.STATUSES}


@router.post("/support")
async def create_support(payload: SupportIn, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    ctx = _safe_context(payload.context or {})
    result = await support_store.create_request(
        email=payload.email,
        category=payload.category,
        issue=payload.issue,
        name=payload.name,
        role=payload.role or ctx.get("role"),
        summary=payload.summary,
        conversation=[t.model_dump() for t in payload.conversation],
        page_type=ctx.get("page_type"),
        route=ctx.get("route"),
        reference=payload.reference or ctx.get("event_slug"),
        priority=payload.priority,
    )
    return result


@router.get("/support/requests")
async def list_support(
    status: Optional[str] = None,
    category: Optional[str] = None,
    x_pulse_secret: Optional[str] = Header(None),
):
    _check_secret(x_pulse_secret)
    return {"items": await support_store.list_requests(status=status, category=category)}


@router.get("/support/analytics")
async def support_analytics(x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    return await support_store.analytics()


@router.get("/support/requests/{rid}")
async def get_support(rid: str, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    doc = await support_store.get_request(rid)
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    return doc


@router.post("/support/requests/{rid}")
async def update_support(rid: str, payload: SupportUpdateIn, x_pulse_secret: Optional[str] = Header(None)):
    _check_secret(x_pulse_secret)
    doc = await support_store.update_request(
        rid,
        status=payload.status,
        assignee=payload.assignee,
        note=payload.note,
        note_author=payload.note_author,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    return doc
