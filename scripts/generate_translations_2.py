import asyncio, json, os
from emergentintegrations.llm.chat import LlmChat, UserMessage

KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# New strings for the teacher ONBOARDING + PROFILE screens (key == English text).
EN2 = {
    # onboarding page
    "‹ Back": "‹ Back",
    "Join NOSTOPS as a teacher": "Join NOSTOPS as a teacher",
    "A teachers-first cooperative built with yoga teachers, not on top of them. Set up your lineage, specialisations and public profile — then complete InstaKYC to start earning.": "A teachers-first cooperative built with yoga teachers, not on top of them. Set up your lineage, specialisations and public profile — then complete InstaKYC to start earning.",
    # wizard steps
    "Basics": "Basics", "Lineage": "Lineage", "Specs": "Specs", "Review": "Review",
    "The basics": "The basics",
    "Full name *": "Full name *", "City *": "City *", "Country": "Country",
    "Years of experience": "Years of experience", "Phone": "Phone",
    "Languages you teach in": "Languages you teach in",
    "Your lineage & styles": "Your lineage & styles",
    "Parampara (lineage) *": "Parampara (lineage) *",
    "· pick all you belong to": "· pick all you belong to",
    "Styles you teach": "Styles you teach",
    "Yoga dimensions *": "Yoga dimensions *",
    "Seekers use these in SmartMatch — pick any that apply.": "Seekers use these in SmartMatch — pick any that apply.",
    "Specialisations *": "Specialisations *",
    "Your story": "Your story",
    "AI bio helper": "AI bio helper",
    "Warm": "Warm", "Professional": "Professional", "Humble": "Humble",
    "Drafting…": "Drafting…", "Redraft": "Redraft", "Draft with AI": "Draft with AI",
    "Pick a lineage in Step 2 first — the AI uses it to write your bio.": "Pick a lineage in Step 2 first — the AI uses it to write your bio.",
    "Could not draft a bio. Please write your own.": "Could not draft a bio. Please write your own.",
    "Bio *": "Bio *", "· min 30 characters": "· min 30 characters", "chars": "chars",
    "Sample video URL": "Sample video URL", "· optional": "· optional",
    "Public profile handle *": "Public profile handle *",
    "Checking…": "Checking…",
    "Use 3+ letters, numbers or hyphens.": "Use 3+ letters, numbers or hyphens.",
    "Available ✓": "Available ✓", "Taken — try another.": "Taken — try another.",
    "Review & publish": "Review & publish",
    "Name": "Name", "Experience": "Experience", "Dimensions": "Dimensions", "Handle": "Handle",
    "← Back": "← Back", "Continue →": "Continue →",
    "Publishing…": "Publishing…", "Publish my profile": "Publish my profile",
    "Your public profile is live": "Your public profile is live",
    "View my profile →": "View my profile →",
    "Next: complete InstaKYC to unlock payouts →": "Next: complete InstaKYC to unlock payouts →",
    "Go to my dashboard": "Go to my dashboard",
    # profile view
    "Your teacher profile": "Your teacher profile",
    "Edit profile": "Edit profile",
    "Photo & intro video": "Photo & intro video",
    "Update your headshot and 60–90s introduction": "Update your headshot and 60–90s introduction",
    "Manage →": "Manage →",
    "Verified": "Verified", "Empanelled": "Empanelled",
    "Bio": "Bio", "No bio added yet.": "No bio added yet.",
    "Parampara": "Parampara", "Not specified": "Not specified",
    "Yoga styles": "Yoga styles", "Specialisations": "Specialisations", "Languages": "Languages",
    "Not added yet.": "Not added yet.",
    "1:1 sessions": "1:1 sessions",
    "Available for booking": "Available for booking", "Currently disabled": "Currently disabled",
    "1:1 pricing not set. Add it from Edit profile.": "1:1 pricing not set. Add it from Edit profile.",
    "Social": "Social",
    # edit page + form
    "‹ Back to my profile": "‹ Back to my profile",
    "Keep your details current — this is what learners and organisations see.": "Keep your details current — this is what learners and organisations see.",
    "Manage photo & intro video →": "Manage photo & intro video →",
    "Basic information": "Basic information",
    "Full name": "Full name", "City": "City",
    "About you": "About you",
    "30–2000 characters. Describe your training, style and who you help.": "30–2000 characters. Describe your training, style and who you help.",
    "Parampara & lineage": "Parampara & lineage", "Your parampara": "Your parampara",
    "Pick up to 12.": "Pick up to 12.",
    "Languages spoken": "Languages spoken",
    "1:1 session pricing": "1:1 session pricing",
    "Rate per session (₹)": "Rate per session (₹)",
    "Available for 1:1 bookings": "Available for 1:1 bookings",
    "Your rate is validated against your tier limits when saved.": "Your rate is validated against your tier limits when saved.",
    "Social links": "Social links",
    "Review your changes, then save.": "Review your changes, then save.",
    "Saving…": "Saving…", "Save changes": "Save changes", "Saved successfully.": "Saved successfully.",
    "Please enter your name.": "Please enter your name.",
    # media page + strength + verification
    "Photo & video": "Photo & video",
    "Your photo and intro video are the first things learners and organisations see.": "Your photo and intro video are the first things learners and organisations see.",
    "Profile strength": "Profile strength",
    "Add a profile photo": "Add a profile photo", "Add an intro video": "Add an intro video",
    "Write your bio": "Write your bio", "Pick your styles & specialities": "Pick your styles & specialities",
    "List the languages you teach in": "List the languages you teach in",
    "Verify your identity (KYC)": "Verify your identity (KYC)",
    "Add": "Add", "Write": "Write", "Choose": "Choose", "Verify": "Verify",
    "Get verified": "Get verified", "Finish verification to unlock": "Finish verification to unlock",
    "Complete InstaKYC": "Complete InstaKYC",
    "Aadhaar OKYC · PAN · Bank verification": "Aadhaar OKYC · PAN · Bank verification",
    "Start InstaKYC": "Start InstaKYC",
    "One-time verification payment": "One-time verification payment",
    "₹799 (incl. GST) — part of InstaKYC": "₹799 (incl. GST) — part of InstaKYC",
    "Pay & verify": "Pay & verify",
    "Get empanelled": "Get empanelled",
    "Free-track (merit) or Fast-track Council review": "Free-track (merit) or Fast-track Council review",
    "View empanelment": "View empanelment", "Done": "Done",
    "What you'll unlock": "What you'll unlock",
    # media manager
    "Profile photo": "Profile photo",
    "A clear, friendly headshot helps learners recognise you. Square images look best.": "A clear, friendly headshot helps learners recognise you. Square images look best.",
    "Upload photo": "Upload photo", "Replace photo": "Replace photo", "Remove photo": "Remove photo",
    "Working…": "Working…",
    "Intro video": "Intro video",
    "Record a short 60–90 second introduction — your background, style, and who you love teaching.": "Record a short 60–90 second introduction — your background, style, and who you love teaching.",
    "Tips for a great intro": "Tips for a great intro",
    "Show a sample script": "Show a sample script", "Hide sample script": "Hide sample script",
    "Record with camera": "Record with camera",
    "Upload a file instead": "Upload a file instead", "Upload a file": "Upload a file",
    "Remove video": "Remove video",
    "Approved": "Approved", "Under review": "Under review", "Processing": "Processing",
    "Awaiting upload": "Awaiting upload", "Needs changes": "Needs changes", "Not added": "Not added",
    # cropper
    "Crop your photo": "Crop your photo",
    "Drag to reposition and use the slider to zoom.": "Drag to reposition and use the slider to zoom.",
    "Zoom": "Zoom", "Reset": "Reset", "Filter": "Filter",
    "Original": "Original", "Bright": "Bright", "Cool": "Cool",
    "Cancel": "Cancel", "Save photo": "Save photo",
    # recorder
    "Record your intro": "Record your intro",
    "Enable camera & mic": "Enable camera & mic",
    "Try again": "Try again", "Close": "Close",
    "Start recording": "Start recording", "Stop recording": "Stop recording",
    "Re-record": "Re-record", "Use this video": "Use this video",
    "Get ready…": "Get ready…", "Clip length:": "Clip length:",
}

