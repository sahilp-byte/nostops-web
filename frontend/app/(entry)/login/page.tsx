import type { Metadata } from 'next';
import { Suspense } from 'react';
import Image from 'next/image';
import LoginPanel from '@/components/auth/LoginPanel';
import { kalam } from '@/components/home/fonts';

export const metadata: Metadata = { title: 'Log in', robots: { index: false, follow: false } };

// Separate Login page: landscape hero (no people) + one panel with Mobile OTP (India) and
// Email / Password (everyone). Every persona lands on its own dashboard via /app role routing.
export default function LoginPage() {
  return (
    <div className="relative overflow-hidden" data-testid="login-page">
      <div className="absolute inset-x-0 top-0 h-[420px] sm:h-[480px]">
        <Image src="/brand/auth/login-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FCFAF6]/40 via-[#FCFAF6]/30 to-[#FCFAF6]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FCFAF6]/90 via-[#FCFAF6]/40 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-4xl font-black tracking-tight text-[#0E3D3B] sm:text-5xl" data-testid="login-heading">Welcome Back</h1>
            <p className="mt-3 text-xl font-bold text-[#0F5E5A] sm:text-2xl">Login to your NOSTOPS account</p>
            <p className="mt-2 text-base text-[#3E5553] sm:text-lg">Access your dashboard, manage your profile and continue your journey.</p>
          </div>
          <p aria-hidden="true" className={`${kalam.className} hidden -rotate-6 text-right text-3xl leading-tight text-[#0F5E5A] md:block`}>
            People<br />Purpose<br />Progress
            <span className="mt-1 block h-1 w-28 translate-x-6 rounded-full bg-gradient-to-r from-[#F07A1A] to-transparent" />
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-xl sm:mt-10">
          <Suspense fallback={<div className="h-[420px] rounded-3xl bg-white shadow-xl" />}>
            <LoginPanel />
          </Suspense>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[#3E5553]" data-testid="login-secure-note">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0F5E5A]" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" strokeLinejoin="round" />
              <path d="m8.8 12.2 2.2 2.2 4.2-4.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Your data is secure with NOSTOPS
          </p>
        </div>
      </div>
    </div>
  );
}
