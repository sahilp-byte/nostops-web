// Prompt 2E (TVR-15) — photo uploads accept only real JPG / PNG / WebP bytes that match the
// declared type, and store them under the detected type and extension. Runs the REAL route
// handlers of all four website upload routes in Node; every network call (session lookup,
// host eligibility, object storage, institutional engine) is intercepted and answered
// locally, so nothing is stored anywhere and nothing reaches the main backend.
// Run: node tests/verify_image_uploads.ts
import { readFileSync } from 'node:fs';
import { register as registerHook } from 'node:module';
import sharp from 'sharp';

registerHook('./alias-hooks.mjs', import.meta.url);
registerHook('./server-only-hook.mjs', import.meta.url);
registerHook('./next-headers-hook.mjs', import.meta.url);

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^(PULSE_SHARED_SECRET|PULSE_API_URL|BACKEND_URL)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { NextRequest } = await import('next/server');
const img = await import('../lib/server/image-upload.ts');
const cover = await import('../app/bff/teacher/retreat-cover/route.ts');
const venuePhoto = await import('../app/bff/venue/photo/route.ts');
const publicPhoto = await import('../app/bff/venue/public-photo/route.ts');
const orgLogo = await import('../app/bff/institutional/organisations/[id]/logo/route.ts');

let failures = 0;
let passes = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    passes++;
    console.log(`  \u2713 ${name}`);
  } else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}

// ── network: everything answered locally; object-storage PUTs are recorded, never sent ──
type Stored = { path: string; contentType: string; size: number };
let stored: Stored[] = [];
let otherWrites: string[] = [];
(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const u = String(url);
  const method = String(init.method || 'GET').toUpperCase();
  if (u.endsWith('/objstore/api/v1/storage/init')) return new Response(JSON.stringify({ storage_key: 'qa_storage_key' }), { status: 200 });
  const om = /\/objstore\/api\/v1\/storage\/objects\/(.+)$/.exec(u);
  if (om && method === 'PUT') {
    const ct = new Headers(init.headers).get('content-type') || '';
    const size = (init.body as Buffer | undefined)?.length ?? 0;
    stored.push({ path: om[1], contentType: ct, size });
    return new Response(JSON.stringify({ path: om[1], size }), { status: 200 });
  }
  if (u.endsWith('/api/auth/me')) return new Response(JSON.stringify({ user: { user_id: 'u_qa_p2e', email: 'qa.p2e@example.com', name: 'QA P2E', role: 'teacher' } }), { status: 200 });
  if (u.includes('/api/retreats/host-eligibility')) return new Response(JSON.stringify({ eligible: true, host_type: 'teacher' }), { status: 200 });
  if (method !== 'GET') otherWrites.push(`${method} ${u}`);
  if (/\/organisations\/[^/]+$/.test(u) && method === 'PATCH') {
    const b = JSON.parse(String(init.body || '{}'));
    return new Response(JSON.stringify({ organisation: { organisation_id: 'org_qa_p2e', logo_url: b.logo_url } }), { status: 200 });
  }
  return new Response(JSON.stringify({ detail: 'not mocked' }), { status: 404 });
};

const CSRF = 'p2efixturecsrftoken0123456789abcd';
(globalThis as any).__qaCookies = { nostops_session: 'qa_session_p2e' };
(globalThis as any).__qaRequestHeaders = { host: 'www.nostops.org' };
let ipSeq = 0;
function req(path: string, body: unknown) {
  ipSeq += 1;
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `nostops_csrf=${CSRF}; nostops_session=qa_session_p2e`,
      'x-csrf-token': CSRF,
      'x-forwarded-for': `203.0.113.${ipSeq % 250}`,
    },
    body: JSON.stringify(body),
  });
}

const ROUTES = [
  { name: 'retreat cover', call: (b: unknown) => cover.POST(req('/bff/teacher/retreat-cover', b)) },
  { name: 'venue photo', call: (b: unknown) => venuePhoto.POST(req('/bff/venue/photo', b)) },
  { name: 'public venue photo', call: (b: unknown) => publicPhoto.POST(req('/bff/venue/public-photo', b)) },
  {
    name: 'organisation logo',
    call: (b: unknown) => orgLogo.POST(req('/bff/institutional/organisations/org_qa_p2e/logo', b), { params: Promise.resolve({ id: 'org_qa_p2e' }) }),
  },
];

// ── real images (random pixels, so each is well over the minimum size) ──
const W = 48;
const pixels = Buffer.alloc(W * W * 3);
for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7919 + 13) % 251;
const raw = { raw: { width: W, height: W, channels: 3 as const } };
const JPG = await sharp(pixels, raw).jpeg({ quality: 80 }).toBuffer();
const PNG = await sharp(pixels, raw).png().toBuffer();
const WEBP = await sharp(pixels, raw).webp({ quality: 80 }).toBuffer();
const HTML = Buffer.from('<html><body><script>alert(document.cookie)</script></body></html>'.repeat(8));
const SVG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">${'<rect width="1" height="1"/>'.repeat(10)}</svg>`);
const FAKE_JPG_HEADER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), HTML]);
const FAKE_PNG_HEADER = Buffer.concat([PNG.subarray(0, 8), HTML]);
const FAKE_WEBP_HEADER = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0xff, 0xff, 0x00, 0x00]), Buffer.from('WEBPVP8 '), HTML]);
const TRUNC_JPG = JPG.subarray(0, Math.floor(JPG.length / 2));
const TRUNC_PNG = PNG.subarray(0, PNG.length - 12); // IEND removed
const BAD_CRC_PNG = Buffer.from(PNG);
BAD_CRC_PNG[29] ^= 0xff; // inside the IHDR CRC
const TRUNC_WEBP = WEBP.subarray(0, WEBP.length - 40);
const uri = (type: string, b: Buffer) => `data:${type};base64,${b.toString('base64')}`;

