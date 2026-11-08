'use client';

import Link from 'next/link';
import { AUTH_NEXT_KEY } from '@/lib/safe-next';
import Image from 'next/image';
import { forwardRef } from 'react';

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card w-full max-w-md p-7 shadow-sm sm:p-8">
      <Link href="/" aria-label="NOSTOPS home" className="mb-5 flex flex-col items-center">
        <Image src="/brand/nostops-logo.png" alt="NOSTOPS" width={139} height={40} priority className="h-9 w-auto" />
        <span className="mt-1 text-[11px] font-semibold text-muted">A Teacher&apos;s First Yoga Cooperative</span>
      </Link>
      <h1 className="text-2xl font-black tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, id, ...props },
  ref,
) {
  const fieldId = id || props.name || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-4">
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-50"
        {...props}
      />
    </div>
  );
});

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

export function FormNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="mb-4 rounded-lg border border-brand/20 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
      {message}
    </p>
  );
}

export function SubmitButton({
  loading,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}

export function AuthFooterLink({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-center text-sm text-muted">{children}</p>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-bold text-brand-700 hover:underline">
      {children}
    </Link>
  );
}

/** Emergent-managed Google / Apple social login button. Redirects the whole
 *  window to the Emergent auth page; the callback route exchanges session_id.
 *  `next` (already validated by the caller) is kept for the callback in this
 *  tab's sessionStorage; buttons without one clear any stale value. */
export function SocialSignIn({ next }: { next?: string }) {
  function start() {
    try {
      if (next && next !== '/app') sessionStorage.setItem(AUTH_NEXT_KEY, next);
      else sessionStorage.removeItem(AUTH_NEXT_KEY);
    } catch { /* storage blocked: callback falls back to /app */ }
    const callback = `${window.location.origin}/emergent-callback`;
    const url = new URL('https://auth.emergentagent.com/');
    url.searchParams.set('redirect', callback);
    window.location.assign(url.toString());
  }
  return (
    <button
      type="button"
      onClick={start}
      className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream"
    >
      Continue with Google or Apple
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
