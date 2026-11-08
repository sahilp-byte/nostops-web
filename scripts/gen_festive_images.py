"""One-off: generate the static homepage photographs (saved to frontend/public/brand/home).

Run: cd /app/backend && python /app/scripts/gen_home_images.py [name ...]
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
OUT = '/app/frontend/public/brand/festive'
STYLE = (
    'Photorealistic editorial lifestyle photograph, natural warm golden-hour light, soft haze, '
    'Indian landscape, calm and dignified mood, shallow depth of field, '
    'no text, no words, no logos, no watermark, no borders.'
)

JOBS = {
    'festive-hero': (
        'Wide festive Indian scene (16:9), NO people. A yoga mat with a brass singing bowl on a cream marigold-decorated '
        'floor, glowing clay diyas, pink lotus flowers in a brass urli, marigold garlands, soft warm golden light, '
        'cream and saffron palette with soft teal accents. Left half calm and softly blurred (space for text).',
        (1600, 900),
    ),
    'festive-og-bg': (
        'Wide festive background (1.9:1), NO people, NO text. Cream and ivory backdrop, glowing clay diyas and pink lotus '
        'flowers and marigold garlands along the right and bottom edges, a soft saffron glow, subtle mandala line art. '
        'Large clean cream area on the left.',
        (1200, 630),
    ),
}


async def gen(name: str) -> None:
    prompt, size = JOBS[name]
    chat = LlmChat(api_key=os.getenv('EMERGENT_LLM_KEY'), session_id=f'home-{name}-{uuid.uuid4().hex[:8]}',
                   system_message='You are an expert photographer creating images.')
    chat.with_model('gemini', 'gemini-3.1-flash-image-preview').with_params(modalities=['image', 'text'])
    _, images = await chat.send_message_multimodal_response(UserMessage(text=f'{prompt} {STYLE}'))
    if not images:
        print(name, 'NO IMAGE')
        return
    im = Image.open(io.BytesIO(base64.b64decode(images[0]['data']))).convert('RGB')
    print(name, 'raw', im.size)
    # centre-crop to the target ratio, then resize
    tw, th = size
    r = tw / th
    w, h = im.size
    if w / h > r:
        nw = int(h * r)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / r)
        top = (h - nh) // 2
        im = im.crop((0, top, w, top + nh))
    if im.size[0] > tw:
        im = im.resize((tw, th), Image.LANCZOS)
    path = f'{OUT}/{name}.jpg'
    im.save(path, 'JPEG', quality=82, optimize=True, progressive=True)
    print(name, 'saved', im.size, os.path.getsize(path) // 1024, 'KB')


async def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(JOBS)
    await asyncio.gather(*(gen(n) for n in names), return_exceptions=False)


if __name__ == '__main__':
    asyncio.run(main())
