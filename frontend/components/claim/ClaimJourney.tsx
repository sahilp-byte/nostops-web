'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Stage 5C — interactive claim journey (rendered only for a valid invitation).
// Every backend action is an explicit button press → CSRF-protected BFF POST. No token, OTP or
// verification id is ever written to browser storage; the verification id lives in an httpOnly cookie.
type Op = 'claim' | 'link';
type Props = { token: string; signedIn: boolean; onStep: (n: number) => void };

const MSG: Record<string, string> = {
  invalid_link: 'This invitation link can’t be used any more. Please contact NOSTOPS support for a new one.',
  conflict: 'An account already exists for this email. Please sign in with that account to link your profile instead.',
  auth_required: 'Please sign in to your NOSTOPS account first.',
  ownership_failed: 'We couldn’t confirm this profile belongs to the signed-in account. You can verify with the phone number on your profile instead.',
  link_unavailable: 'Linking to an existing account isn’t available for this invitation yet. Please contact NOSTOPS support.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  otp_invalid: 'That code didn’t work or has expired. Please check it or request a new code.',
  password_invalid: 'Please choose a password between 8 and 128 characters.',
  confirm_required: 'Please confirm that this is your teaching profile.',
  unavailable: 'Our service is temporarily unavailable. Nothing has been changed. Please try again shortly.',
  failed: 'Something went wrong. Nothing has been changed. Please try again.',
};
const msg = (code?: string) => MSG[code || 'failed'] || MSG.failed;

const btn = 'inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-60';
const input = 'mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] focus:border-brand-700 focus:outline-none';

