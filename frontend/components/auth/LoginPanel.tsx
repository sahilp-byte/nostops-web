'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { FormError, FormNotice, OrDivider, SocialSignIn } from '@/components/auth/ui';
import { safeNextPath } from '@/lib/safe-next';

// One login panel for EVERY existing persona (seeker, teacher, organisation/HR, coordinator,
// council, admin). Mobile OTP = Indian (+91) numbers already on an account; Email / Password =
// everyone. After sign-in the browser goes to `next` (default /app), and /app routes each account
// to its own dashboard from the role already on the account — no persona question.
const RESEND_SECONDS = 30;

type Method = 'otp' | 'email';

const inputCls =
  'min-h-[48px] w-full rounded-xl border border-[#DCE3E1] bg-white px-4 py-3 text-[15px] text-[#0E3D3B] outline-none transition placeholder:text-[#8A9896] focus:border-[#0F5E5A] focus:ring-2 focus:ring-[#0F5E5A]/15';
const labelCls = 'mb-1.5 block text-sm font-bold text-[#0E3D3B]';

const Arrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.64l-3.22-3.22a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
  </svg>
);

function PrimaryButton({ loading, children, tone, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; tone: 'saffron' | 'teal' }) {
  return (
    <button
      type="submit"
      disabled={loading || rest.disabled}
      className={`flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === 'saffron' ? 'bg-[#F07A1A] hover:bg-[#DD6A0E]' : 'bg-[#0F5E5A] hover:bg-[#0B4A47]'
      }`}
      {...rest}
    >
      {loading ? 'Please wait…' : <>{children} <Arrow /></>}
    </button>
  );
}

function Tab({ active, onClick, title, sub, icon, testid }: { active: boolean; onClick: () => void; title: string; sub: string; icon: React.ReactNode; testid: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testid}
      className={`flex min-h-[64px] flex-1 items-center gap-3 rounded-t-2xl border-b-[3px] px-3 py-3 text-left transition sm:px-5 ${
        active ? 'border-[#0F5E5A] bg-white' : 'border-transparent bg-[#F3F6F5] hover:bg-[#EAF0EE]'
      }`}
    >
      <span className={active ? 'text-[#0F5E5A]' : 'text-[#6B7C7A]'}>{icon}</span>
      <span className="leading-tight">
        <span className={`block whitespace-nowrap text-sm font-black sm:text-[15px] ${active ? 'text-[#0E3D3B]' : 'text-[#3E5553]'}`}>{title}</span>
        <span className="block text-xs text-[#6B7C7A]">{sub}</span>
      </span>
    </button>
  );
}

function OtpLogin({ next }: { next: string }) {
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inFlight = useRef(false);
  const phone = `+91${digits}`;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(isResend = false) {
    if (inFlight.current) return;
    setError(null);
    setNotice(null);
    setNoAccount(false);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter your 10-digit Indian mobile number.');
      return;
    }
    inFlight.current = true;
    setLoading(true);
    const { ok, status, data } = await postBff('/bff/auth/otp-start', { phone, channel: 'sms' });
    inFlight.current = false;
    setLoading(false);
    const d = data as any;
    if (ok) {
      setStage('code');
      setCode('');
      setCooldown(RESEND_SECONDS);
      setNotice(isResend ? `A new code was sent to ${phone}.` : `We sent a one-time password to ${phone}.`);
      return;
    }
    if (status === 404 && d?.no_account) setNoAccount(true);
    if (status === 429 && typeof d?.retry_after === 'number') setCooldown(d.retry_after);
    setError(d?.error || 'Could not send the OTP. Please try again.');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);
    if (!/^\d{4,6}$/.test(code)) {
      setError('Enter the code we sent to your phone.');
      return;
    }
    inFlight.current = true;
    setLoading(true);
    const { ok, data } = await postBff('/bff/auth/otp-verify', { phone, code });
    if (ok) {
      window.location.assign(next);
      return;
    }
    inFlight.current = false;
    setLoading(false);
    setError((data as any)?.error || 'That code is incorrect or has expired. Try again or resend.');
  }

  if (stage === 'phone') {
    return (
      <form method="post" noValidate onSubmit={(e) => { e.preventDefault(); send(); }} data-testid="otp-phone-form">
        <FormError message={error} />
        {noAccount && (
          <p className="-mt-2 mb-4 text-sm text-[#3E5553]">
            New to NOSTOPS? <Link href="/signup" className="inline-flex min-h-[44px] items-center font-bold text-[#0F5E5A] hover:underline">Create an account</Link>
          </p>
        )}
        <label htmlFor="otp-phone" className={labelCls}>Mobile Number</label>
        <div className="flex">
          <span className="flex min-h-[48px] items-center gap-1.5 rounded-l-xl border border-r-0 border-[#DCE3E1] bg-[#F7F9F8] px-3 text-[15px] font-bold text-[#0E3D3B]">
            <span aria-hidden="true">🇮🇳</span> +91
          </span>
          <input
            id="otp-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="Enter your registered mobile number"
            maxLength={10}
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className={`${inputCls} rounded-l-none`}
            data-testid="otp-phone-input"
          />
        </div>
        <div className="mt-4">
          <PrimaryButton tone="saffron" loading={loading} disabled={cooldown > 0} data-testid="otp-send">
            {cooldown > 0 ? `Send OTP (${cooldown}s)` : 'Send OTP'}
          </PrimaryButton>
        </div>
        <p className="mt-2 text-center text-xs text-[#6B7C7A]">We will send a one-time password (OTP) to your mobile number.</p>
      </form>
    );
  }

  return (
    <form method="post" noValidate onSubmit={verify} data-testid="otp-code-form">
      <FormNotice message={notice} />
      <FormError message={error} />
      <label htmlFor="otp-code" className={labelCls}>One-time password</label>
      <input
        id="otp-code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="Enter the 6-digit code"
        maxLength={6}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className={`${inputCls} tracking-[0.3em]`}
        data-testid="otp-code-input"
      />
      <div className="mt-4">
        <PrimaryButton tone="teal" loading={loading} data-testid="otp-verify">Verify &amp; Login</PrimaryButton>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => { setStage('phone'); setCode(''); setError(null); setNotice(null); }}
          className="min-h-[44px] font-semibold text-[#6B7C7A] hover:text-[#0F5E5A]"
          data-testid="otp-change-number"
        >
          Change number
        </button>
        <button
          type="button"
          onClick={() => send(true)}
          disabled={cooldown > 0 || loading}
          className="min-h-[44px] font-bold text-[#0F5E5A] hover:underline disabled:cursor-not-allowed disabled:text-[#8A9896] disabled:no-underline"
          data-testid="otp-resend"
        >
          {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
        </button>
      </div>
    </form>
  );
}

