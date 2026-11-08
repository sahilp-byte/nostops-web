# NOSTOPS — Phase 4 controlled search release checklist (owner actions)

Code side is done in preview (host-aware robots, AI-agent policy, noindex fixes). These steps happen
AFTER a separately authorised publish of www.nostops.org:

1. **Check live feeds** (2 min)
   - https://www.nostops.org/robots.txt → per-agent groups + one `Sitemap: https://www.nostops.org/sitemap.xml`
     line; GPTBot / ClaudeBot / Google-Extended / Applebot-Extended / Amazonbot / Meta-ExternalAgent /
     Bytespider / CCBot show `Disallow: /`.
   - https://www.nostops.org/sitemap.xml → loads; header `X-Sitemap-Skipped: none`.
   - Any preview URL /robots.txt → `User-agent: *` + `Disallow: /` only.
2. **Google Search Console** (search.google.com/search-console)
   - Add a **Domain** property for `nostops.org` (DNS TXT record at the domain registrar).
   - Sitemaps → submit `https://www.nostops.org/sitemap.xml`.
   - URL Inspection → request indexing for: `/`, `/for-organisations`, `/for-organisations/companies`,
     `/for-organisations/educational-institutions`, `/for-organisations/startup-networking-groups`, `/programmes`.
3. **Bing Webmaster Tools** (optional) → import from Search Console.
4. **Watch for 2–4 weeks**: Pages report (indexed vs "Excluded by noindex"), sitemap "Discovered" count
   (~344 URLs in preview data), and Core Web Vitals.
5. **Rollback**: robots and sitemap are single website routes
   (`app/(public)/robots.txt/route.ts`, `lib/server/sitemap-manifest.ts`) — revert and redeploy.

Intentionally out of search: `/venues/ai-onboarding` (+ `/result`) while payments are locked; disputed-history
Guru records ("Requires Scholarly Verification", 8 of 59); `/app/**`, auth, token and utility pages.
Kept in search per owner: `/venues/submit`, `/claim`, `/teacher-pulse`, `/voices/api`.
