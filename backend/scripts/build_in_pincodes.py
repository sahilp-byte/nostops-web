"""Build backend/data/in_pincodes.csv.gz from the India Post all-India PIN directory (Phase 2, decision D5).

Source CSV columns: officename, pincode, officeType, Deliverystatus, divisionname, regionname, circlename,
Taluk, Districtname, statename, ...  (github.com/saravanakumargn/All-India-Pincode-Directory, from data.gov.in).

Usage:  python scripts/build_in_pincodes.py /path/to/all-india-pincode.csv
Then bump DATASET_VERSION in spaces_localities.py so the startup loader reloads the collection.
"""
import csv
import gzip
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "in_pincodes.csv.gz"
PIN_RE = re.compile(r"^[1-9][0-9]{5}$")
SUFFIX = re.compile(r"\s+(B\.?O\.?|S\.?O\.?|H\.?O\.?|G\.?P\.?O\.?|EDB\.?O\.?|EDSO|MDG|NSH|N\.?S\.?H\.?)(\s+directly a/w Head Office)?$",
                    re.I)
SMALL = {"and", "of", "the", "a/w"}
STATE_FIX = {"Chattisgarh": "Chhattisgarh", "Pondicherry": "Puducherry",
             # 2020 merger of the two UTs
             "Dadra and Nagar Haveli": "Dadra and Nagar Haveli and Daman and Diu",
             "Daman and Diu": "Dadra and Nagar Haveli and Daman and Diu"}
LADAKH_DISTRICTS = {"Leh", "Kargil"}  # Ladakh UT since 2019


def tidy(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip()).replace("&", "and")
    if not s or s.upper() == "NULL" or s.upper() == "NA":
        return ""
    words = []
    for i, w in enumerate(s.split(" ")):
        lw = w.lower()
        words.append(lw if (i and lw in SMALL) else (w[:1].upper() + w[1:].lower() if w.isupper() or w.islower() else w))
    return " ".join(words)


def office_type(raw: str) -> str:
    raw = (raw or "").upper()
    return "HO" if raw.startswith("H.O") else "SO" if raw.startswith("S.O") else "BO"


def main(src: str) -> None:
    rows, seen = [], set()
    with open(src, newline="", encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            pin = (r.get("pincode") or "").strip()
            if not PIN_RE.match(pin):
                continue
            office = re.sub(r"\s+", " ", (r.get("officename") or "").strip())
            locality = tidy(SUFFIX.sub("", office)) or tidy(office)
            state = tidy(r.get("statename"))
            state = STATE_FIX.get(state, state)
            district = tidy(r.get("Districtname"))
            if district in LADAKH_DISTRICTS:
                state = "Ladakh"
            key = (pin, re.sub(r"[^a-z0-9]+", "-", locality.lower()).strip("-")[:60])  # same key as the locality_id slug
            if not locality or not state or key in seen:
                continue
            seen.add(key)
            rows.append([pin, locality, office, office_type(r.get("officeType")),
                         "1" if (r.get("Deliverystatus") or "").strip().lower() == "delivery" else "0",
                         tidy(r.get("Taluk")), district, state])
    rows.sort(key=lambda x: (x[0], x[1]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", newline="", encoding="utf-8") as g:
        w = csv.writer(g)
        w.writerow(["pin", "locality", "office_name", "office_type", "delivery", "taluk", "district", "state"])
        w.writerows(rows)
    print(f"wrote {len(rows)} localities across {len({r[0] for r in rows})} PINs → {OUT}")


if __name__ == "__main__":
    main(sys.argv[1])
