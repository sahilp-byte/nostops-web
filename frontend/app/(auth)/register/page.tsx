import type { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = { title: 'Sign up as a Yoga Seeker', robots: { index: false, follow: false } };

// Self-serve sign-up for the Yoga Seeker (learner) persona. Teachers join via
// the dedicated /join journey; seekers create a standard account here.
export default function RegisterPage() {
  return <RegisterForm />;
}
