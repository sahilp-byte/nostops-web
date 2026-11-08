import type { Metadata } from 'next';
import { headers } from 'next/headers';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { CSRF_META, CSRF_SSR_HEADER } from '@/lib/session-cookie';

// Sign Up (persona selection) and Login: full-width branded pages with the normal site header
// and footer. Never indexable. The CSRF token is exposed via <meta> exactly like the (auth) group.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EntryLayout({ children }: { children: React.ReactNode }) {
  const csrf = (await headers()).get(CSRF_SSR_HEADER) ?? '';
  return (
    <>
      {csrf && <meta name={CSRF_META} content={csrf} />}
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="-mb-24 bg-[#FCFAF6] pb-8 outline-none">{children}</main>
      <SiteFooter />
    </>
  );
}
