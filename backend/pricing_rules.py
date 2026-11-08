"""Prompt 3 (2026-10) — the ONE versioned pricing rule set for this website workspace.

Every value here is COPIED from the place it already lived (named in `source`). Nothing is
repriced. A value the founder has not approved is marked so, and the engine never turns it
into a confirmed quote. Prices owned by the separate main backend (pro-learn-connect-1) are
listed only so the engine can say who owns them; this workspace cannot set or enforce them.

Changing a value = a new RULESET_VERSION (quotes record the version they were made with).
"""

RULESET_VERSION = "NOSTOPS-PRICING-2026-10-28.4"  # .4: Prompt 3C round 2 (retreat group tiers UNAPPROVED reference only)

# ── Approval levels ──────────────────────────────────────────────────────────
APPROVED = "APPROVED"                  # stated by the founder / documented and in force
PROVISIONAL = "PROVISIONAL"            # approved provisionally (B4.8), subject to final validation
RECORDED = "RECORDED"                  # a recorded commercial value whose checkout is not enabled
UNAPPROVED = "UNAPPROVED"              # planning figure or conflicting rules: estimates only
UNVERIFIED = "UNVERIFIED"              # shown publicly, not confirmed by an authoritative server rule
UNCONFIRMED = "UNCONFIRMED"            # discussed, but no approved rule applies it yet
EXISTING_DISPLAY_RULE = "EXISTING_DISPLAY_RULE"  # an existing display figure; the real split is remote
ORGANISER_SET = "ORGANISER_SET"        # the organiser's fee on the event record (locked once published)

# ── Rounding (documented; the engine applies exactly these) ─────────────────
ROUNDING_RULES = {
    "R1": "Money is held as whole minor units (paise / cents); percentages are exact decimals. No floating point.",
    "R2": "A percentage of an amount is rounded to the nearest minor unit, half up (85% of ₹1,250 = ₹1,062.50).",
    "R3": "A tax-inclusive total is split as base = total ÷ (1 + rate), to the nearest minor unit half up; tax = total − base.",
    "R4": "Rounding to a whole rupee (half up) happens only where a whole-rupee final amount is required, "
          "and is shown as its own rounding line.",
    "R5": "Allocation: teacher share = base × teacher % (R2); NOSTOPS share = base − teacher share, so both add up to the base.",
}

MINOR_PER_MAJOR = {"INR": 100, "USD": 100}
DOMESTIC = "IN"
INTL = "INTL"

# ── Tax treatment, by product and jurisdiction (anything not listed: NOT_CONFIGURED) ──
NOT_CONFIGURED = "NOT_CONFIGURED"
TAX_RULES = {
    ("venue_ai_onboarding", DOMESTIC): {"treatment": "GST_EXCLUSIVE", "rate_bp": 1800, "approval": APPROVED,
                                        "source": "ai_onboarding.py: INR 1,999 + 18% GST"},
    ("instakyc", DOMESTIC): {"treatment": "GST_INCLUSIVE", "rate_bp": 1800, "approval": PROVISIONAL,
                             "source": "lib/pricing.ts + lib/offers.ts (B4.8): ₹279 incl. 18% GST"},
}
TAX_NOT_CONFIGURED_NOTE = ("Tax treatment is not configured for this product and jurisdiction. Nothing is added; "
                           "the amount is the configured price.")

