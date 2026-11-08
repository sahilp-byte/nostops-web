"""
NOSTOPS AI helpers — isolated local FastAPI feature.

Currently exposes ONE endpoint used by the teacher profile editor and the
onboarding wizard: polish an existing bio draft with Claude. It is a stateless
text transform — no data is stored, no PII leaves beyond the draft the teacher
typed. Mounted BEFORE the catch-all proxy so /api/ai/* is served locally and is
never forwarded to the remote business backend.

Security: like the other internal routers, every request MUST carry the shared
secret header `X-Pulse-Secret`. The browser never holds this secret — all calls
are proxied by the Next.js BFF, which validates the NOSTOPS session first.
"""
import hmac
import os
import re
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

load_dotenv()

SECRET = os.environ.get("PULSE_SHARED_SECRET", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

router = APIRouter(prefix="/api/ai", tags=["ai"])

BIO_SYSTEM = (
    "You are a warm, precise copy editor for NOSTOPS, a teachers-first yoga cooperative. "
    "You POLISH a yoga teacher's existing bio — you never invent facts. Improve clarity, "
    "flow, warmth and professionalism while keeping the teacher's own voice and every real "
    "detail (lineage, styles, years, city, specialisations, achievements) intact. Do NOT add "
    "credentials, numbers, schools or claims that are not already present. Write in first "
    "person, 60–150 words, 1–2 short paragraphs, plain text (no markdown, headings, quotes or "
    "emojis). Return ONLY the improved bio text and nothing else."
)


def _check_secret(x_pulse_secret: str | None) -> None:
    if not SECRET or not x_pulse_secret or not hmac.compare_digest(x_pulse_secret, SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")


class ImproveBioIn(BaseModel):
    bio: str = Field(min_length=20, max_length=4000)
    hints: str = Field(default="", max_length=1000)


@router.post("/improve-bio")
async def improve_bio(payload: ImproveBioIn, x_pulse_secret: str | None = Header(None)):
    _check_secret(x_pulse_secret)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured.")

    prompt = "Polish this yoga teacher bio. Keep it truthful and in their voice.\n\n"
    if payload.hints.strip():
        prompt += f"Context you may use (do not invent beyond this): {payload.hints.strip()}\n\n"
    prompt += f"Current bio:\n{payload.bio.strip()}"

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bio-{uuid.uuid4().hex}",
            system_message=BIO_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-6")
        improved = await chat.send_message(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI could not improve the bio: {str(exc)[:180]}")

    improved = (improved or "").strip()
    if not improved:
        raise HTTPException(status_code=502, detail="AI returned an empty result.")
    return {"bio": improved}


SUMMARY_SYSTEM = (
    "You are a precise editor for NOSTOPS, a teachers-first yoga cooperative. "
    "Write a crisp 2-line summary (about 25–40 words, max two sentences) of the given "
    "article, to appear on listing cards and at the top of the article. Be faithful to the "
    "article — never invent facts. Neutral, inviting, plain text: no markdown, no headings, "
    "no quotes, no emojis, no hashtags, no 'In this article' preamble. Return ONLY the summary."
)

MAX_SUMMARY = 320


def _clean_summary(raw: str) -> str:
    s = re.sub(r"\s+", " ", (raw or "").strip()).strip('"').strip("'").strip()
    s = re.sub(r"[*_#>`]", "", s)
    return s[:MAX_SUMMARY].strip()


class SummarizeIn(BaseModel):
    title: str = Field(default="", max_length=200)
    content: str = Field(min_length=20, max_length=40000)


@router.post("/summarize")
async def summarize(payload: SummarizeIn, x_pulse_secret: str | None = Header(None)):
    _check_secret(x_pulse_secret)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured.")

    prompt = f"Title: {payload.title.strip() or '(untitled)'}\n\nArticle:\n{payload.content.strip()[:6000]}\n\nWrite the 2-line summary now."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"voices-sum-{uuid.uuid4().hex}",
            system_message=SUMMARY_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-6")
        out = await chat.send_message(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI could not write the summary: {str(exc)[:180]}")

    summary = _clean_summary(out or "")
    if not summary:
        raise HTTPException(status_code=502, detail="AI returned an empty summary.")
    return {"summary": summary}



FORMAT_SYSTEM = (
    "You are an editorial typesetter for NOSTOPS Voices, a teachers-first yoga cooperative. "
    "The author is a yoga teacher, not a technical writer, and has pasted raw text. Your ONLY "
    "job is to FORMAT their text into clean, readable Markdown. This is a strict formatting "
    "pass, NOT an edit: you MUST preserve every one of the author's own words, sentences, their "
    "order and their meaning EXACTLY. Do NOT rewrite, paraphrase, summarise, translate, correct, "
    "add or delete any words, facts or sentences. Keep the author's original language.\n\n"
    "Apply ONLY these formatting improvements:\n"
    "- Keep all sentences and paragraphs in their ORIGINAL ORDER; never move, reorder or regroup them.\n"
    "- Split the text into short paragraphs separated by a blank line.\n"
    "- Add '## ' section headings and '### ' subheadings at natural topic shifts. Heading text "
    "must be taken verbatim, or as a faithful short phrase, from the author's own words — never "
    "invent a new idea or a title that is not already in the text.\n"
    "- Use '**bold**' sparingly for a few genuinely key terms or takeaways.\n"
    "- Use '*italics*' for Sanskrit terms, mantras, and asana / text / book names.\n"
    "- Use '> ' for at most one or two standout lines quoted directly from the text.\n"
    "- Use '- ' bullet lists or '1. ' numbered lists ONLY where the author is clearly listing "
    "items or steps.\n"
    "- You may use '<u>...</u>' underline VERY rarely, for a single critical caution.\n"
    "- Keep any existing links intact.\n\n"
    "Return ONLY the formatted Markdown of the author's text — no preamble, no explanation, no "
    "code fences."
)


def _strip_fences(raw: str) -> str:
    s = (raw or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9]*\s*\n?", "", s)
        s = re.sub(r"\n?```\s*$", "", s)
    return s.strip()


class FormatIn(BaseModel):
    title: str = Field(default="", max_length=200)
    type: str = Field(default="", max_length=60)
    content: str = Field(min_length=20, max_length=40000)


@router.post("/format-article")
async def format_article(payload: FormatIn, x_pulse_secret: str | None = Header(None)):
    _check_secret(x_pulse_secret)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured.")

    prompt = (
        f"Article type: {payload.type.strip() or 'Article'}\n"
        f"Title: {payload.title.strip() or '(untitled)'}\n\n"
        "Format the author's text below. Preserve every word exactly.\n\n"
        "----- BEGIN AUTHOR TEXT -----\n"
        f"{payload.content.strip()}\n"
        "----- END AUTHOR TEXT -----"
    )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"voices-fmt-{uuid.uuid4().hex}",
            system_message=FORMAT_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-6")
        out = await chat.send_message(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI could not format the article: {str(exc)[:180]}")

    content_md = _strip_fences(out or "")
    if not content_md:
        raise HTTPException(status_code=502, detail="AI returned an empty result.")
    return {"content_md": content_md}
