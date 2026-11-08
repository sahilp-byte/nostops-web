import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { TEACHER_SHARE_SENTENCE } from '@/lib/org/pricing';
import { SITE_URL } from '@/lib/site';
import { divertTestEmail } from '@/lib/server/test-tag';

// Sends the one-time welcome email to a brand-new teacher, right after signup.
// Guardrails: recipient + name come from the authenticated SESSION (never client
// input); the HTML is a fixed server-side template; links are absolute https to
// our own site; no forms/inputs; no credential asks; brand-only from_name.
// Best-effort and non-blocking — a failure never breaks the signup flow.
const EMAIL_BASE_URL = 'https://integrations.emergentagent.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (normalizeRole((user as any).role) !== 'teacher') return NextResponse.json({ ok: false });

  const key = process.env.EMERGENT_EMAIL_KEY;
  const fromName = process.env.EMAIL_FROM_NAME || 'NOSTOPS';
  const to = typeof (user as any).email === 'string' ? (user as any).email.trim() : '';
  // Best-effort: silently no-op if email isn't configured or we have no address.
  if (!key || !to.includes('@')) return NextResponse.json({ ok: false });

  const name = escapeHtml(String((user as any).name || 'Teacher'));
  const onboardingUrl = `${SITE_URL}/app/teacher/onboarding`;
  const html =
    `<table role="presentation" width="100%" style="max-width:560px;margin:0 auto"><tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">` +
    `<p style="font-size:18px;font-weight:bold;margin:0 0 8px">Welcome to the NOSTOPS cooperative, ${name} 🙏</p>` +
    `<p style="margin:0 0 12px;line-height:1.6">You’ve joined a teacher-first yoga cooperative — built to help you get recognised, discovered and empowered. ${TEACHER_SHARE_SENTENCE}</p>` +
    `<p style="margin:0 0 8px;line-height:1.6">Your one next step is to set up your teacher profile:</p>` +
    `<ul style="margin:0 0 14px;padding-left:20px;line-height:1.7;color:#334155">` +
    `<li>Your parampara (lineage) &amp; guru</li>` +
    `<li>The yoga styles &amp; specialisations you teach</li>` +
    `<li>A short bio in your own voice</li>` +
    `<li>Your public teacher page &amp; handle</li>` +
    `</ul>` +
    `<p style="margin:0 0 16px;line-height:1.6">It takes about 3–4 minutes, it’s free, and you can refine it anytime.</p>` +
    `<p style="margin:0 0 20px"><a href="${onboardingUrl}" style="background:#0D9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">Continue onboarding →</a></p>` +
    `<p style="font-size:12px;color:#64748b;margin:16px 0 0;line-height:1.5">Sent by ${escapeHtml(fromName)}. We never ask for your password or payment details by email.</p>` +
    `</td></tr></table>`;

  const subject = 'Welcome to NOSTOPS — let’s set up your teacher profile';
  // Prompt 2F — a signed test request's email goes to the test outbox, never to the provider.
  if (await divertTestEmail(req.headers, { to, subject, html, source: 'teacher-welcome' })) return NextResponse.json({ ok: true });
  try {
    const resp = await fetch(`${EMAIL_BASE_URL}/api/v1/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Email-Key': key },
      body: JSON.stringify({
        to: [to],
        subject,
        html,
        from_name: fromName,
      }),
    });
    return NextResponse.json({ ok: resp.ok });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
