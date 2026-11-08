import type { Metadata } from 'next';

// The result page is a client component, so its metadata lives here.
// Payment-status utility page: never indexed, links not followed.
export const metadata: Metadata = {
  title: { absolute: 'Payment Status · AI-Assisted Venue Onboarding · NOSTOPS' },
  robots: { index: false, follow: false },
};

export default function AiOnboardingResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
