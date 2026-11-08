'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { AuthCard, TextField, FormError, FormNotice, SubmitButton, AuthFooterLink, TextLink } from '@/components/auth/ui';

// Handles both stages: request a reset link (no token) and set a new password
// (deep-linked with ?token=...), mirroring the mobile reset flow.
export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = (params.get('token') || '').trim();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email) { setError('Enter your email.'); return; }
    setLoading(true);
    const { ok, data } = await postBff('/bff/auth/reset-request', { email });
    setLoading(false);
    if (ok) {
      setNotice('If an account exists for that email, a reset link is on its way.');
      return;
    }
    setError((data as any)?.error || 'Could not process the request.');
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { ok, data } = await postBff('/bff/auth/reset-confirm', { token, new_password: password });
    setLoading(false);
    if (ok) {
      router.replace('/login');
      return;
    }
    setError((data as any)?.error || 'Reset failed. Request a new link.');
  }

  if (token) {
    return (
      <AuthCard title="Set a new password" subtitle="Choose a new password for your account.">
        <form method="post" onSubmit={confirmReset} noValidate>
          <FormError message={error} />
          <TextField label="New password" name="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <SubmitButton loading={loading}>Update password</SubmitButton>
        </form>
        <AuthFooterLink><TextLink href="/login">Back to sign in</TextLink></AuthFooterLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="Enter your email and we will send a reset link.">
      <form method="post" onSubmit={requestReset} noValidate>
        <FormNotice message={notice} />
        <FormError message={error} />
        <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <SubmitButton loading={loading}>Send reset link</SubmitButton>
      </form>
      <AuthFooterLink><TextLink href="/login">Back to sign in</TextLink></AuthFooterLink>
    </AuthCard>
  );
}
