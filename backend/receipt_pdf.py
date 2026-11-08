"""One-page PDF payment receipt (reportlab) for institutional PAID registrations.

Server-generated only — no caller input reaches this module; it is handed
already-sanitised strings from the engine and returns PDF bytes to attach to the
confirmation email. Uses the built-in Helvetica font (reliable, Latin). Amounts
are rendered with an ISO currency code (e.g. "INR 499.00") rather than a ₹ glyph,
which the built-in fonts do not include.
"""
from __future__ import annotations

import io
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND = colors.HexColor("#4F46E5")
INK = colors.HexColor("#232A4D")
SOFT = colors.HexColor("#6B7280")
LINE = colors.HexColor("#ECECF1")

_H = ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=22, textColor=BRAND, leading=24, spaceAfter=0)
_SUB = ParagraphStyle("sub", fontName="Helvetica", fontSize=9.5, textColor=SOFT, leading=13)
_RH = ParagraphStyle("rh", fontName="Helvetica-Bold", fontSize=14, textColor=INK, leading=18)
_LABEL = ParagraphStyle("label", fontName="Helvetica", fontSize=10, textColor=SOFT, leading=14)
_VALUE = ParagraphStyle("value", fontName="Helvetica-Bold", fontSize=11, textColor=INK, leading=15)
_PAID = ParagraphStyle("paid", fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor("#047857"), leading=15)
_FOOT = ParagraphStyle("foot", fontName="Helvetica", fontSize=8.5, textColor=SOFT, leading=12)


def format_money_pdf(amount, currency: Optional[str]) -> str:
    cur = (currency or "INR").upper()
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return "—"
    if amt <= 0:
        return "—"
    return f"{cur} {amt:,.2f}"


def build_receipt_pdf(
    *,
    title: str,
    org_name: Optional[str],
    when: str,
    where: Optional[str],
    participant: Optional[str],
    amount_str: str,
    paid_on: str,
    booking_ref: Optional[str],
    order_ref: Optional[str],
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title="NOSTOPS Payment Receipt",
        author="NOSTOPS",
    )
    story = [
        Paragraph("NOSTOPS", _H),
        Paragraph("A Teacher-First Yoga Cooperative", _SUB),
        Spacer(1, 9 * mm),
        Paragraph("Payment Receipt", _RH),
        Spacer(1, 4 * mm),
    ]

    rows = [("Programme", title)]
    if org_name:
        rows.append(("Organised by", org_name))
    rows.append(("When", when))
    if where:
        rows.append(("Where", where))
    if participant:
        rows.append(("Participant", participant))
    rows.append(("Amount paid", amount_str))
    rows.append(("Paid on", paid_on))
    if booking_ref:
        rows.append(("Booking reference", booking_ref))
    if order_ref:
        rows.append(("Payment reference", order_ref))

    data = [[Paragraph(k, _LABEL), Paragraph(str(v), _PAID if k == "Amount paid" else _VALUE)] for k, v in rows]
    tbl = Table(data, colWidths=[42 * mm, None], hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 12 * mm))
    story.append(
        Paragraph(
            "Thank you for your payment. This receipt confirms your registration is paid in full. "
            "NOSTOPS never stores your card details — payments are processed securely by our payment partner. "
            "Keep this receipt for your records and expense claims.",
            _FOOT,
        )
    )
    doc.build(story)
    return buf.getvalue()
