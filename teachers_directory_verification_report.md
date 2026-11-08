# /teachers Directory SSR Verification Report

**Test Date:** 2026-08-28  
**Test Method:** curl-based HTTP verification (NO browser/UI automation)  
**Base URL:** http://localhost:3000  
**Target:** /teachers directory page

---

## Executive Summary

✅ **ALL ASSERTIONS PASSED** (17/17)

The /teachers directory page is correctly server-rendered with complete SEO metadata, structured data, and privacy protection. All canonical URLs use the www origin (https://www.nostops.org), no bare origin leaks detected, and no private data exposed.

---

## Detailed Test Results

### 1. HTTP Status and Content-Type ✅

**Assertion:** HTTP 200, Content-Type contains text/html

**Evidence:**
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Response Size: 165,211 bytes
```

**Result:** PASS

---

### 2. Page Title ✅

**Assertion:** `<title>` present and equals "Yoga Teacher Directory · NOSTOPS"

**Evidence:**
```html
<title>Yoga Teacher Directory · NOSTOPS</title>
```

**Result:** PASS - Title exactly matches expected value

---

### 3. Meta Description ✅

**Assertion:** `<meta name="description">` present, non-empty, mentions teacher count and NOSTOPS

**Evidence:**
```html
<meta name="description" content="Browse 35 yoga teachers on NOSTOPS. Discover teachers and Gurus across India — their traditions (paramparas), styles and cities — and connect with practitioners who carry forward the Guru–Shishya Parampara."/>
```

**Result:** PASS
- Description present: ✅
- Non-empty: ✅
- Contains "35" (teacher count): ✅
- Contains "NOSTOPS": ✅

---

### 4. Canonical Link ✅

**Assertion:** Canonical link EXACTLY `<link rel="canonical" href="https://www.nostops.org/teachers"/>`

**Evidence:**
```html
<link rel="canonical" href="https://www.nostops.org/teachers"/>
```

**Result:** PASS - Exact match with www origin

---

### 5. Open Graph Tags ✅

**Assertion:** og:url exactly `https://www.nostops.org/teachers`; og:title and og:type present

**Evidence:**
```html
<meta property="og:title" content="Yoga Teacher Directory · NOSTOPS"/>
<meta property="og:description" content="Browse 35 yoga teachers on NOSTOPS. Discover teachers and Gurus across India — their traditions (paramparas), styles and cities — and connect with practitioners who carry forward the Guru–Shishya Parampara."/>
<meta property="og:url" content="https://www.nostops.org/teachers"/>
<meta property="og:site_name" content="NOSTOPS"/>
<meta property="og:type" content="website"/>
```

**Result:** PASS
- og:url = https://www.nostops.org/teachers: ✅
- og:title present: ✅
- og:type = "website": ✅

---

### 6. Twitter Card ✅

**Assertion:** twitter:card meta present

**Evidence:**
```html
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Yoga Teacher Directory · NOSTOPS"/>
<meta name="twitter:description" content="Browse 35 yoga teachers on NOSTOPS. Discover teachers and Gurus across India — their traditions (paramparas), styles and cities — and connect with practitioners who carry forward the Guru–Shishya Parampara."/>
```

**Result:** PASS - twitter:card = "summary_large_image"

---

### 7. Crawlable Teacher Links ✅

**Assertion:** At least 20 distinct crawlable anchor links matching href="/teachers/{handle}" (expected ~35)

**Evidence:**
- **Total unique links found:** 35
- **Link pattern:** `/teachers/{handle}` (relative links)
- **Element type:** `<a>` anchors (crawlable, not JavaScript handlers)

**Sample links verified:**
```html
<a class="card group flex h-full flex-col p-6 transition hover:border-brand hover:shadow-md" href="/teachers/demo-user-india">
<a class="card group flex h-full flex-col p-6 transition hover:border-brand hover:shadow-md" href="/teachers/arjun-raghavan">
<a class="card group flex h-full flex-col p-6 transition hover:border-brand hover:shadow-md" href="/teachers/sarika-kakade-p">
```

**All 35 unique teacher handles:**
1. /teachers/demo-user-india
2. /teachers/arjun-raghavan
3. /teachers/sarika-kakade-p
4. /teachers/joshi
5. /teachers/ajaykumarshastri75
6. /teachers/bisht
7. /teachers/kapooranu101
8. /teachers/hello.mentorify
9. /teachers/dhekanebhslchandra
10. /teachers/bikashpurohityoga
11. /teachers/eshayzozmnm
12. /teachers/debasish.sarkar
13. /teachers/dsinchekar
14. /teachers/shashtri
15. /teachers/infoyoga21
16. /teachers/drjasminejshah
17. /teachers/shiviyadav284
18. /teachers/geeta-c
19. /teachers/hqrishyoga
20. /teachers/harishyoga
21. /teachers/piparia.heer
22. /teachers/meera-iyer
23. /teachers/himalayan.mohan
24. /teachers/name1
25. /teachers/nirajsadhaka
26. /teachers/minimadhur
27. /teachers/prakashchandna73
28. /teachers/racharajani1992
29. /teachers/rajanikdham
30. /teachers/nancyaws7888036
31. /teachers/riya-admin-m
32. /teachers/test11
33. /teachers/anandsneh1813
34. /teachers/soulbuzzfitnessyoga
35. /teachers/akshit007chauhan

**Result:** PASS - 35 unique crawlable links (matches expected count)

---

### 8. Teacher Names in HTML Body ✅

**Assertion:** At least 3 non-empty teacher name text nodes exist near teacher links

**Evidence:**
Teacher names found in raw HTML body:
```html
<h3 class="truncate text-base font-bold group-hover:text-brand-700">Demo User</h3>
<h3 class="truncate text-base font-bold group-hover:text-brand-700">Arjun Raghavan</h3>
<h3 class="truncate text-base font-bold group-hover:text-brand-700">Sarika Kakade</h3>
<h3 class="truncate text-base font-bold group-hover:text-brand-700">Meera Iyer</h3>
```

**Result:** PASS - 4+ teacher names found in HTML body

---

### 9. JSON-LD Structured Data ✅

**Assertion:** At least one `<script type="application/ld+json">` block with valid JSON, required @types, and matching counts

**Evidence:**

**Number of JSON-LD blocks:** 2

**Block 1: CollectionPage + ItemList**
```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://www.nostops.org/teachers#directory",
  "url": "https://www.nostops.org/teachers",
  "name": "NOSTOPS Yoga Teacher Directory",
  "description": "Browse 35 yoga teachers on NOSTOPS...",
  "isPartOf": {
    "@type": "WebSite",
    "name": "NOSTOPS",
    "url": "https://www.nostops.org/"
  },
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": 35,
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": {
          "@type": "Person",
          "@id": "https://www.nostops.org/teachers/demo-user-india",
          "name": "Demo User",
          "url": "https://www.nostops.org/teachers/demo-user-india",
          "jobTitle": "Yoga Teacher",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "India",
            "addressCountry": "India"
          },
          "knowsAbout": "Iyengar"
        }
      },
      // ... 34 more Person entries
    ]
  }
}
```

**Block 2: BreadcrumbList**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.nostops.org/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Teachers",
      "item": "https://www.nostops.org/teachers"
    }
  ]
}
```

**@types found (including nested):**
- CollectionPage ✅
- ItemList ✅
- Person ✅ (35 instances)
- BreadcrumbList ✅
- ListItem ✅
- WebSite ✅
- PostalAddress ✅

**Count verification:**
- ItemList numberOfItems: 35 ✅
- Person entries in JSON-LD: 35 ✅
- Teacher links in HTML: 35 ✅
- **All counts match** ✅

**Result:** PASS
- Valid JSON: ✅
- @context = "https://schema.org": ✅
- All required @types present: ✅
- Counts match: ✅

---

### 10. JSON-LD URLs Use www Origin ✅

**Assertion:** EVERY url/@id inside JSON-LD uses https://www.nostops.org/teachers/{handle}, NO bare origin

**Evidence:**
- **Total URLs in JSON-LD:** 73
- **URLs with www origin:** 73 (100%)
- **URLs with bare origin:** 0

**Sample URLs from JSON-LD:**
```
https://www.nostops.org/teachers#directory
https://www.nostops.org/teachers
https://www.nostops.org/
https://www.nostops.org/teachers/demo-user-india
https://www.nostops.org/teachers/arjun-raghavan
https://www.nostops.org/teachers/sarika-kakade-p
... (all 73 URLs use www origin)
```

**Result:** PASS - All JSON-LD URLs use canonical www origin

---

### 11. No Bare Origin in SEO Metadata ✅

**Assertion:** NO occurrence of bare non-www origin `https://nostops.org` anywhere in SEO metadata

