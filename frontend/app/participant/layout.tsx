import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

// Participant area chrome. Always noindex (private, per-participant data).
export const metadata: Metadata = {
  title: 'My Programmes · NOSTOPS',
  robots: { index: false, follow: false },
};

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
