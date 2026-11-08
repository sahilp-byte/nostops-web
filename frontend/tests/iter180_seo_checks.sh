#!/bin/bash
# Iteration 180: robots / X-Robots-Tag / noindex / sitemap / legacy venue redirect checks
P=https://nostops-spaces--0fieag2d.preview.emergentagent.com
L=http://localhost:3000
echo "=== C1 localhost robots.txt ==="
curl -s $L/robots.txt
echo; echo "=== C2 preview robots.txt ==="
curl -s $P/robots.txt | od -c | tail -5; curl -s $P/robots.txt
echo; echo "=== C3 X-Robots-Tag preview vs local ==="
for u in / /for-organisations/companies /venues/submit /gurus/ag-mohan; do
  echo "preview $u: $(curl -sI $P$u | grep -i x-robots-tag | tr -d '\r')"
  echo "local   $u: $(curl -sI $L$u | grep -i x-robots-tag | tr -d '\r')"
done
meta() { curl -s "$L$1" | grep -oE '<meta name="robots"[^>]*>|<link rel="canonical"[^>]*>' | sort -u | tr '\n' ' '; }
echo; echo "=== C4/C5/C7 meta ==="
for u in /venues/ai-onboarding /venues/ai-onboarding/result /gurus/hastamalaka /gurus/ag-mohan /venues/submit /claim /teacher-pulse /voices/api; do
  echo "$u [$(curl -s -o /dev/null -w '%{http_code}' $L$u)] : $(meta $u)"
done
echo "hastamalaka label: $(curl -s $L/gurus/hastamalaka | grep -o 'Requires Scholarly Verification' | head -1)"
echo; echo "=== C5 sitemap ==="
curl -sI $L/sitemap.xml | grep -i x-sitemap
S=$(curl -s $L/sitemap.xml)
echo "gurus urls: $(echo "$S" | grep -o '<loc>[^<]*/gurus/[^<]*</loc>' | wc -l)"
echo "hastamalaka in sitemap: $(echo "$S" | grep -c hastamalaka)"
echo "ai-onboarding in sitemap: $(echo "$S" | grep -c ai-onboarding)"
echo; echo "=== C6 legacy venue ==="
curl -s -o /dev/null -w 'pub: %{http_code} -> %{redirect_url}\n' $L/venues/pub_09514181ba3546a980299e430a5f0e10
curl -s -o /dev/null -w 'target: %{http_code}\n' $L/venues/in/varkala/varkala-cliff-yoga-deck
curl -s -o /dev/null -w 'notexist: %{http_code}\n' $L/venues/vp_doesnotexist123
curl -s -o /dev/null -w 'availability: %{http_code}\n' $L/venues/pub_09514181ba3546a980299e430a5f0e10/availability
curl -s -o /dev/null -w 'preview pub: %{http_code} -> %{redirect_url}\n' $P/venues/pub_09514181ba3546a980299e430a5f0e10
