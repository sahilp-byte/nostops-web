import type { Metadata } from 'next';
import SpacesPage from '../page';
import { canonical } from '@/lib/site';

// Temporary isolated launch entry point (owner-authorised): the full Spaces discovery experience at /spaces/12345.
// A static segment, so it takes precedence over /spaces/[id] without changing any Space detail URL.
export const dynamic = 'force-dynamic';
const TITLE = 'NOSTOPS Spaces — yoga spaces in your neighbourhood';
const DESC = 'Find community halls, studios and neighbourhood spaces for yoga near your PIN code or locality, and the NOSTOPS teachers who live nearby.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: canonical('/spaces/12345') },
  openGraph: { title: TITLE, description: DESC, url: canonical('/spaces/12345'), type: 'website' },
  robots: { index: true, follow: true },
};

export default SpacesPage;
