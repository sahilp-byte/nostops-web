import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { CSRF_META, CSRF_SSR_HEADER } from '@/lib/session-cookie';

// Authenticated-adjacent auth flows. Never indexable.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Expose the CSRF token to the client via a <meta> tag (React 19 hoists it to
  // <head>). Robust for embedded webviews where document.cookie is restricted.
  const csrf = (await headers()).get(CSRF_SSR_HEADER) ?? '';
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {csrf && <meta name={CSRF_META} content={csrf} />}
      <main className="flex flex-1 items-center justify-center px-4 pb-24 pt-10 sm:pb-10">{children}</main>
      <footer className="border-t border-line/70 py-6 text-center text-xs text-muted">
        <p>Honouring the Teacher · Preserving the Tradition</p>
      </footer>
    </div>
  );
}
