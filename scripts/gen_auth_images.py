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
OUT = '/app/frontend/public/brand/auth'
STYLE = (
    'Photorealistic editorial lifestyle photograph, natural warm golden-hour light, soft haze, '
    'Indian landscape, calm and dignified mood, shallow depth of field, '
    'no text, no words, no logos, no watermark, no borders.'
)

JOBS = {
    'signup-hero': (
        'Ultra-wide serene landscape (3:1), NO people, NO humans, NO figures at all. Soft sunrise over misty green '
        'hills and a calm lake in India, a few pink lotus flowers in the foreground water on the right, gentle '
        'botanical leaves at the edges. Centre of the frame is bright, soft cream-peach haze (clean space for a '
        'centered headline). Warm saffron, cream and soft teal tones.',
        (1800, 600),
    ),
    'login-hero': (
        'Wide calm landscape (2:1), NO people, NO humans, NO figures. Golden sunrise over layered misty mountains '
        'and palm trees in India, warm orange sun on the horizon at right, soft cream sky, a few lotus buds in '
        'still water in the foreground. Left half very soft and bright with little detail.',
        (1800, 900),
    ),
    'coordinator': (
        'Landscape (4:3), NO people. An Indian city skyline at golden hour seen across a calm river with a bridge, '
        'warm orange and soft teal sky.',
        (1200, 900),
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