# ── Products ─────────────────────────────────────────────────────────────────
# kind: FIXED (a price set here) · EVENT_FEE (organiser fee on the event record) · RATE_CARD (estimate
# only) · ALLOCATION (contract split, review only) · REMOTE (main backend owns the price) · NOT_QUOTABLE.
PRODUCTS = {
    "venue_ai_onboarding": {
        "kind": "FIXED", "owner": "website backend (ai_onboarding.py, its own Cashfree account)",
        "prices": {
            DOMESTIC: {"currency": "INR", "list_minor": 199_900, "approval": APPROVED},
            INTL: {"currency": "USD", "list_minor": 3_000, "approval": RECORDED,
                   "note": "Recorded commercial value. International checkout is disabled (PayPal is not built)."},
        },
        # The charged total is a whole rupee today (₹2,359), so R4 applies to the payable total.
        "payable_whole_units": True,
        "source": "ai_onboarding.py PRICING (founder-stated)",
    },
    "instakyc": {
        "kind": "FIXED", "owner": "website sets the amount; the main backend creates the order and has its own /kyc/pricing",
        "prices": {DOMESTIC: {"currency": "INR", "list_minor": 27_900, "approval": PROVISIONAL,
                              "note": "Provisional (B4.8), subject to final provider-cost and tax validation."}},
        "payable_whole_units": False,
        "source": "lib/pricing.ts INSTAKYC_PRICE_INR, lib/offers.ts",
    },
    "fast_track": {
        "kind": "REMOTE", "owner": "main backend (its Fast-Track offer sets the order amount)",
        "reference": {DOMESTIC: {"currency": "INR", "minor": 499_900}},
        "source": "lib/offers.ts FAST_TRACK_PRICE_INR, empanelment_policy.py fee_inr",
    },
    "institutional_event_fee": {
        "kind": "EVENT_FEE", "owner": "website backend (institutional.py; the organiser sets the fee per event)",
        "currency": "INR", "fee_min_major": 1, "fee_max_major": 1_000_000,
        "open_statuses": ("PUBLISHED", "LIVE", "EVERGREEN"),
        "source": "institutional.py participant_fee (whole rupees), payment/intent",
    },
    "org_programme_rate_card": {
        "kind": "RATE_CARD", "owner": "website display only (lib/org/pricing.ts)", "approval": UNAPPROVED,
        "note": "List-rate estimate (₹300 / ₹175 per participant, per session). The 15–28 / 29–40 group-size "
                "discounts are suspended. Not designated as the approved universal tariff; never a confirmed quote.",
        "source": "frontend/lib/org/pricing.ts",
    },
    "org_legacy_batch": {
        "kind": "REMOTE", "owner": "main backend (close-enrollment locks the final rate)",
        "source": "components/app/org/CloseEnrollment.tsx (website copy), main backend /bookings",
    },
    "programme_contract_allocation": {
        "kind": "ALLOCATION", "owner": "website (proposed allocation for review only; never a payout instruction)",
        "source": "documented contractual term structure (Prompt 3 decisions)",
    },
    "one_on_one": {
        "kind": "REMOTE", "owner": "main backend (the booking's amount_inr)",
        "source": "bff/one-on-one/bookings, lib/offers.ts checkBookingAmount",
    },
    "retreat_seat": {
        "kind": "REMOTE", "owner": "main backend (price_per_seat_inr; the reservation order amount)",
        "source": "bff/retreats/[id]/reserve, .../pay",
    },
    "retreat_group": {
        "kind": "REMOTE", "owner": "main backend (GET /retreats/{id}/group-quote)",
        "source": "bff/retreats/[id]/group-quote, group-book",
    },
    "wallet_topup": {"kind": "NOT_QUOTABLE", "reason": "financial_lock",
                     "message": "Wallet top-ups are paused while the money lock is on."},
    "unified_offer": {"kind": "NOT_QUOTABLE", "reason": "offer_paused",
                      "message": "The combined verification + empanelment offer is paused until its scope and pricing are approved."},
    "membership": {"kind": "NOT_QUOTABLE", "reason": "not_active", "message": "Membership is not active. Nothing is charged."},
    "org_group_booking_legacy": {
        "kind": "LEGACY_REFERENCE", "owner": "none: no approved organisation group price exists (indicative reference only)",
        "source": "LEGACY_GROUP_REFERENCE below",
    },
}

