import asyncio, json, os
from emergentintegrations.llm.chat import LlmChat, UserMessage

KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# English source strings for the core UI (nav, header, search, common).
EN = {
    "tagline": "A Teachers-First Yoga Cooperative.",
    "Signed in as": "Signed in as",
    "Sign out": "Sign out",
    "Search": "Search",
    "Notifications": "Notifications",
    "Language": "Language",
    "Locked": "Locked",
    "Soon": "Soon",
    "searchPlaceholder": "Search teachers & pages…",
    "No results found": "No results found",
    "Pages": "Pages",
    "Teachers": "Teachers",
    "Gurus": "Gurus",
    "Overview": "Overview",
    "My Profile": "My Profile",
    "My profile": "My profile",
    "Offerings": "Offerings",
    "Bookings": "Bookings",
    "Wallet": "Wallet",
    "Refer & Earn": "Refer & Earn",
    "Empanelment": "Empanelment",
    "City Coordinator": "City Coordinator",
    "Discover Teachers": "Discover Teachers",
    "Saved": "Saved",
    "My Bookings": "My Bookings",
    "Sessions": "Sessions",
    "Wellness": "Wellness",
    "Referrals": "Referrals",
    "New Batch": "New Batch",
    "ROI Calculator": "ROI Calculator",
    "Analytics": "Analytics",
    "Billing": "Billing",
    "Interview Queue": "Interview Queue",
    "Vouch Lineage": "Vouch Lineage",
    "My Contribution": "My Contribution",
    "Editorial Picks": "Editorial Picks",
    "Mentees": "Mentees",
    "Retreats": "Retreats",
    "Role & Rewards": "Role & Rewards",
    "Milestones": "Milestones",
    "KYC": "KYC",
    "Payouts": "Payouts",
    "People": "People",
}

LANGS = {
    "hi": "Hindi (Devanagari script)",
    "mr": "Marathi (Devanagari script)",
    "bn": "Bengali (Bangla script)",
    "ta": "Tamil script",
    "te": "Telugu script",
}

async def one(code, name):
    chat = LlmChat(
        api_key=KEY,
        session_id=f"t-{code}",
        system_message=(
            "You are a professional UI localizer for an Indian yoga-teacher cooperative app. "
            "Translate concise UI labels naturally and idiomatically. Keep them short (UI space is tight). "
            "Keep well-known acronyms like KYC, ROI as-is if that's how they're commonly used. "
            "Return ONLY strict minified JSON: an object mapping each English key to its translation. No commentary."
        ),
    ).with_model("openai", "gpt-4o")
    payload = json.dumps(EN, ensure_ascii=False)
    msg = UserMessage(text=f"Target language: {name}.\nTranslate the VALUES of this JSON (keep the KEYS identical):\n{payload}")
    resp = await chat.send_message(msg)
    txt = resp.strip()
    if txt.startswith("```"):
        txt = txt.strip("`")
        if txt.lower().startswith("json"):
            txt = txt[4:]
    start = txt.find("{"); end = txt.rfind("}")
    return json.loads(txt[start:end+1])

async def main():
    out = {"en": EN}
    for code, name in LANGS.items():
        try:
            out[code] = await one(code, name)
            print(f"[ok] {code}: {len(out[code])} keys", flush=True)
        except Exception as e:
            print(f"[FAIL] {code}: {e}", flush=True)
            out[code] = {}
    with open("/app/scripts/translations.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("WROTE /app/scripts/translations.json", flush=True)

asyncio.run(main())
