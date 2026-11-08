import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getTotpStatus } from '@/lib/server/admin-totp';
import TotpPanel from '@/components/app/admin/TotpPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Security & 2FA', robots: { index: false, follow: false } };

export default async function AdminSecurityPage() {
  await requireAdminUser();
  const status = await getTotpStatus();

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Settings</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Security &amp; 2FA</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Add a second layer of protection to your administrator account with time-based one-time passcodes (TOTP) from an
        authenticator app.
      </p>
      <div className="mt-6">
        <TotpPanel initial={status} />
      </div>
    </div>
  );
}
