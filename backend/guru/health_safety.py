"""Deterministic health-safety check for AI Guru replies (Phase B1.1).

Guardrail rule 7 tells the model never to name a programme because of a named
health condition. That rule alone is a prompt instruction, so this module enforces
it in code: when the user's recent messages name a condition and the reply names a
Council programme, the router asks for one rewrite and, if that still names a
programme, replaces the reply with SAFE_CONDITION_REPLY.
"""
import re
from typing import Iterable

from .knowledge import CURRENT_PROGRAMME_EXAMPLES

_CONDITION = re.compile(
    r"\b(?:"
    r"pains?|painful|aches?|aching|stiff(?:ness)?|injur(?:y|ies|ed)|sprain\w*|fractur\w*|"
    r"spondyl\w*|arthrit\w*|sciatica|(?:slipped|herniated|bulging)\s+discs?|frozen\s+shoulder|"
    r"scoliosis|osteopor\w*|diabet\w*|hypertension|blood\s+pressure|asthma\w*|pco[ds]?|thyroid\w*|"
    r"migraines?|insomnia|cancer|heart\s+(?:disease|condition|problem|attack)s?|surger(?:y|ies)|"
    r"post[- ]?op\w*|pregnan\w*|depress(?:ion|ive)|anxiety\s+disorders?|panic\s+attacks?|ptsd|adhd|"
    r"autis\w*|epilep\w*|parkinson\w*|dementia|alzheimer\w*|multiple\s+sclerosis|cerebral\s+palsy|"
    r"disorders?|syndromes?|diseases?|diagnos\w*|chronic|"
    r"(?:medical|health)\s+(?:conditions?|issues?|problems?)"
    r")\b",
    re.IGNORECASE,
)


def _norm(text: str) -> str:
    text = (text or "").lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()  # punctuation/markdown = word gaps


def _programme_phrases() -> list[str]:
    phrases = set()
    for names in CURRENT_PROGRAMME_EXAMPLES.values():
        for name in names:
            full = _norm(name)
            phrases.add(full)
            if full.startswith("yoga for "):
                phrases.add(full[len("yoga for "):])  # "posture and back care"
    return sorted(phrases, key=len, reverse=True)


_PROGRAMME_PHRASES = _programme_phrases()

REWRITE_INSTRUCTION = (
    "Rewrite your previous answer. The user named a health condition, so you must NOT "
    "name, list or suggest any specific programme (including any title from the "
    "catalogue) and must not describe what any programme does for that condition. "
    "Keep everything else that is accurate: organisers can browse every approved "
    "programme in the Mind, Body and Special Needs pathways or request a customised "
    "programme, suitability is decided per participant, and anyone with pain, an "
    "injury or a health condition should follow their healthcare professional's advice "
    "and tell the teacher before starting."
)

SAFE_CONDITION_REPLY = (
    "I can't recommend a specific programme for a health condition. Organisers can "
    "browse every approved programme in the Mind, Body and Special Needs pathways — or "
    "request a customised programme if none fits — and suitability is decided per "
    "participant: it depends on the person's circumstances, the practice and its "
    "precautions, and a teacher with verified competence.\n\n"
    "Yoga teachers don't replace doctors, physiotherapists or other healthcare "
    "professionals. Anyone with pain, an injury or a health condition should follow "
    "their healthcare professional's advice and tell the teacher before starting."
)

SAFE_CONDITION_CTAS = ["explore_programmes", "for_organisations"]


def condition_named(texts: Iterable[str]) -> bool:
    return any(_CONDITION.search(t or "") for t in texts)


def names_programme(reply: str) -> bool:
    text = f" {_norm(reply)} "
    return any(f" {p} " in text for p in _PROGRAMME_PHRASES)
