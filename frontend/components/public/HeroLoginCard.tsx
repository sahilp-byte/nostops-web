'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';
import { SocialSignIn } from '@/components/auth/ui';

// Compact "Welcome Back" login card for the public homepage hero. It is NOT a
// separate auth system — it calls the SAME BFF endpoint as the full /login page
// (POST /bff/auth/login → httpOnly session cookie) and the SAME signup /
// reset-password routes. Kept visually in line with the approved hero mockup.
export default function HeroLoginCard({ idPrefix = 'hero' }: { idPrefix?: string }) {
  const router = useRouter();
  const variant = idPrefix.endsWith('-m') ? 'mobile' : 'desktop';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data } = await postBff('/bff/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (ok) {
      router.replace('/app');
      router.refresh();
      return;
    }
    setError((data as { error?: string })?.error || 'Login failed. Check your email and password.');
  }

  return (
    <div className="card w-full max-w-sm p-6 shadow-xl ring-1 ring-black/5 sm:p-7" data-testid={`hero-login-card-${variant}`}>
      <h2 className="text-xl font-black tracking-tight text-ink">Welcome Back</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">Log in to continue your journey as a yoga teacher.</p>

      <form method="post" onSubmit={onSubmit} noValidate className="mt-5">
        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <label htmlFor={`${idPrefix}-email`} className="sr-only">Email address</label>
        <div className="relative mb-3">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-[46px] w-full rounded-xl border border-line bg-white pl-10 pr-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand-50"
          />
        </div>

        <label htmlFor={`${idPrefix}-password`} className="sr-only">Password</label>
        <div className="relative mb-4">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          <input
            id={`${idPrefix}-password`}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[46px] w-full rounded-xl border border-line bg-white pl-10 pr-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          data-testid={`hero-login-submit-${variant}`}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Please wait…' : 'Log in'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <SocialSignIn />

      <button
        type="button"
        onClick={() => router.push('/login?method=otp')}
        data-testid={`hero-otp-${variant}`}
        className="mt-3 flex min-h-[46px] w-full items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream"
      >
        Sign in with phone (OTP)
      </button>

      <Link
        href="/signup"
        data-testid={`hero-create-account-${variant}`}
        className="mt-3 flex min-h-[46px] w-full items-center justify-center rounded-xl border border-brand/40 bg-white px-4 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
      >
        Create an account
      </Link>

      <div className="mt-3 text-center">
        <Link href="/reset-password" className="text-sm font-bold text-brand-700 hover:underline">
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}
