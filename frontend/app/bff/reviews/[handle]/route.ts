import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Submit a public review for a teacher. Authenticated reviewers are auto-verified
// and published by the backend. Forwards to POST /public-reviews/{handle}.
export async function POST(req: NextRequest, ctx: { params: Promise<{ handle: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { handle } = await ctx.params;
  const body = await req.json().catch(() => null);

  const rating = Number(body?.rating);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const reviewerName = typeof body?.reviewer_name === 'string' ? body.reviewer_name.trim() : '';

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Please select a rating from 1 to 5 stars.' }, { status: 400 });
  }
  if (text.length < 10 || text.length > 500) {
    return NextResponse.json({ error: 'Your review must be between 10 and 500 characters.' }, { status: 400 });
  }
  if (reviewerName.length < 2 || reviewerName.length > 80) {
    return NextResponse.json({ error: 'Please enter your name (2–80 characters).' }, { status: 400 });
  }

  const up = await backendFetch(`/public-reviews/${encodeURIComponent(handle)}`, {
    method: 'POST',
    body: JSON.stringify({ rating, text, reviewer_name: reviewerName, reviewer_role: 'student' }),
  });
  if (!up.ok) {
    const d = await up.json().catch(() => null);
    return NextResponse.json(
      { error: toErrorText(d?.detail || d?.message, 'Could not submit your review.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
