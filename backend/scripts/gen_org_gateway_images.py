"""One-off: generate the For-Organisations gateway marketing images via Gemini
(Nano Banana) and save them as static PNGs under the Next.js public dir.

Run: python3 scripts/gen_org_gateway_images.py
Idempotent — re-running overwrites. Not a runtime feature.
"""
import asyncio
import base64
import os
import sys

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()
API_KEY = os.getenv("EMERGENT_LLM_KEY")
OUT = "/app/frontend/public/brand/org"
MODEL = "gemini-3.1-flash-image-preview"

STYLE = (
    "Authentic, premium documentary editorial photograph set in India. Warm natural "
    "light, soft golden tones, calm and uplifting mood, shallow depth of field, "
    "realistic, high-end corporate brochure quality. People shown mid-distance or from "
    "behind in serene seated yoga / meditation posture (eyes closed, hands in lap), "
    "faces not in sharp close-up. Modern, credible institutional interior with plants "
    "and large windows. NOT a gym, NOT a spa, no logos, no text, no watermark."
)

JOBS = {
    "hero": (
        "Wide cinematic 16:9 landscape. A diverse group of professional Indian adults in "
        "smart business-casual attire seated in neat rows doing a guided group meditation "
        "inside a bright, airy modern Indian office atrium with greenery and tall windows. "
        + STYLE
    ),
    "companies": (
        "Landscape 16:10. A small group of Indian corporate employees in business-casual "
        "attire doing a calm seated breathing session together in a sunlit modern office "
        "with plants. " + STYLE
    ),
    "education": (
        "Landscape 16:10. Indian college students together with a couple of faculty members "
        "doing a serene group yoga/meditation session in a bright campus hall with large "
        "windows and wooden floor. " + STYLE
    ),
    "startup": (
        "Landscape 16:10. A few young Indian startup founders and team members in a modern "
        "co-working space doing a short calm group stretch and breathing session, exposed "
        "brick and plants, laptops set aside. " + STYLE
    ),
}


async def gen(name: str, prompt: str) -> bool:
    chat = LlmChat(api_key=API_KEY, session_id=f"org-gateway-{name}", system_message="You are an expert editorial photographer.")
    chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if not images:
        print(f"[{name}] NO IMAGE returned")
        return False
    data = base64.b64decode(images[0]["data"])
    path = os.path.join(OUT, f"{name}.png")
    with open(path, "wb") as f:
        f.write(data)
    print(f"[{name}] saved {len(data)} bytes -> {path} ({images[0]['mime_type']})")
    return True


async def main():
    only = sys.argv[1:] or list(JOBS.keys())
    ok = 0
    for name in only:
        try:
            if await gen(name, JOBS[name]):
                ok += 1
        except Exception as e:
            print(f"[{name}] ERROR: {e}")
    print(f"DONE {ok}/{len(only)}")


if __name__ == "__main__":
    asyncio.run(main())
