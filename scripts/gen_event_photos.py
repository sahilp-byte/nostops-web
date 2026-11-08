"""One-off: generate the event-page photos (founder-approved event page redesign).

Generic, photorealistic, illustrative scenes (no real people, institutions, logos or text).
Output: frontend/public/brand/events/{founders-hero,cta-mat}.jpg (1600x900)
Usage: cd /app/backend && python /app/scripts/gen_event_photos.py
"""
import asyncio
import base64
import io
import os
import uuid

from dotenv import load_dotenv
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv('/app/backend/.env')
OUT = '/app/frontend/public/brand/events'
COMMON = 'No text, no lettering, no posters with writing, no logos, no brand names, no watermarks.'
SHOTS = {
    'founders-hero': (
        'Photorealistic editorial photograph, wide 16:9 landscape. A calm, warm, naturally lit yoga studio with large '
        'windows, light wooden floor and many green potted plants. On the left, an Indian woman yoga teacher in a white '
        't-shirt sits on a mat, seen in three-quarter view from behind, gently guiding with one open hand. Facing her, a '
        'small group of five Indian adult startup founders (men and women, late 20s to 40s, smart-casual clothes) sit '
        'cross-legged on yoga mats with eyes closed and hands resting on their knees in a calm breathing practice. Soft '
        'golden morning light, shallow depth of field, premium, serene mood. ' + COMMON
    ),
    'cta-mat': (
        'Photorealistic photograph, wide 16:9 landscape. A rolled dark grey yoga mat lying on a weathered wooden deck at '
        'sunrise, warm golden light, softly blurred tropical plants in the foreground corner and hazy distant hills. The '
        'mat sits in the left-centre of the frame with plenty of soft, calm empty space on the right. Peaceful, minimal. '
        'No people. ' + COMMON
    ),
}


async def gen(key: str) -> None:
    chat = LlmChat(api_key=os.environ['EMERGENT_LLM_KEY'], session_id=f'event-{key}-{uuid.uuid4().hex[:8]}',
                   system_message='You create photorealistic stock photography.')
    chat.with_model('gemini', 'gemini-3.1-flash-image-preview').with_params(modalities=['image', 'text'])
    _text, images = await chat.send_message_multimodal_response(UserMessage(text=SHOTS[key]))
    if not images:
        print(key, 'NO IMAGE')
        return
    im = Image.open(io.BytesIO(base64.b64decode(images[0]['data']))).convert('RGB')
    w, h = im.size
    # centre-crop to 16:9, then resize to 1600×900
    tw = min(w, int(h * 16 / 9)); th = int(tw * 9 / 16)
    im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th)).resize((1600, 900), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    path = f'{OUT}/{key}.jpg'
    im.save(path, 'JPEG', quality=80, optimize=True, progressive=True)
    print(key, 'saved', path, (w, h), os.path.getsize(path))


async def main():
    await asyncio.gather(*(gen(k) for k in SHOTS))


if __name__ == '__main__':
    asyncio.run(main())
