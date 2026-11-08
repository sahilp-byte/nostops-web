import type { Metadata } from 'next';
import { Suspense } from 'react';
import EmergentCallback from '@/components/auth/EmergentCallback';

export const metadata: Metadata = { title: 'Signing in', robots: { index: false, follow: false } };

export default function EmergentCallbackPage() {
  return (
    <Suspense fallback={null}>
      <EmergentCallback />
    </Suspense>
  );
}