**Evidence:**
- **Bare origin occurrences in entire HTML:** 0
- Canonical link: https://www.nostops.org/teachers ✅
- og:url: https://www.nostops.org/teachers ✅
- JSON-LD URLs: All use www origin ✅

**Result:** PASS - Zero bare origin occurrences

---

### 12. Backend Host Not in Metadata/JSON-LD ✅

**Assertion:** Backend host `pro-learn-connect-1.emergent.host` must NOT appear in canonical/OG/twitter meta or JSON-LD

**Evidence:**
- **Backend host in canonical/meta tags:** NOT FOUND ✅
- **Backend host in JSON-LD:** NOT FOUND ✅
- **Backend host in header "Open app" link:** FOUND (acceptable, out of scope)

**Note:** The backend host appears ONLY in the site header/footer "Open app" links, which is explicitly out of scope per requirements.

**Result:** PASS - Backend host not in SEO metadata or JSON-LD

---

### 13. Privacy Protection ✅

**Assertion:** NO private fields (email, phone, payout, kyc, ifsc, bank_verified) in teacher directory markup

**Evidence:**
- **Email fields (JSON/attributes):** NOT FOUND ✅
- **Phone/WhatsApp fields:** NOT FOUND ✅
- **Sensitive keywords (payout, kyc, ifsc, bank_verified, account_number, user_id):** NOT FOUND ✅

