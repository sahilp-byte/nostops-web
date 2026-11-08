'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { AuthCard, TextField, FormError, SubmitButton, AuthFooterLink, TextLink, SocialSignIn, OrDivider } from '@/components/auth/ui';

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { ok, data } = await postBff('/bff/auth/register', { name, email, password });
    setLoading(false);
    if (ok) {
      if ((data as any)?.authenticated) {
        router.replace('/app?welcome=1');
      } else {
        router.replace('/login');
      }
      router.refresh();
      return;
    }
    setError((data as any)?.error || 'Registration failed.');
  }

  return (
    <AuthCard title="Create your account" subtitle="Join NOSTOPS as a Yoga Seeker.">
      <form method="post" onSubmit={onSubmit} noValidate>
        <FormError message={error} />
        <TextField label="Full name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <SubmitButton loading={loading}>Create account</SubmitButton>
      </form>
      <OrDivider />
      <SocialSignIn />
      <AuthFooterLink>
        Already have an account? <TextLink href="/login">Sign in</TextLink>
      </AuthFooterLink>
    </AuthCard>
  );
}
