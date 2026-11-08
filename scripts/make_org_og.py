from PIL import Image
import os

SRC = "/app/frontend/public/brand/org/hero.jpg"
OUT = "/app/frontend/public/brand/org/hero-og.jpg"
TW, TH = 1200, 630

im = Image.open(SRC).convert("RGB")
w, h = im.size
target = TW / TH
cur = w / h
if cur > target:
    # too wide -> crop width
    nw = int(h * target)
    x = (w - nw) // 2
    im = im.crop((x, 0, x + nw, h))
else:
    # too tall -> crop height
    nh = int(w / target)
    y = (h - nh) // 2
    im = im.crop((0, y, w, y + nh))

im = im.resize((TW, TH), Image.LANCZOS)
im.save(OUT, "JPEG", quality=82, optimize=True, progressive=True)
print("wrote", OUT, im.size, str(round(os.path.getsize(OUT) / 1024)) + "KB")