# ── Organisation rate card (lib/org/pricing.ts; UNAPPROVED as a universal tariff) ──
UNAPPROVED_BANNER = "UNAPPROVED — NOT A CONFIRMED PRICE — BOOKING UNAVAILABLE."

# Prompt 3C (founder option A): the 15–28 / 29–40 group-size discounts were never approved, so they
# are SUSPENDED. The list rate (₹300 / ₹175) applies at every size and length. The bands and their
# percentages stay here for the record only; the engine never applies them and reports them only
# with UNAPPROVED_BANNER.
RATE_CARD = {
    "cohorts": {
        "EDUCATIONAL_INSTITUTION": {"rate_minor": 17_500, "unapproved_bands": False},
        "COMPANY": {"rate_minor": 30_000, "unapproved_bands": True},
        "STARTUP_NETWORK": {"rate_minor": 30_000, "unapproved_bands": True},
    },
    "sessions_per_month": 8,          # 2 sessions a week
    "months": (1, 3, 6, 12),
    "discounts_suspended": True,
    # The suspended commitment discounts, in basis points, by band and months (record only).
    "bands": (
        {"tier": "Tier 1", "min": 15, "max": 28, "pct_bp": {1: 0, 3: 1_000, 6: 1_250, 12: 1_500}},
        {"tier": "Tier 2", "min": 29, "max": 40, "pct_bp": {1: 0, 3: 2_000, 6: 2_500, 12: 3_000}},
    ),
    "participants_input_max": 1_000,  # input bound only (not a business rule)
}

# Legacy corporate batch ladder (website copy in CloseEnrollment.tsx; the main backend applies its own).
LEGACY_BATCH_TIERS = ({"min": 40, "pct_bp": 3_000}, {"min": 29, "pct_bp": 2_000}, {"min": 18, "pct_bp": 1_000})

# ── Legacy organisation group booking: ₹5,000 baseline + legacy volume ladder (founder option A) ──
# Shown ONLY as an UNAPPROVED, indicative reference: never a confirmed, payable or bookable price,
# and the ladder is not commercially approved. No multi-month total is worked out, because the older
# model's own 3-month figure (₹30,000) does not equal 3 × ₹5,000: that total cannot be calculated reliably.
LEGACY_GROUP_REFERENCE = {
    "approval": UNAPPROVED,
    "banner": UNAPPROVED_BANNER,
    "baseline_minor": 500_000,
    "baseline_unit": "per participant, per month (as recorded in the older model; never approved)",
    "tiers": LEGACY_BATCH_TIERS,
    "participants_max": 1_000,  # input bound only
    "source": "main backend's older ROI model (investment.per_member_monthly ₹5,000, "
              "BACKEND_REQUEST_roi_calculator.md) + legacy batch ladder 18/29/40 (CloseEnrollment.tsx)",
    "term_total_note": "No multi-month total: the older model's 3-month figure (₹30,000) does not equal 3 × ₹5,000, "
                       "so it cannot be calculated reliably.",
}

# ── Revenue allocation ───────────────────────────────────────────────────────
# Documented contractual term structure. Applies ONLY to eligible 3-, 6- and 12-month institutional
# programmes, on the revenue base an approved contract defines; no other length or product carries
# it (no 1-month split); never combined with retreat economics.
CONTRACT_REVENUE_SHARE = {
    "approval": APPROVED,
    "scope": "Eligible 3-, 6- and 12-month institutional programmes only.",
    "terms": {3: {"teacher_bp": 7_000, "nostops_bp": 3_000},
              6: {"teacher_bp": 8_000, "nostops_bp": 2_000},
              12: {"teacher_bp": 8_500, "nostops_bp": 1_500}},
}
# The approved public wording (founder decision, Prompt 3C round 2). The website copy
# (frontend/lib/org/pricing.ts TEACHER_SHARE_SENTENCE) and the AI Guru use exactly this text.
TEACHER_SHARE_SENTENCE = ("For eligible institutional programmes, teachers receive 70% for 3-month engagements, "
                          "80% for 6-month engagements, and 85% for 12-month engagements, subject to the "
                          "applicable programme terms.")
