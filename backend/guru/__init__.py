"""
NOSTOPS "Ask AI Guru" — authoritative knowledge + guardrails layer.

This package is the single source of truth for what the NOSTOPS Product Guru
knows and how it is allowed to answer. It is PURE CONTENT + POLICY — it makes
NO LLM calls and touches NO database. The chat endpoint built in a later prompt
composes these pieces into the system message for the (already-established)
local Emergent LLM pattern used by ai.py.

Modules
  knowledge.py  — authoritative NOSTOPS product knowledge (domains A–G) + the
                  strict Council taxonomy (MIND / BODY / SPECIAL NEEDS).
  cta.py        — registry of actionable CTAs mapped ONLY to workflows that
                  actually exist, with auth/role/contextual resolution.
  guardrails.py — the hard guardrails + system-prompt builder (role, pricing
                  protection, earnings language, source priority, style,
                  fallback + Create Support Request).
"""
from .knowledge import (
    TAXONOMY_LABELS,
    assemble_knowledge_text,
    knowledge_sections,
)
from .cta import CTA_REGISTRY, render_cta_catalog, resolve_ctas
from .guardrails import FALLBACK_MESSAGE, GURU_MODEL, build_system_prompt

__all__ = [
    "TAXONOMY_LABELS",
    "assemble_knowledge_text",
    "knowledge_sections",
    "CTA_REGISTRY",
    "render_cta_catalog",
    "resolve_ctas",
    "FALLBACK_MESSAGE",
    "GURU_MODEL",
    "build_system_prompt",
]
