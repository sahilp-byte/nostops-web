'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { AuthCard, TextField, FormError, FormNotice, SubmitButton, AuthFooterLink, TextLink, OrDivider, SocialSignIn } from '@/components/auth/ui';
import { initials } from '@/lib/format';
import { trackVenueGrowth } from '@/lib/venue-growth-client';

// Teacher-only onboarding/invitation auth. Role is HARD-LOCKED to 'teacher'
// (no selector) — the backend independently enforces the role via role_mismatch.
// On a fresh signup from a valid invite, redeems the referral code (idempotent,
// best-effort) then lands on the teacher dashboard (/app, fixed — no open redirect).
export default function TeacherJoinForm({
  referralCode,
  invitedBy,
  inviterAvatar,
  badCode,
}: {
  referralCode: string;
  invitedBy: string | null;
  inviterAvatar: string | null;
  badCode: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'register') {
      if (!name.trim()) { setError('Please enter your full name.'); return; }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    }
    setLoading(true);
    const { ok, status, data } = await postBff('/bff/auth/role', {
      mode,
      role: 'teacher',
      name: mode === 'register' ? name.trim() : undefined,
      email: email.trim().toLowerCase(),
      password,
    });
    if (!ok) {
      setLoading(false);
      if (status === 409 && (data as any)?.actual_role) {
        setError((data as any)?.error || 'This account isn’t a Yoga Teacher account — please use the sign-in for your role.');
        return;
      }
      setError((data as any)?.error || (mode === 'register' ? 'Sign up failed.' : 'Sign in failed.'));
      return;
    }
    // New teacher from a valid invite → record the referral (idempotent, best-effort).
    if (mode === 'register' && referralCode) {
      await postBff('/bff/teacher-referrals/redeem', { code: referralCode });
    }
    // Arrived from a venue's NOSTOPS invitation? Count a new vs existing teacher (best-effort).
    await trackVenueGrowth(mode === 'register' ? 'register_complete' : 'existing_signin');
    // Send the warm welcome email (best-effort, non-blocking — recipient derived
    // server-side from the new session).
    if (mode === 'register') {
      await postBff('/bff/teacher/welcome-email', {});
    }
    // MANDATORY PROFILE-FIRST: brand-new teachers go straight into the five-screen
    // onboarding wizard (creates their profile). Returning teachers → dashboard.
    router.replace(mode === 'register' ? '/app/teacher/onboarding' : '/app');
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      {/* Invitation banner */}
      {invitedBy && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-50 to-cream p-4" data-testid="invite-banner">
          {inviterAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inviterAvatar} alt={invitedBy} width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover" style={{ height: 44, width: 44 }} />
          ) : (
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-black text-brand-700">{initials(invitedBy)}</span>
          )}
          <p className="text-sm leading-snug text-ink">
            <span className="font-black">{invitedBy}</span> invited you to teach on <span className="font-black">NOSTOPS</span>
          </p>
        </div>
      )}

      <AuthCard title="Join as a Yoga Teacher" subtitle="Create your teacher account or sign in — keep 70–85% on eligible institutional programmes.">
        {badCode && <FormNotice message="We couldn’t verify that invite link, but you can still join as a teacher." />}

        {/* Role lock (informational; backend enforces the real role) */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-cream px-3.5 py-2.5">
          <span className="text-sm font-semibold text-ink-soft">Joining as</span>
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">🧘 Yoga Teacher</span>
        </div>

        {/* Signup / Login tabs */}
        <div className="mb-5 flex rounded-xl border border-line bg-cream p-1" role="tablist" aria-label="Auth mode">
          {(['register', 'login'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              data-testid={`join-tab-${m}`}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${mode === m ? 'bg-brand text-white shadow-sm' : 'text-ink-soft'}`}
            >
              {m === 'register' ? 'Sign up' : 'Sign in'}
            </button>
          ))}
        </div>

        <form method="post" onSubmit={onSubmit} noValidate>
          <FormError message={error} />
          {mode === 'register' && (
            <TextField label="Full name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <SubmitButton loading={loading}>{mode === 'register' ? 'Create teacher account' : 'Sign in'}</SubmitButton>
        </form>

        <OrDivider />
        <SocialSignIn />

        <AuthFooterLink>
          Not a teacher? <TextLink href="/">Explore NOSTOPS</TextLink>
        </AuthFooterLink>
      </AuthCard>
    </div>
  );
}
