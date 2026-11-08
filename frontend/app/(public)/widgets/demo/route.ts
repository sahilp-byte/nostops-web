import type { NextRequest } from 'next/server';
import { isPreviewOrigin } from '@/lib/server/preview-isolation';

// PREVIEW-ONLY test page: a pretend venue website with the NOSTOPS widgets pasted in
// ONCE. Used to demonstrate that a central admin change updates an existing
// installation without editing its embed code. 404 outside preview.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CODE = /^v[a-z2-9]{9}$/;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(req: NextRequest) {
  if (!isPreviewOrigin(req.headers)) return new Response('Not found', { status: 404 });
  const sp = new URL(req.url).searchParams;
  const live = CODE.test(sp.get('code') || '') ? String(sp.get('code')) : 'vdemopage2';
  const pending = CODE.test(sp.get('pending') || '') ? String(sp.get('pending')) : 'vdemopend3';
  const snippet = (code: string, kind: string) =>
    `<div class="nostops-venue-widget" data-code="${code}" data-widget="${kind}"></div>\n<script src="/widgets/venue.js" async></script>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Sattva Hills Retreat — test venue website</title>
<style>
body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;background:#f5f1ea}
header{background:#3f2d20;color:#fff;padding:18px 24px}header b{font-size:20px}
main{max-width:860px;margin:0 auto;padding:28px 20px 60px}h2{margin:36px 0 6px;font-size:18px}
.note{background:#fff7e6;border:1px solid #f1d39a;border-radius:10px;padding:12px 14px;font-size:14px}
pre{background:#1f2937;color:#e5e7eb;padding:12px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap}
.slot{margin:14px 0 6px}
</style></head>
<body>
<header><b>Sattva Hills Retreat</b> · a pretend venue website (test page)</header>
<main>
<p class="note" data-testid="demo-note">This test page stands in for a venue owner's own website. The NOSTOPS embed code below was pasted <strong>once</strong> and is never edited. Change the widget wording or colours in <em>Admin → Venue Widgets</em>, then reload this page.</p>
<p>Welcome to Sattva Hills — twelve acres of forest, a 60-person shala and sattvic meals. We host yoga retreats all year.</p>

<h2>Widget 1 · “Listed on NOSTOPS” (published venue)</h2>
<div class="slot"><div class="nostops-venue-widget" data-testid="demo-widget-listed" data-code="${live}" data-widget="listed"></div></div>
<pre>${esc(snippet(live, 'listed'))}</pre>

<h2>Widget 2 · “Yoga Teacher Collaboration” (published venue)</h2>
<div class="slot"><div class="nostops-venue-widget" data-testid="demo-widget-teacher" data-code="${live}" data-widget="teacher"></div></div>
<pre>${esc(snippet(live, 'teacher'))}</pre>

<h2>Same widget on a venue that is not published yet</h2>
<div class="slot"><div class="nostops-venue-widget" data-testid="demo-widget-pending" data-code="${pending}" data-widget="teacher"></div></div>
<pre>${esc(snippet(pending, 'teacher'))}</pre>
</main>
<script src="/widgets/venue.js" async></script>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
