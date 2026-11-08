import type { Metadata } from 'next';
import SignupPersonaPage from '@/components/auth/SignupPersonaPage';

export const metadata: Metadata = { title: 'Sign up', robots: { index: false, follow: false } };

// Single sign-up entry point: Yoga Teacher and Yoga Seeker first, then every other existing pathway.
// ?role=seeker|teacher (also organisation|participant|coordinator) highlights the matching card.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = (await searchParams).role;
  return <SignupPersonaPage preselect={role} />;
}
