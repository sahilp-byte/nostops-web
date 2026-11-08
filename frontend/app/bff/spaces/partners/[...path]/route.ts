import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Phase 7 — Community Partner Network BFF. Forwards a fixed allow-list of paths to /api/spaces/partners/* as the
// signed-in user (identity from the session only). The backend enforces every role, locality and status rule.
const ALLOWED: [string, RegExp][] = [
  ['GET', /^mine$/], ['POST', /^mine$/], ['PATCH', /^mine$/], ['POST', /^mine\/documents$/], ['POST', /^mine\/submit$/],
  ['GET', /^dashboard$/], ['GET', /^discover\/(spaces|teachers)$/], ['GET', /^referrals$/], ['POST', /^referrals$/],
  ['GET', /^admin\/doc\/cpd_[a-f0-9]{16}$/], ['POST', /^admin\/cp_[a-f0-9]{16}\/decision\/(approve|reject|request_info)$/],
  ['PUT', /^admin\/cp_[a-f0-9]{16}\/localities$/], ['POST', /^admin\/cp_[a-f0-9]{16}\/partner\/(activate|suspend|deactivate)$/],
  ['POST', /^admin\/referrals\/cpr_[a-f0-9]{16}\/status$/],
];

async function forward(req: NextRequest, path: string[]) {
  const p = path.join('/');
  if (!ALLOWED.some(([m, rx]) => m === req.method && rx.test(p))) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (req.method !== 'GET' && badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = req.method === 'GET' ? undefined : await req.json().catch(() => ({}));
  const r = await spacesCall(`/partners/${p}`, { method: req.method, body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Something went wrong. Please try again.'), missing: r.data?.detail?.missing }, { status: r.status });
  return NextResponse.json(r.data);
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, { params }: Ctx) { return forward(req, (await params).path); }
export async function POST(req: NextRequest, { params }: Ctx) { return forward(req, (await params).path); }
export async function PATCH(req: NextRequest, { params }: Ctx) { return forward(req, (await params).path); }
export async function PUT(req: NextRequest, { params }: Ctx) { return forward(req, (await params).path); }
