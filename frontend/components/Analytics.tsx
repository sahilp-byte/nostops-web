'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { isClaimPath } from '@/lib/teacher-claim';

// GA4 site-wide tag. Activates only when NEXT_PUBLIC_GA_ID is set (e.g.
// G-XXXXXXXXXX), so it stays inert in dev/preview until a real property is
// configured. Loaded after hydration so it never blocks first paint / SEO.
// Never loaded on /teachers/claim/* (single-use claim tokens live in that URL).
export default function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  const pathname = usePathname();
  if (!id || isClaimPath(pathname)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
