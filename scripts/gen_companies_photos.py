"""One-off: generate the three pathway-card photos for /for-organisations/companies.

Generic, photorealistic workplace-yoga scenes (no real people, companies, logos or
text). Output: frontend/public/brand/org/companies-{mind,body,special-needs}.jpg
Usage: cd /app/backend && python /app/scripts/gen_companies_photos.py
"""
import asyncio
import base64
import io
import os
import sys
import uuid

from dotenv import load_dotenv
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv('/app/backend/.env')
OUT = '/app/frontend/public/brand/org'
STYLE = (
    'Photorealistic editorial photograph, landscape 4:3, bright modern Indian corporate office with large windows, '
    'indoor plants and warm natural daylight, calm premium mood, soft depth of field. Indian adults in smart-casual '
    'office clothes. No text, no logos, no brand names, no watermarks, no signage.'
)
SHOTS = {
    'mind': 'Two or three colleagues sitting cross-legged on yoga mats with eyes closed, hands resting on knees, '
            'doing a calm breathing and focus practice; a gentle teacher guiding from the side.',
    'body': 'Four colleagues on yoga mats holding Warrior II pose together in an open office space with a city view; '
            'balanced, energetic and well-aligned posture.',
    'special-needs': 'Inclusive chair yoga: colleagues seated on office chairs doing gentle seated stretches and '
                     'palms-together breathing; one participant uses a wheelchair; relaxed, welcoming and accessible.',
}


async def gen(key: str, prompt: str) -> None:
    chat = LlmChat(api_key=os.environ['EMERGENT_LLM_KEY'], session_id=f'companies-{key}-{uuid.uuid4().hex[:8]}',
                   system_message='You create photorealistic stock photography.')
    chat.with_model('gemini', 'gemini-3.1-flash-image-preview').with_params(modalities=['image', 'text'])
    _text, images = await chat.send_message_multimodal_response(UserMessage(text=f'{prompt} {STYLE}'))
    if not images:
        print(key, 'NO IMAGE')
        return
    im = Image.open(io.BytesIO(base64.b64decode(images[0]['data']))).convert('RGB')
    w, h = im.size
    # centre-crop to 4:3, then resize to 960×720
    tw = min(w, int(h * 4 / 3)); th = int(tw * 3 / 4)
    im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th)).resize((960, 720), Image.LANCZOS)
    path = f'{OUT}/companies-{key}.jpg'
    im.save(path, 'JPEG', quality=82, optimize=True, progressive=True)
    print(key, 'saved', path, im.size, os.path.getsize(path))


async def main(keys):
    await asyncio.gather(*(gen(k, SHOTS[k]) for k in keys))


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or list(SHOTS)))