**Note:** One teacher has an email address as their display name ("rishikeshyog@kendra.com"), but this is a public profile name field, not a private email field leak. No actual email/phone/financial fields are exposed.

**Result:** PASS - No private data leakage

---

## Regression Tests

### REGRESSION 1: robots.txt ✅

**Command:** `curl -s http://localhost:3000/robots.txt`

**Evidence:**
```
User-agent: *
Allow: /

Disallow: /api/
Disallow: /admin/

Sitemap: https://www.nostops.org/sitemap.xml
```

**Verification:**
- Contains `Sitemap: https://www.nostops.org/sitemap.xml`: ✅
- No bare origin (https://nostops.org): ✅

**Result:** PASS

---

### REGRESSION 2: sitemap.xml ✅

**Command:** `curl -s http://localhost:3000/sitemap.xml`

**Evidence:**
- **Total `<loc>` tags:** 93
- **`<loc>` with www origin:** 93 (100%)
- **`<loc>` with bare origin:** 0

**Sample `<loc>` entries:**
```xml
<loc>https://www.nostops.org/</loc>
<loc>https://www.nostops.org/about</loc>
<loc>https://www.nostops.org/teachers</loc>
<loc>https://www.nostops.org/teachers/demo-user-india</loc>
<loc>https://www.nostops.org/teachers/arjun-raghavan</loc>
... (all 93 use www origin)
```

**Result:** PASS - All 93 sitemap URLs use www origin

---

### REGRESSION 3: /about page ✅

**Command:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/about`

**Evidence:**
```
HTTP 200
```

**Result:** PASS - /about page still accessible

---

## Summary of Evidence

### Canonical Origin Normalization: PERFECT ✅

- **Canonical link:** https://www.nostops.org/teachers
- **Open Graph og:url:** https://www.nostops.org/teachers
- **JSON-LD URLs (73 total):** All use https://www.nostops.org
- **Sitemap URLs (93 total):** All use https://www.nostops.org
- **Bare origin occurrences:** 0

### SEO Metadata: COMPLETE ✅

- Title: ✅ "Yoga Teacher Directory · NOSTOPS"
- Description: ✅ 35 teachers, NOSTOPS mention
- Canonical: ✅ www origin
- Open Graph: ✅ og:url, og:title, og:type
- Twitter: ✅ twitter:card

### Structured Data: COMPLETE ✅

- JSON-LD blocks: 2
- @types: CollectionPage, ItemList (35 items), Person (35), BreadcrumbList
- All JSON valid: ✅
- Counts match: ✅ (35 = 35 = 35)

### Crawlability: EXCELLENT ✅

- Teacher links: 35 crawlable `<a>` anchors
- Teacher names: Present in HTML body
- Link pattern: `/teachers/{handle}` (relative, SEO-friendly)

### Privacy: PROTECTED ✅

- No email fields exposed
- No phone/WhatsApp fields exposed
- No financial/KYC data exposed

### Backend Host Isolation: CORRECT ✅

- Backend host NOT in canonical/OG/twitter meta
- Backend host NOT in JSON-LD
- Backend host ONLY in header/footer "Open app" links (out of scope)

---

## Test Execution Details

**Test Script:** `/app/teachers_directory_test.py`  
**Test Method:** Python script using curl (subprocess)  
**Total Assertions:** 17  
**Passed:** 17  
**Failed:** 0  
**Success Rate:** 100%

**Command to reproduce:**
```bash
cd /app && python3 teachers_directory_test.py
```

---

## Conclusion

✅ **ALL REQUIREMENTS MET**

The /teachers directory page is correctly server-rendered with:
1. Complete SEO metadata (title, description, canonical, OG, Twitter)
2. Valid JSON-LD structured data (CollectionPage, ItemList with 35 Person entries, BreadcrumbList)
3. 35 crawlable teacher links in initial HTML
4. Teacher names visible in HTML body
5. Perfect canonical origin normalization (all URLs use https://www.nostops.org)
6. Zero bare origin leaks
7. Backend host isolated from SEO metadata
8. Privacy protection (no private fields exposed)
9. No regressions (robots.txt, sitemap.xml, /about all working)

The implementation is production-ready for SEO and web crawlers.