function Otp({ token, op, onVerified }: { token: string; op: Op; onVerified: () => void }) {
  const [phase, setPhase] = useState<'start' | 'sent' | 'review'>('start');
  const [masked, setMasked] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function request() {
    setBusy(true); setErr('');
    const r = await postBff(`/bff/teachers/claim/${token}/otp-request`, { operation: op });
    setBusy(false);
    if (!r.ok) return setErr(msg(r.data?.code));
    if (r.data?.status === 'manual_review') return setPhase('review');
    setMasked(r.data?.phone_masked || ''); setPhase('sent');
  }
  async function verify() {
    setBusy(true); setErr('');
    const r = await postBff(`/bff/teachers/claim/${token}/otp-verify`, { operation: op, code });
    setBusy(false); setCode('');
    if (!r.ok) return setErr(msg(r.data?.code));
    onVerified();
  }
  if (phase === 'review') {
    return <p className="rounded-xl bg-[#FFF4E5] p-4 text-sm text-ink-soft" data-testid="claim-otp-review">We need to check a few details by hand before you can continue. Please contact NOSTOPS support and we’ll help you.</p>;
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-4" data-testid="claim-otp">
      <p className="text-sm text-ink-soft">We’ll send a one-time code to the phone number already saved on your teaching profile.</p>
      {phase === 'start' ? (
        <button type="button" onClick={request} disabled={busy} className={`${btn} mt-3 bg-brand-700 text-white`} data-testid="claim-otp-request">{busy ? 'Sending…' : 'Send code'}</button>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-semibold text-brand-700" data-testid="claim-otp-masked">Code sent to {masked}</p>
          <label className="mt-3 block text-sm font-semibold text-brand-700">Enter the code
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className={input} data-testid="claim-otp-code" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={verify} disabled={busy || code.length < 4} className={`${btn} bg-brand-700 text-white`} data-testid="claim-otp-verify">{busy ? 'Checking…' : 'Verify code'}</button>
            <button type="button" onClick={request} disabled={busy} className={`${btn} border border-line bg-white text-brand-700`}>Send a new code</button>
          </div>
        </div>
      )}
      {err ? <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">{err}</p> : null}
    </div>
  );
}

export default function ClaimJourney({ token, signedIn, onStep }: Props) {
  const router = useRouter();
  const [path, setPath] = useState<'choose' | 'new' | 'existing'>('choose');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [phone, setPhone] = useState<'off' | 'open' | 'verified'>('off');
  const [email, setEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  function finish(next: string) { setDone(true); onStep(3); window.location.assign(next); }
  function choose(p: 'new' | 'existing') { setPath(p); setErr(''); setPhone('off'); setConfirm(false); onStep(1); }

  async function claim() {
    if (password !== password2) return setErr('The two passwords don’t match.');
    setBusy(true); setErr('');
    const r = await postBff(`/bff/teachers/claim/${token}/complete`, { password, confirm });
    setBusy(false);
    if (r.ok && r.data?.next) return finish(r.data.next);
    setErr(msg(r.data?.code));
  }
  async function link() {
    setBusy(true); setErr('');
    const r = await postBff(`/bff/teachers/claim/${token}/link`, { confirm });
    setBusy(false);
    if (r.ok && r.data?.next) return finish(r.data.next);
    setErr(msg(r.data?.code));
    if (r.data?.code === 'ownership_failed' && phone === 'off') setPhone('open');
  }
  async function signIn() {
    setBusy(true); setErr('');
    const r = await postBff('/bff/auth/login', { email, password: loginPw });
    setBusy(false); setLoginPw('');
    if (!r.ok) return setErr(r.data?.error || 'Sign-in failed. Please check your email and password.');
    router.refresh();
  }

  if (done) return <p className="rounded-2xl bg-brand-50 p-5 text-sm font-semibold text-brand-700" role="status" data-testid="claim-success">Your profile is ready. Opening your dashboard…</p>;

  const confirmBox = (
    <label className="mt-4 flex items-start gap-3 text-sm text-ink-soft">
      <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-5 w-5" data-testid="claim-confirm" />
      <span>I confirm this is my own teaching profile and I want to {path === 'new' ? 'claim it with a new NOSTOPS account' : 'link it to my signed-in NOSTOPS account'}.</span>
    </label>
  );
  const phoneBlock = phone === 'open'
    ? <div className="mt-4"><Otp token={token} op={path === 'new' ? 'claim' : 'link'} onVerified={() => { setPhone('verified'); setErr(''); }} /></div>
    : phone === 'verified'
      ? <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-700" data-testid="claim-otp-ok">Phone verified. Please finish within 10 minutes.</p>
      : <button type="button" onClick={() => setPhone('open')} className="mt-4 text-sm font-semibold text-brand-700 underline" data-testid="claim-use-phone">Verify with my phone instead</button>;

  return (
    <div className="font-['SP_Sans',system-ui,sans-serif]" data-testid="claim-journey">
      {path === 'choose' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => choose('new')} className={`${btn} bg-brand-700 py-3 text-white`} data-testid="claim-path-new">Create my NOSTOPS account</button>
          <button type="button" onClick={() => choose('existing')} className={`${btn} border border-brand-700 bg-white py-3 text-brand-700`} data-testid="claim-path-existing">I already have an account</button>
        </div>
      ) : (
        <button type="button" onClick={() => { setPath('choose'); setErr(''); }} className="text-sm font-semibold text-brand-700" data-testid="claim-back">← Back</button>
      )}

      {path === 'new' ? (
        <div className="mt-4" data-testid="claim-new">
          <label className="block text-sm font-semibold text-brand-700">Create a password
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} data-testid="claim-password" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-brand-700">Repeat the password
            <input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={input} data-testid="claim-password2" />
          </label>
          <p className="mt-1 text-xs text-muted">8 to 128 characters.</p>
          {confirmBox}
          {phoneBlock}
          <button type="button" onClick={claim} disabled={busy || !confirm || password.length < 8} className={`${btn} mt-5 w-full bg-accent text-white`} data-testid="claim-submit">{busy ? 'Claiming…' : 'Claim my profile'}</button>
        </div>
      ) : null}

      {path === 'existing' ? (
        <div className="mt-4" data-testid="claim-existing">
          {!signedIn ? (
            <div>
              <p className="text-sm text-ink-soft">Sign in with your existing NOSTOPS account.</p>
              <label className="mt-3 block text-sm font-semibold text-brand-700">Email
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} data-testid="claim-login-email" />
              </label>
              <label className="mt-3 block text-sm font-semibold text-brand-700">Password
                <input type="password" autoComplete="current-password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} className={input} data-testid="claim-login-password" />
              </label>
              <button type="button" onClick={signIn} disabled={busy || !email || !loginPw} className={`${btn} mt-4 w-full bg-brand-700 text-white`} data-testid="claim-login-submit">{busy ? 'Signing in…' : 'Sign in'}</button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink-soft">You’re signed in. Link this teaching profile to your account.</p>
              {confirmBox}
              {phoneBlock}
              <button type="button" onClick={link} disabled={busy || !confirm} className={`${btn} mt-5 w-full bg-accent text-white`} data-testid="claim-link-submit">{busy ? 'Linking…' : 'Link my profile'}</button>
            </div>
          )}
        </div>
      ) : null}
      {err ? <p className="mt-4 text-sm font-semibold text-rose-700" role="alert" data-testid="claim-error">{err}</p> : null}
    </div>
  );
}
