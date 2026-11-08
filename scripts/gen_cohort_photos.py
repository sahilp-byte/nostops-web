"""One-off: generate the three pathway-card photos for the schools and startup cohort pages
(the companies set came from gen_companies_photos.py).

Generic, photorealistic yoga scenes (no real people, institutions, logos or text).
Output: frontend/public/brand/org/{schools,startups}-{mind,body,special-needs}.jpg
Usage: cd /app/backend && python /app/scripts/gen_cohort_photos.py [schools|startups ...]
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
COMMON = 'No text, no logos, no brand names, no watermarks, no signage, no screens with readable content.'
SETS = {
    'schools': {
        'style': (
            'Photorealistic editorial photograph, landscape 4:3, bright Indian college campus interior with large windows, '
            'warm natural daylight, calm premium mood, soft depth of field. Indian students aged 18-22 in casual college '
            'clothes and a few faculty members. ' + COMMON
        ),
        'shots': {
            'mind': 'Four or five college students sitting cross-legged on yoga mats in a sunlit multipurpose hall, eyes '
                    'closed, hands resting on knees, doing a calm breathing and focus practice; a teacher guiding quietly.',
            'body': 'College students on yoga mats in a campus studio doing a tall seated spinal stretch and gentle '
                    'shoulder-opening posture work together, upright and well aligned; books and backpacks near the wall.',
            'special-needs': 'A small, calm group of students in a quiet, softly lit campus room seated on cushions and '
                             'chairs doing slow, predictable breathing with eyes softly closed; one student uses a '
                             'wheelchair; blankets and cushions, low-stimulation, gentle and welcoming.',
        },
    },
    'startups': {
        'style': (
            'Photorealistic editorial photograph, landscape 4:3, modern Indian co-working space with exposed brick, '
            'plants and large windows, warm natural daylight, calm premium mood, soft depth of field. Indian founders and '
            'young professionals in smart-casual clothes. ' + COMMON
        ),
        'shots': {
            'mind': 'Five founders sitting in a loose circle on yoga mats in a co-working event space, eyes closed, hands '
                    'on the heart and belly, doing a reflective breathing practice; laptops closed and set aside.',
            'body': 'Young professionals on yoga mats in an open co-working space holding a strong low lunge with arms '
                    'raised, energetic and well aligned; desks and plants in the background.',
            'special-needs': 'Gentle, supported yoga in a community venue: members seated on chairs and using yoga blocks '
                             'for a slow seated stretch; one older participant has a walking cane beside the chair; '
                             'relaxed, inclusive and accessible.',
        },
    },
}


async def gen(cohort: str, key: str) -> None:
    s = SETS[cohort]
    chat = LlmChat(api_key=os.environ['EMERGENT_LLM_KEY'], session_id=f'{cohort}-{key}-{uuid.uuid4().hex[:8]}',
                   system_message='You create photorealistic stock photography.')
    chat.with_model('gemini', 'gemini-3.1-flash-image-preview').with_params(modalities=['image', 'text'])
    _text, images = await chat.send_message_multimodal_response(UserMessage(text=f"{s['shots'][key]} {s['style']}"))
    if not images:
        print(cohort, key, 'NO IMAGE')
        return
    im = Image.open(io.BytesIO(base64.b64decode(images[0]['data']))).convert('RGB')
    w, h = im.size
    # centre-crop to 4:3, then resize to 960×720
    tw = min(w, int(h * 4 / 3)); th = int(tw * 3 / 4)
    im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th)).resize((960, 720), Image.LANCZOS)
    path = f'{OUT}/{cohort}-{key}.jpg'
    im.save(path, 'JPEG', quality=82, optimize=True, progressive=True)
    print(cohort, key, 'saved', path, im.size, os.path.getsize(path))


async def main(cohorts):
    await asyncio.gather(*(gen(c, k) for c in cohorts for k in SETS[c]['shots']))


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or list(SETS)))