LANGS = {"hi": "Hindi (Devanagari)", "mr": "Marathi (Devanagari)", "bn": "Bengali (Bangla script)", "ta": "Tamil script", "te": "Telugu script"}

async def one(name):
    chat = LlmChat(
        api_key=KEY, session_id=f"t2-{name}",
        system_message=("You are a professional UI localizer for an Indian yoga-teacher cooperative app. "
            "Translate short UI strings naturally and idiomatically; keep them concise. Keep acronyms KYC, AI, ROI, GST, URL, PAN, "
            "Aadhaar and brand words (NOSTOPS, Parampara, InstaKYC, SmartMatch, Instagram, YouTube, LinkedIn) as-is. Preserve leading "
            "symbols/emoji and punctuation like ·, →, ←, ✓, ₹, *, …, (), and the tags. Return ONLY strict minified JSON mapping each "
            "English key to its translation. No commentary."),
    ).with_model("openai", "gpt-4o")
    payload = json.dumps(EN2, ensure_ascii=False)
    resp = await chat.send_message(UserMessage(text=f"Target language: {name}.\nTranslate the VALUES (keep KEYS identical):\n{payload}"))
    txt = resp.strip()
    if txt.startswith("```"):
        txt = txt.strip("`")
        if txt[:4].lower() == "json": txt = txt[4:]
    return json.loads(txt[txt.find("{"): txt.rfind("}") + 1])

async def main():
    data = json.load(open("/app/scripts/translations.json", encoding="utf-8"))
    data.setdefault("en", {}).update(EN2)
    for code, name in LANGS.items():
        try:
            tr = await one(name)
            data.setdefault(code, {}).update(tr)
            print(f"[ok] {code}: +{len(tr)} keys", flush=True)
        except Exception as e:
            print(f"[FAIL] {code}: {e}", flush=True)
    json.dump(data, open("/app/scripts/translations.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Rebuild messages.ts
    order = ["en", "hi", "mr", "bn", "ta", "te"]
    def esc(s): return s.replace("\\", "\\\\").replace("'", "\\'")
    out = ["// AUTO-GENERATED core-UI message catalog (see /app/scripts/generate_translations*.py).",
           "// English is the complete base; other locales fall back to English for any missing key.",
           "import type { Locale } from '@/lib/i18n/config';", "",
           "export const MESSAGES: Record<Locale, Record<string, string>> = {"]
    for code in order:
        out.append(f"  {code}: {{")
        for k in data["en"]:
            v = data.get(code, {}).get(k) or data["en"][k]
            out.append(f"    '{esc(k)}': '{esc(v)}',")
        out.append("  },")
    out.append("};"); out.append("")
    open("/app/frontend/lib/i18n/messages.ts", "w", encoding="utf-8").write("\n".join(out))
    print(f"WROTE messages.ts ({len(data['en'])} keys x {len(order)} locales)", flush=True)

asyncio.run(main())
