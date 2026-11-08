# Paramparas SSR Verification Report

**Test Date:** 2026-08-28  
**Test Type:** Server-Side Rendering (SSR) Verification via curl (HTTP only, NO browser/UI automation)  
**Base URL:** http://localhost:3000  
**Test Script:** /app/paramparas_verification_test.py  

---

## Executive Summary

✅ **ALL 29 ASSERTIONS PASSED**

The paramparas pages (index + detail) are fully server-rendered with complete SEO metadata in the initial HTML. All canonical URLs use the www origin (https://www.nostops.org), zero bare-origin leaks, zero nostops.app references, and no backend host exposure in SEO output.

---

## TEST A — Index Page (/paramparas)

**URL:** http://localhost:3000/paramparas  
**Status:** ✅ 9/9 PASSED

### Assertions

1. ✅ **HTTP 200, Content-Type text/html**
   - Status: 200
   - Content-Type: text/html; charset=utf-8

2. ✅ **Title present (exact match)**
   - Expected: `Yoga Paramparas · Recognised Lineages · NOSTOPS`
   - Actual: `Yoga Paramparas · Recognised Lineages · NOSTOPS`

3. ✅ **Meta description present, non-empty**
   - Content: "The 8 classical yoga lineages recognised by the NOSTOPS Council of Yoga Gurus — Sivananda, Krishnamacharya..."

4. ✅ **Exactly ONE canonical link (exact match)**
   - Expected: `<link rel="canonical" href="https://www.nostops.org/paramparas"/>`
   - Actual: 1 link found with exact URL

5. ✅ **og:url exactly https://www.nostops.org/paramparas; og:type present**
   - og:url: `https://www.nostops.org/paramparas`
   - og:type: `website`

6. ✅ **twitter:card meta present**
   - twitter:card: `summary`

7. ✅ **JSON-LD: at least one script, valid JSON, includes @context "https://schema.org"**
   - Found: 3 JSON-LD scripts
   - All valid JSON: ✅
   - @context includes "https://schema.org": ✅
   - @types found:
     - CollectionPage
     - ItemList
     - BreadcrumbList

8. ✅ **All EIGHT recognised lineages present as crawlable relative anchor links**
   - Expected 8 lineages: ALL FOUND
     - /paramparas/sivananda ✅
     - /paramparas/krishnamacharya ✅
     - /paramparas/iyengar ✅
     - /paramparas/bihar-yoga ✅
     - /paramparas/ashtanga ✅
     - /paramparas/vipassana-yoga ✅
     - /paramparas/kaivalyadhama ✅
     - /paramparas/kaivalya ✅
   - Unique /paramparas/* links: **8** (as expected)

9. ✅ **ZERO bare origin, ZERO nostops.app, backend host NOT in canonical/OG/JSON-LD**
   - Bare origin (https://nostops.org): **0 occurrences**
   - nostops.app: **0 occurrences**
   - Backend host (pro-learn-connect-1.emergent.host) in canonical: ❌
   - Backend host in OG: ❌
   - Backend host in JSON-LD: ❌

---

## TEST B — Valid Detail Page (/paramparas/iyengar)

**URL:** http://localhost:3000/paramparas/iyengar  
**Status:** ✅ 9/9 PASSED

### Assertions

1. ✅ **HTTP 200**
   - Status: 200

2. ✅ **Title teacher/lineage-specific (contains "Iyengar Yoga Parampara")**
   - Actual: `Iyengar Yoga Parampara — Empanelled Teachers · NOSTOPS`

3. ✅ **Exactly ONE canonical: https://www.nostops.org/paramparas/iyengar; og:url identical**
   - Canonical: `['https://www.nostops.org/paramparas/iyengar']` (1 link)
   - og:url: `['https://www.nostops.org/paramparas/iyengar']` (identical)

4. ✅ **twitter:card present; meta description present**
   - twitter:card: `summary`
   - description: "B.K.S. Iyengar (1918–2014) codified the alignment-first approach at the Ramamani Iyengar Memorial Yo..."

5. ✅ **JSON-LD valid; includes EducationalOrganization and BreadcrumbList**
   - Valid JSON: ✅
   - Found @types: `{'BreadcrumbList', 'EducationalOrganization'}`
   - BreadcrumbList items: 3
     - Item 1 (Home): `https://www.nostops.org/`
     - Item 2 (Paramparas): `https://www.nostops.org/paramparas`
     - Item 3 (Iyengar): `https://www.nostops.org/paramparas/iyengar` ✅

6. ✅ **Visible lineage content present in raw HTML**
   - "B.K.S. Iyengar": ✅
   - "Pune": ✅
   - "Known for": ✅

7. ✅ **Teacher cross-links: eligible teachers as links, suspended NOT a link**
   - `/teachers/demo-user-india`: ✅ FOUND (eligible)
   - `/teachers/sarika-kakade-p`: ✅ FOUND (eligible)
   - `/teachers/yoga-shikshak-demo`: ✅ NOT FOUND (suspended, correctly excluded)
   - "Anjali Teacher" name in HTML: Present as plain text (acceptable)

8. ✅ **All NOSTOPS URLs use www: ZERO bare origin, ZERO nostops.app, no backend host**
   - Bare origin (https://nostops.org): **0 occurrences**
   - nostops.app: **0 occurrences**
   - Backend host in canonical: ❌
   - Backend host in OG: ❌
   - Backend host in JSON-LD: ❌

9. ✅ **Privacy: none of these appear anywhere in HTML**
   - @nostops.com: **0 occurrences** ✅
   - user_: **0 occurrences** ✅
   - tn_: **0 occurrences** ✅
   - payout: **0 occurrences** ✅
   - kyc: **0 occurrences** ✅
   - ifsc: **0 occurrences** ✅

---

## TEST C — Second Valid Slug (/paramparas/sivananda)

**URL:** http://localhost:3000/paramparas/sivananda  
**Status:** ✅ 4/4 PASSED

### Assertions

1. ✅ **HTTP 200**
   - Status: 200

2. ✅ **canonical = https://www.nostops.org/paramparas/sivananda**
   - Actual: `['https://www.nostops.org/paramparas/sivananda']`

3. ✅ **title contains "Sivananda"**
   - Actual: `Sivananda Yoga Parampara — Empanelled Teachers · NOSTOPS`

4. ✅ **JSON-LD present**
   - Found: 2 JSON-LD scripts

---

## TEST D — Invalid Slug (/paramparas/not-a-real-lineage-xyz)

**URL:** http://localhost:3000/paramparas/not-a-real-lineage-xyz  
**Status:** ✅ 2/2 PASSED

### Assertions

1. ✅ **HTTP 404**
   - Status: 404

2. ✅ **NO fabricated lineage content (no fake founder/seat), Next not-found behavior**
   - Next.js not-found behavior: ✅ Confirmed

---

## REGRESSION TESTS

**Status:** ✅ 5/5 PASSED

### Assertions

1. ✅ **GET /about -> 200**
   - Status: 200

2. ✅ **GET /teachers -> 200**
   - Status: 200

3. ✅ **GET /teachers/demo-user-india -> 200**
   - Status: 200

4. ✅ **GET /robots.txt contains `Sitemap: https://www.nostops.org/sitemap.xml`, no bare origin**
   - Status: 200
   - Sitemap line present: ✅
   - Bare origin count: **0**

5. ✅ **GET /sitemap.xml is XML, all <loc> use www, report <loc> count**
   - Status: 200
   - Is XML: ✅
   - <loc> count: **93** (expected 93)
   - All use www: ✅

---

## Key Findings

### ✅ SEO Metadata (Server-Rendered)
- All pages return HTTP 200 with text/html
- Titles are lineage-specific and present in initial HTML
- Meta descriptions are present and non-empty
- Canonical links are exactly ONE per page, using www origin
- Open Graph metadata (og:url, og:type, og:title) present and correct
- Twitter card metadata present

### ✅ JSON-LD Structured Data
- Index page: 3 JSON-LD blocks (CollectionPage, ItemList, BreadcrumbList)
- Detail pages: 2 JSON-LD blocks (EducationalOrganization, BreadcrumbList)
- All JSON-LD scripts parse as valid JSON
- All include @context "https://schema.org"
- BreadcrumbList URLs are correct and use www origin

### ✅ Crawlability
- All 8 recognised lineages are crawlable links on index page
- Eligible teachers are crawlable links on detail pages
- Suspended teachers are NOT linked (correctly excluded)
- Invalid slugs return 404 (no fabricated content)

### ✅ Canonical Origin Normalization
- **0 bare origin (https://nostops.org) occurrences** across all pages
- **0 nostops.app occurrences** across all pages
- Backend host (pro-learn-connect-1.emergent.host) NOT in canonical/OG/JSON-LD
- All URLs use canonical origin (https://www.nostops.org)

### ✅ Privacy & Security
- NO sensitive data exposed (@nostops.com, user_, tn_, payout, kyc, ifsc)
- Suspended teacher links correctly excluded
- Only public-safe fields rendered

### ✅ Regression
- All previously working pages still return 200
- robots.txt and sitemap.xml still correct (93 URLs, all www)

---

## Detailed Evidence

### Index Page (/paramparas)

**Title:**
```
Yoga Paramparas · Recognised Lineages · NOSTOPS
```

**Canonical:**
```html
<link rel="canonical" href="https://www.nostops.org/paramparas"/>
```

**Unique /paramparas/* Links Found:** 8
- /paramparas/sivananda
- /paramparas/krishnamacharya
- /paramparas/iyengar
- /paramparas/bihar-yoga
- /paramparas/ashtanga
- /paramparas/vipassana-yoga
- /paramparas/kaivalyadhama
- /paramparas/kaivalya

**JSON-LD @types:**
- CollectionPage
- ItemList
- BreadcrumbList

### Detail Page (/paramparas/iyengar)

**Title:**
```
Iyengar Yoga Parampara — Empanelled Teachers · NOSTOPS
```

**Canonical:**
```html
<link rel="canonical" href="https://www.nostops.org/paramparas/iyengar"/>
```

**JSON-LD @types:**
- EducationalOrganization
- BreadcrumbList

**BreadcrumbList URLs:**
1. Home: https://www.nostops.org/
2. Paramparas: https://www.nostops.org/paramparas
3. Iyengar: https://www.nostops.org/paramparas/iyengar

**Visible Content:**
- "B.K.S. Iyengar" ✅
- "Pune" ✅
- "Known for" ✅

**Teacher Links:**
- /teachers/demo-user-india ✅ (eligible)
- /teachers/sarika-kakade-p ✅ (eligible)
- /teachers/yoga-shikshak-demo ❌ (suspended, correctly excluded)

### Detail Page (/paramparas/sivananda)

**Title:**
```
Sivananda Yoga Parampara — Empanelled Teachers · NOSTOPS
```

**Canonical:**
```html
<link rel="canonical" href="https://www.nostops.org/paramparas/sivananda"/>
```

### Invalid Slug (/paramparas/not-a-real-lineage-xyz)

**HTTP Status:** 404  
**Next.js not-found behavior:** ✅ Confirmed  
**No fabricated content:** ✅ Confirmed

---

## Conclusion

✅ **ALL 29 ASSERTIONS PASSED**

The paramparas pages (index + detail) are **READY FOR PRODUCTION**. All SEO requirements met:
- Server-side rendering working correctly
- Complete SEO metadata in initial HTML
- Canonical origin normalization (www) working perfectly
- JSON-LD structured data valid and complete
- Crawlability verified (8 lineages, eligible teachers)
- Privacy and security verified (no sensitive data)
- 404 handling correct (invalid slugs)
- Regression tests passing (all previous pages still working)

**Test Script:** `/app/paramparas_verification_test.py` (reusable for future regression testing)
