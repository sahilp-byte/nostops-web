'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { AuthCard, TextField, FormError, SubmitButton, AuthFooterLink, TextLink } from '@/components/auth/ui';

const ROLES: { key: string; label: string }[] = [
  { key: 'teacher', label: 'Yoga Teacher' },
  { key: 'hr', label: 'Workplace / HR' },
  { key: 'coordinator', label: 'City Coordinator' },
];

export default function ChooseRoleForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<string>((params.get('role') || 'teacher').toLowerCase());
  const [mode, setMode] = useState<'login' | 'register'>((params.get('mode') as any) === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && !name) { setError('Please enter your full name.'); return; }
    setLoading(true);
    const { ok, status, data } = await postBff('/bff/auth/role', { mode, role, name, email, password });
    setLoading(false);
    if (ok) {
      router.replace('/app');
      router.refresh();
      return;
    }
    if (status === 409 && (data as any)?.actual_role) {
      setRole(String((data as any).actual_role).toLowerCase());
      setMode('login');
      setError((data as any)?.error || 'Please use the correct login for your account.');
      return;
    }
    setError((data as any)?.error || 'Something went wrong. Please try again.');
  }

  return (
    <AuthCard
      title={mode === 'register' ? 'Sign up by role' : 'Sign in by role'}
      subtitle="For teachers, workplace leads and city coordinators."
    >
      <div className="mb-5 flex rounded-xl border border-line bg-cream p-1" role="tablist" aria-label="Auth mode">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold capitalize transition ${mode === m ? 'bg-brand text-white shadow-sm' : 'text-ink-soft'}`}
          >
            {m === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <label htmlFor="role" className="mb-1.5 block text-sm font-semibold text-ink-soft">I am a</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-50"
        >
          {ROLES.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>

      <form method="post" onSubmit={onSubmit} noValidate>
        <FormError message={error} />
        {mode === 'register' && (
          <TextField label="Full name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
        <SubmitButton loading={loading}>{mode === 'register' ? 'Create account' : 'Sign in'}</SubmitButton>
      </form>

      <AuthFooterLink>
        Yoga seeker? <TextLink href="/login">Use the standard sign in</TextLink>
      </AuthFooterLink>
    </AuthCard>
  );
}