function EmailLogin({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Only one sign-in request in flight (double-click / Enter-repeat).
  const inFlight = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setLoading(true);
    const { ok, status, data } = await postBff('/bff/auth/login', { email: email.trim().toLowerCase(), password });
    if (ok) {
      // Full navigation: a cached client redirect for `next` would bounce back to /login.
      window.location.assign(next);
      return;
    }
    inFlight.current = false;
    setLoading(false);
    setError(
      (data as any)?.error ||
        (status >= 500 ? 'Sign-in is temporarily unavailable. Please try again in a few minutes.' : 'Login failed. Check your email and password.'),
    );
  }

  return (
    <>
      <form method="post" onSubmit={onSubmit} noValidate data-testid="email-login-form">
        <FormError message={error} />
        <label htmlFor="email" className={labelCls}>Email Address</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="Enter your email address"
          value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        <label htmlFor="password" className={`${labelCls} mt-4`}>Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-12`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            aria-pressed={show}
            className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-[#6B7C7A] hover:text-[#0F5E5A]"
            data-testid="password-toggle"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {show && <path d="M4 4l16 16" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
        <div className="mt-2 text-right">
          <Link href="/reset-password" className="inline-flex min-h-[44px] items-center text-sm font-bold text-[#0F5E5A] hover:underline" data-testid="forgot-password">
            Forgot password?
          </Link>
        </div>
        <PrimaryButton tone="teal" loading={loading} data-testid="email-login-submit">Login</PrimaryButton>
      </form>
      <OrDivider />
      <SocialSignIn next={next} />
    </>
  );
}

export default function LoginPanel() {
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [method, setMethod] = useState<Method>(params.get('method') === 'email' ? 'email' : 'otp');
  const reauth = params.get('reauth') === '1';
  const signupHref = /(?:\/teachers\/|\/book|\/discover|\/wellness)/.test(next) ? '/signup?role=seeker' : '/signup';

  return (
    <div className="overflow-hidden rounded-3xl border border-[#EDE6DA] bg-white shadow-[0_20px_60px_-25px_rgba(14,61,59,0.45)]" data-testid="login-panel">
      <div role="tablist" aria-label="How would you like to log in?" className="flex gap-1 bg-[#F3F6F5] px-2 pt-2">
        <Tab
          active={method === 'otp'}
          onClick={() => setMethod('otp')}
          title="Mobile OTP"
          sub="For Indian users"
          testid="login-tab-otp"
          icon={<svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" strokeLinecap="round" /></svg>}
        />
        <Tab
          active={method === 'email'}
          onClick={() => setMethod('email')}
          title="Email / Password"
          sub="For all users"
          testid="login-tab-email"
          icon={<svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3 6 9 7 9-7" strokeLinejoin="round" /></svg>}
        />
      </div>
      <div className="p-6 sm:p-8" role="tabpanel">
        {reauth && (
          <FormNotice message="For your security, please log in again — it has been more than 30 days since your last visit." />
        )}
        {method === 'otp' ? <OtpLogin next={next} /> : <EmailLogin next={next} />}
        <p className="mt-6 text-center text-sm text-[#3E5553]">
          {method === 'otp' ? (
            <>Outside India or no mobile on your account?{' '}
              <button type="button" onClick={() => setMethod('email')} className="inline-flex min-h-[44px] items-center font-bold text-[#0F5E5A] hover:underline">Use email</button></>
          ) : (
            <>New to NOSTOPS? <Link href={signupHref} className="inline-flex min-h-[44px] items-center font-bold text-[#0F5E5A] hover:underline" data-testid="login-signup-link">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