console.log('Byte check (lib/server/image-upload.ts):');
check('a real JPG is detected as image/jpeg', img.detectImageType(JPG) === 'image/jpeg');
check('a real PNG is detected as image/png', img.detectImageType(PNG) === 'image/png');
check('a real WebP is detected as image/webp', img.detectImageType(WEBP) === 'image/webp');
for (const [label, b] of [['HTML', HTML], ['SVG with script', SVG], ['JPG header + HTML', FAKE_JPG_HEADER], ['PNG signature + HTML', FAKE_PNG_HEADER],
  ['RIFF/WEBP header + HTML', FAKE_WEBP_HEADER], ['truncated JPG', TRUNC_JPG], ['PNG without IEND', TRUNC_PNG], ['PNG with a bad CRC', BAD_CRC_PNG],
  ['truncated WebP', TRUNC_WEBP], ['empty', Buffer.alloc(0)]] as const) {
  check(`${label} is not an image`, img.detectImageType(b as Buffer) === null, img.detectImageType(b as Buffer));
}
check('image/jpg is read as image/jpeg', img.declaredImageType('image/JPG') === 'image/jpeg');
check('text/html is not an allowed declared type', img.declaredImageType('text/html') === null);
check('a PNG declared as JPEG is refused', img.verifiedImageType(PNG, 'image/jpeg') === null);

const ACCEPT = [
  { label: 'JPG declared image/jpeg', body: { base64: uri('image/jpeg', JPG) }, type: 'image/jpeg', ext: 'jpg' },
  { label: 'JPG declared image/jpg', body: { base64: uri('image/jpg', JPG) }, type: 'image/jpeg', ext: 'jpg' },
  { label: 'PNG declared image/png', body: { base64: uri('image/png', PNG) }, type: 'image/png', ext: 'png' },
  { label: 'WebP declared image/webp', body: { base64: uri('image/webp', WEBP) }, type: 'image/webp', ext: 'webp' },
  { label: 'bare base64 PNG with contentType image/png', body: { base64: PNG.toString('base64'), contentType: 'image/png' }, type: 'image/png', ext: 'png' },
];
const REFUSE = [
  { label: 'HTML labelled image/jpeg', body: { base64: uri('image/jpeg', HTML) } },
  { label: 'HTML labelled image/png', body: { base64: uri('image/png', HTML) } },
  { label: 'HTML labelled image/webp', body: { base64: uri('image/webp', HTML) } },
  { label: 'SVG with script labelled image/png', body: { base64: uri('image/png', SVG) } },
  { label: 'JPG header followed by HTML', body: { base64: uri('image/jpeg', FAKE_JPG_HEADER) } },
  { label: 'PNG signature followed by HTML', body: { base64: uri('image/png', FAKE_PNG_HEADER) } },
  { label: 'RIFF/WEBP header followed by HTML', body: { base64: uri('image/webp', FAKE_WEBP_HEADER) } },
  { label: 'PNG bytes labelled image/jpeg (mismatch)', body: { base64: uri('image/jpeg', PNG) } },
  { label: 'JPG bytes labelled image/webp (mismatch)', body: { base64: uri('image/webp', JPG) } },
  { label: 'WebP bytes labelled image/png (mismatch)', body: { base64: uri('image/png', WEBP) } },
  { label: 'truncated JPG', body: { base64: uri('image/jpeg', TRUNC_JPG) } },
  { label: 'PNG without its end chunk', body: { base64: uri('image/png', TRUNC_PNG) } },
  { label: 'PNG with a corrupted checksum', body: { base64: uri('image/png', BAD_CRC_PNG) } },
  { label: 'truncated WebP', body: { base64: uri('image/webp', TRUNC_WEBP) } },
  { label: 'text/html declared', body: { base64: uri('text/html', HTML) } },
  { label: 'bare base64 HTML with the default type', body: { base64: HTML.toString('base64') } },
];

for (const route of ROUTES) {
  console.log(`\n${route.name}:`);
  for (const c of ACCEPT) {
    stored = [];
    otherWrites = [];
    const r = await route.call(c.body);
    const d: any = await r.json().catch(() => ({}));
    const s = stored[0];
    check(`${c.label} → stored once as ${c.type} .${c.ext}`,
      r.status === 200 && stored.length === 1 && s.contentType === c.type && s.path.endsWith(`.${c.ext}`) && String(d.url || '').endsWith(`.${c.ext}`),
      { status: r.status, stored, url: d.url, error: d.error });
  }
  for (const c of REFUSE) {
    stored = [];
    otherWrites = [];
    const r = await route.call(c.body);
    const d: any = await r.json().catch(() => ({}));
    check(`${c.label} → 400, nothing stored or saved`,
      r.status === 400 && /JPG|PNG|WebP|read/.test(String(d.error)) && stored.length === 0 && otherWrites.length === 0,
      { status: r.status, error: d.error, stored, otherWrites });
  }
}

console.log(`\n${failures ? '\u2717 IMAGE UPLOADS FAILED' : '\u2713 IMAGE UPLOADS PASSED'} (${passes} passed, ${failures} failed)`);
process.exit(failures ? 1 : 0);
