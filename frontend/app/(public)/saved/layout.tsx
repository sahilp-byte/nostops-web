import type { Metadata } from 'next';
import { canonical } from '@/lib/site';

// /saved is a client page (localStorage wishlist); this layout supplies its
// metadata — visitor-specific, so never indexed, with its own canonical.
export const metadata: Metadata = {
  title: 'Saved retreats',
  robots: { index: false, follow: true },
  alternates: { canonical: canonical('/saved') },
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
