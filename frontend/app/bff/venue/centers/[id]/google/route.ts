import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Connect / disconnect a Center's public Google listing. CSRF-guarded ->
//   POST /venue-enrichment/centers/{id}/connect  {maps_url, i_have_venue_permission}
//   POST /venue-enrichment/centers/{id}/disconnect
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
function looksLikeGoogleMapsUrl(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  return /(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|business\.google\.|share\.google)/i.test(u);
}

// Google Maps SHORT links (maps.app.goo.gl / goo.gl/maps / g.co / share.google)
// are opaque redirects. The remote enrichment parser needs the FULL expanded
// URL (which embeds the place name, coordinates and CID) to resolve the place,
// so we follow the redirect server-side first. If anything fails we fall back
// to the original link (the remote may still handle it).
const SHORT_RE = /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|share\.google)/i;

// A short "Share → Copy link" often expands to a DIRECTIONS or SEARCH URL
// (…/maps/dir/… or …/maps/search/…) rather than a clean …/maps/place/… link.
// Those still embed the place identity (name + coordinates + feature id) inside
// the `data=` payload, but the enrichment parser only recognises place links —
// so we rebuild a canonical …/maps/place/<name>/@<lat>,<lng>/data=…!1s<fid>…
// URL from those parts. Anything already a place link is returned unchanged.
function canonicalizePlaceUrl(finalUrl: string): string {
  try {
    if (/\/maps\/place\//i.test(finalUrl)) return finalUrl;
    const fid = finalUrl.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/)?.[1];
    const coord = finalUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (!fid && !coord) return finalUrl; // nothing to rebuild from
    // Best-effort place name: the last meaningful path segment (skip the
    // maps/dir/search/place keywords, coordinate pairs and the data= blob).
    let name = '';
    try {
      const segs = new URL(finalUrl).pathname.split('/').filter(Boolean);
      for (let i = segs.length - 1; i >= 0; i--) {
        const seg = segs[i];
        if (/^data=/i.test(seg)) continue;
        if (/^@?-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/.test(seg)) continue; // coord pair
        if (['maps', 'dir', 'search', 'place'].includes(seg.toLowerCase())) continue;
        name = seg;
        break;
      }
    } catch {
      /* keep name empty */
    }
    const lat = coord?.[1];
    const lng = coord?.[2];
    const label = name || (lat && lng ? `${lat},${lng}` : '');
    if (!label) return finalUrl;
    const at = lat && lng ? `/@${lat},${lng},17z` : '';
    let data = '';
    if (fid && lat && lng) data = `/data=!3m1!4b1!4m6!3m5!1s${fid}!8m2!3d${lat}!4d${lng}`;
    else if (fid) data = `/data=!4m2!3m1!1s${fid}`;
    return `https://www.google.com/maps/place/${label}${at}${data}`;
  } catch {
    return finalUrl;
  }
}

async function resolveMapsUrl(u: string): Promise<string> {
  if (!SHORT_RE.test(u)) return u;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(u, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
    });
    clearTimeout(timer);
    let finalUrl = r.url || u;
    // Some regions bounce through a consent interstitial — the real maps URL
    // is then carried in the ?continue= param.
    if (/consent\.google\./i.test(finalUrl)) {
      const cont = new URL(finalUrl).searchParams.get('continue');
      if (cont) finalUrl = decodeURIComponent(cont);
    }
    return /google\.[a-z.]+\/maps|maps\.google\./i.test(finalUrl) ? canonicalizePlaceUrl(finalUrl) : u;
  } catch {
    return u;
  }
}

// Human-readable place name from a resolved Google Maps URL (used for the
// "we detected …" preview + retry hint). Handles /place/<name>/… and the
// /dir/…/<name>/data=… shapes; returns '' when nothing usable is present.
function detectPlaceName(u: string): string {
  try {
    const segs = new URL(u).pathname.split('/').filter(Boolean);
    const nice = (seg: string) => decodeURIComponent(seg.replace(/\+/g, ' ')).trim();
    const placeIdx = segs.findIndex((x) => x.toLowerCase() === 'place');
    if (placeIdx >= 0) {
      const cand = segs[placeIdx + 1];
      if (cand && !/^@/.test(cand) && !/^data=/i.test(cand)) return nice(cand);
    }
    for (let i = segs.length - 1; i >= 0; i--) {
      const seg = segs[i];
      if (/^data=/i.test(seg)) continue;
      if (/^@?-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/.test(seg)) continue;
      if (['maps', 'dir', 'search', 'place'].includes(seg.toLowerCase())) continue;
      return nice(seg);
    }
  } catch {
    /* ignore */
  }
  return '';
}

