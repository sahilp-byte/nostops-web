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
OUT = '/app/frontend/public/brand/home'
STYLE = (
    'Photorealistic editorial lifestyle photograph, natural warm golden-hour light, soft haze, '
    'Indian people and Indian landscape, calm and dignified mood, shallow depth of field, '
    'no text, no words, no logos, no watermark, no borders.'
)

JOBS = {
    'hero': (
        'Ultra-wide panoramic landscape composition (21:9). Sunrise over misty green hills in India. '
        'In the right half of the frame: a young Indian woman in a cream t-shirt sits cross-legged on a grassy '
        'hilltop meditating, seen from behind three-quarter, hair in a bun. Behind her, a group of about twelve '
        'Indian men and women sit cross-legged on yoga mats on the grass, meditating, facing the sun. '
        'The LEFT 45% of the frame is soft, bright, hazy sky and distant hills with very little detail '
        '(clean space for headline text). Golden sun low on the horizon, warm orange and peach tones.',
        (1600, 686),
    ),
    'teacher': (
        'Square-ish composition (4:3). A warm, smiling young Indian woman yoga teacher, long dark hair, '
        'wearing a simple white top, hands joined in namaste at her chest, looking at the camera. Outdoors at '
        'sunset with soft-focus mountains and orange sky behind her. Subject placed in the centre-left, '
        'friendly and confident.',
        (1200, 900),
    ),
    'retreat': (
        'Wide panoramic composition (3:1). An open-air wooden yoga pavilion with a sloping tiled roof on a '
        'lush green lawn at a retreat venue in India, surrounded by tall coconut palms and tropical plants, '
        'gentle hills in the background, warm sunset sky. No people.',
        (1500, 500),
    ),
    'closing': (
        'Ultra-wide panoramic composition (4:1). Sunset over layered hills in India. On the far LEFT, a lone '
        'person sits cross-legged meditating on a rock, small in the frame. The centre and right of the frame '
        'are open glowing orange and peach sky over distant hills (clean space for text). Warm, peaceful.',
        (1800, 450),
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