TEACHER_SHARE_OTHER_WORK = "Retreats, one-to-one sessions and other work have their own terms."

# Latest discussed retreat split: 30% NOSTOPS platform fee / 70% teacher. Applied ONLY where it is
# approved (approval == APPROVED), and then only as a for-review split of the amount the main backend
# reports. No approved retreat-specific rule exists today, so it is not applied, and no 15% / 0%
# default is ever substituted.
RETREAT_PLATFORM_FEE = {"approval": UNCONFIRMED, "nostops_bp": 3_000, "teacher_bp": 7_000}

# 1:1 display split (audit.py: "product decision, confirmed"). The main backend does the real split.
ONE_ON_ONE_DISPLAY_SPLIT = {"approval": EXISTING_DISPLAY_RULE, "teacher_bp": 8_500, "platform_bp": 1_500}

# Public retreat group ladder (lib/pricing.ts DEFAULT_GROUP_TIERS). Prompt 3C founder decision: UNAPPROVED
# reference tiers, shown only with UNAPPROVED_BANNER. No discounted total, saving or payable price is ever
# worked out from them; a retreat-specific discount needs an authoritative, verified rule for that retreat.
PUBLIC_RETREAT_GROUP_LADDER = {"approval": UNAPPROVED, "reference_only": True, "banner": UNAPPROVED_BANNER,
                               "min_group": 5,
                               "tiers": ({"min_seats": 5, "pct_bp": 500}, {"min_seats": 10, "pct_bp": 1_000},
                                         {"min_seats": 20, "pct_bp": 1_500})}

# Prompt 3C (founder option B): early-bird, limited-time and teacher-cohort offers a host writes in a
# retreat's description are UNVERIFIED. The website shows only the listed price (the main backend's
# price_per_seat_inr): these offers are never shown, applied or turned into a saving.
RETREAT_HOST_OFFERS = {"approval": UNVERIFIED, "shown": False,
                       "offers": ("early_bird", "limited_time", "teacher_cohort"),
                       "displayed_price": "listed price only (main backend price_per_seat_inr)"}

PLANNING_ASSUMPTIONS = (
    {"id": "org_baseline_5000", "status": "PLANNING_ASSUMPTION",
     "text": "A ₹5,000-per-participant organisation baseline with a volume discount ladder was discussed. "
             "No authoritative approval was found in this workspace, so it is never a confirmed quote. "
             "It is shown only as an UNAPPROVED indicative reference (product org_group_booking_legacy)."},
)

UNRESOLVED = (
    "Which organisation discount ladder, if any, is approved (the rate-card 15–28 / 29–40 discounts are suspended "
    "in Prompt 3C; the legacy 18/29/40 batch ladder is unchanged).",
    "Tax treatment for organisation programmes, event fees, 1:1 sessions, retreats and Fast-Track.",
    "Whether the main backend charges host-listed early-bird / limited-time retreat offers (the website no longer "
    "shows them, Prompt 3C).",
    "Whether each retreat's group quote follows the public 5% / 10% / 15% ladder.",
    "An approved retreat-specific rule confirming the 30% NOSTOPS / 70% teacher split.",
    "Which revenue base each institutional contract defines for the 70 / 80 / 85% split.",
    "Which InstaKYC source governs: the website ₹279 or the main backend's /kyc/pricing.",
    "Whether US$30 venue AI onboarding is approved for sale once international checkout exists, and its tax treatment.",
    "Event fee maximum: the wizard allows ₹1,00,000, the backend ₹10,00,000.",
    "1:1 rate bounds: the BFF routes and the main backend's tier rules disagree.",
    "Whether the ₹5,000 organisation baseline and the legacy 18/29/40 ladder are approved, which billing period "
    "the ₹5,000 covers, and whether that ladder is the one meant to go with it.",
)