// Normalise the remote connect response into a small summary for the success
// toast. Field names mirror the flexible aliases used by getVenueEnrichment.
function placeSummary(data: any): { name?: string; rating?: number; reviewCount?: number; photoCount?: number } {
  const p = data?.venue || data?.place || data?.enrichment || data || {};
  const numOf = (...v: any[]) => v.find((x) => typeof x === 'number' && x >= 0);
  const name = [p.google_display_name, p.display_name, p.displayName, p.name, p.venue_name].find(
    (x) => typeof x === 'string' && x.trim(),
  );
  const rating = typeof p.rating === 'number' ? p.rating : undefined;
  const reviewCount = numOf(p.review_count, p.user_rating_count, p.userRatingCount, p.reviews_count);
  const photoCount = Array.isArray(p.photos) ? p.photos.length : numOf(p.photo_count, p.photos_count);
  return { name, rating, reviewCount, photoCount };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'missing venue id' }, { status: 400 });
  const raw = await req.json().catch(() => ({}));
  const action = s(raw.action) === 'disconnect' ? 'disconnect' : s(raw.action) === 'preview' ? 'preview' : 'connect';

  // Lightweight preview: resolve the pasted link and return the venue name we
  // detected — WITHOUT touching the remote enrichment. Powers the live "we
  // found …" hint so owners can confirm the right place before connecting.
  if (action === 'preview') {
    const previewUrl = s(raw.maps_url);
    if (!previewUrl || !looksLikeGoogleMapsUrl(previewUrl)) return NextResponse.json({ ok: false, detectedName: '' });
    const resolved = await resolveMapsUrl(previewUrl);
    return NextResponse.json({ ok: true, detectedName: detectPlaceName(resolved) });
  }

  if (action === 'disconnect') {
    const up = await backendFetch(`/venue-enrichment/centers/${encodeURIComponent(id)}/disconnect`, { method: 'POST', body: '{}' });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not disconnect.') }, { status: up.status || 502 });
    return NextResponse.json({ ok: true, data });
  }

  const mapsUrl = s(raw.maps_url);
  if (!mapsUrl) return NextResponse.json({ error: 'Paste the venue’s Google Maps or Business Profile link.' }, { status: 400 });
  if (!looksLikeGoogleMapsUrl(mapsUrl)) return NextResponse.json({ error: 'That doesn’t look like a Google Maps / Business Profile link.' }, { status: 400 });
  if (raw.i_have_venue_permission !== true) return NextResponse.json({ error: 'Please confirm you have permission to reference this venue’s public listing.' }, { status: 400 });

  // Expand short links to the full Google Maps URL so the remote can resolve the place.
  const resolvedUrl = await resolveMapsUrl(mapsUrl);
  const detectedName = detectPlaceName(resolvedUrl);

  const up = await backendFetch(`/venue-enrichment/centers/${encodeURIComponent(id)}/connect`, {
    method: 'POST',
    body: JSON.stringify({ maps_url: resolvedUrl, i_have_venue_permission: true }),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    const errText = toErrorText(detail || data?.error, 'Could not connect the venue.');
    // Give clearer guidance for the most common failure (a link that doesn't
    // resolve to a real place / a private or non-Business listing).
    const friendly = /not\s*be?\s*found|no\s*place|invalid|resolve|listing/i.test(errText)
      ? 'We couldn’t find that Google listing. In Google Maps, open your venue → tap Share → Copy link, then paste the full link here (a search results link won’t work).'
      : errText;
    return NextResponse.json({ error: friendly, detectedName }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data, summary: placeSummary(data), detectedName });
}
