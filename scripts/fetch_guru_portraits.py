"""
One-off: fetch freely-licensed guru portraits from Wikimedia Commons, store them
in Emergent Object Storage (under nostops/retreats/_gurus/{slug}.jpg — served
publicly by the existing /bff/media/retreats/** proxy), and stamp the portrait
url + attribution onto the local kg_gurus records.

Only images hosted on upload.wikimedia.org (i.e. freely licensed on Commons) with
a readable license are accepted; anything non-free / fair-use is skipped so the
guru page keeps its branded monogram fallback. Idempotent: re-running refreshes.
"""
import io
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "nostops_web")
EMERGENT_KEY = os.environ["EMERGENT_LLM_KEY"]
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "https://integrations.emergentagent.com").rstrip("/")
STORAGE_URL = STORAGE_BASE + "/objstore/api/v1/storage"

UA = {"User-Agent": "NOSTOPS/1.0 (yoga knowledge graph; contact tech@nostops.org)"}

# guru slug -> Wikipedia article title (well-known figures with Commons portraits)
GURUS = {
    "bks-iyengar": "B. K. S. Iyengar",
    "pattabhi-jois": "K. Pattabhi Jois",
    "krishnamacharya": "Tirumalai Krishnamacharya",
    "desikachar": "T. K. V. Desikachar",
    "sivananda": "Sivananda Saraswati",
    "vishnudevananda": "Vishnudevananda Saraswati",
    "satchidananda": "Satchidananda Saraswati",
    "satyananda": "Satyananda Saraswati",
    "yogananda": "Paramahansa Yogananda",
    "sri-yukteswar": "Sri Yukteswar Giri",
    "lahiri-mahasaya": "Lahiri Mahasaya",
    "vivekananda": "Swami Vivekananda",
    "ramakrishna": "Ramakrishna",
    "aurobindo": "Sri Aurobindo",
    "ramana": "Ramana Maharshi",
    "sadhguru": "Jaggi Vasudev",
    "sri-sri": "Ravi Shankar (spiritual leader)",
    "maharishi-mahesh": "Maharishi Mahesh Yogi",
    "goenka": "S. N. Goenka",
    "yogi-bhajan": "Harbhajan Singh Khalsa",
    "swami-rama": "Swami Rama",
    "chinmayananda": "Chinmayananda Saraswati",
    "dayananda-saraswati": "Dayananda Saraswati (Arsha Vidya)",
    "anandamurti": "Prabhat Ranjan Sarkar",
    "kuvalayananda": "Swami Kuvalayananda",
    "yogendra": "Yogendra (yogi)",
}


def clean_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()


def wiki_image(title: str):
    """Return (image_url, {artist, license, license_url, credit}) or (None, None)."""
    api = "https://en.wikipedia.org/w/api.php"
    r = requests.get(api, params={
        "action": "query", "format": "json", "redirects": 1, "titles": title,
        "prop": "pageimages", "piprop": "original",
    }, headers=UA, timeout=20)
    r.raise_for_status()
    pages = r.json().get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    original = page.get("original", {})
    url = original.get("source")
    if not url or "upload.wikimedia.org" not in url:
        return None, None
    # Resolve the File: page for this original to read license extmetadata.
    fname = url.split("/")[-1].split("?")[0]
    r2 = requests.get(api, params={
        "action": "query", "format": "json", "titles": f"File:{fname}",
        "prop": "imageinfo", "iiprop": "extmetadata|url", "iiextmetadatalanguage": "en",
    }, headers=UA, timeout=20)
    r2.raise_for_status()
    p2 = next(iter(r2.json().get("query", {}).get("pages", {}).values()), {})
    ii = (p2.get("imageinfo") or [{}])[0]
    ext = ii.get("extmetadata", {}) or {}
    lic = clean_html(ext.get("LicenseShortName", {}).get("value", ""))
    if lic and re.search(r"fair|non[- ]?free|copyright", lic, re.I) and "cc" not in lic.lower() and "public" not in lic.lower():
        return None, None  # not freely licensed
    meta = {
        "artist": clean_html(ext.get("Artist", {}).get("value", "")) or None,
        "license": lic or "Wikimedia Commons",
        "license_url": clean_html(ext.get("LicenseUrl", {}).get("value", "")) or None,
        "credit": clean_html(ext.get("Credit", {}).get("value", "")) or None,
        "source_url": ii.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/File:{fname}",
    }
    return url, meta


_storage_key = None


def storage_init():
    global _storage_key
    res = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    res.raise_for_status()
    _storage_key = res.json()["storage_key"]
    return _storage_key


def storage_put(path: str, data: bytes, content_type: str):
    key = _storage_key or storage_init()
    res = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=60)
    if res.status_code == 503:
        key = storage_init()
        res = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=60)
    res.raise_for_status()
    return res.json()


def main():
    db = MongoClient(MONGO_URL)[DB_NAME]
    storage_init()
    ok, skipped, missing = [], [], []
    for slug, title in GURUS.items():
        gid = f"g-{slug}"
        if not db.kg_gurus.find_one({"id": gid}):
            missing.append(slug)
            continue
        try:
            url, meta = wiki_image(title)
        except Exception as e:
            print(f"  ! {slug}: wiki error {e}")
            skipped.append(slug)
            continue
        if not url:
            print(f"  - {slug}: no free image")
            skipped.append(slug)
            continue
        try:
            img = requests.get(url, headers=UA, timeout=60)
            img.raise_for_status()
            ct = img.headers.get("Content-Type", "image/jpeg").split(";")[0]
            ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(ct, "jpg")
            rel = f"retreats/_gurus/{slug}.{ext}"
            storage_put(f"nostops/{rel}", img.content, ct)
            portrait_url = f"/bff/media/{rel}"
            db.kg_gurus.update_one({"id": gid}, {"$set": {
                "portrait_url": portrait_url,
                "portrait_credit": meta.get("artist") or meta.get("credit"),
                "portrait_license": meta.get("license"),
                "portrait_license_url": meta.get("license_url"),
                "portrait_source_url": meta.get("source_url"),
                "portrait_source": "Wikimedia Commons",
            }})
            print(f"  + {slug}: stored {rel} ({len(img.content)//1024}KB) · {meta.get('license')}")
            ok.append(slug)
        except Exception as e:
            print(f"  ! {slug}: store error {e}")
            skipped.append(slug)
        time.sleep(0.4)
    print(f"\nDONE: {len(ok)} stored, {len(skipped)} skipped, {len(missing)} missing records")
    print("stored:", ", ".join(ok))
    if skipped:
        print("skipped:", ", ".join(skipped))


if __name__ == "__main__":
    main()
