import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyCertificate } from '@/lib/server/institutional';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Verify certificate · NOSTOPS',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ code: string }> };

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

export default async function VerifyCertificatePage({ params }: Params) {
  const { code } = await params;
  const v = await verifyCertificate(code);

  return (
    <div className="container-x py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-brand-700">NOSTOPS Certificate Verification</p>
        </div>

        {v.valid ? (
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm" data-testid="verify-valid">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-4xl">✓</div>
              <h1 className="mt-3 text-xl font-black text-ink">Genuine certificate</h1>
              <p className="mt-1 text-sm text-ink-soft">This is an authentic NOSTOPS certificate of participation.</p>
            </div>
            <div className="mt-5">
              <Row label="Participant" value={v.participant_name} />
              <Row label="Programme" value={v.event_title} />
              <Row label="Curriculum" value={v.programme_name ? `${v.programme_name}${v.programme_taxonomy_label ? ` · ${v.programme_taxonomy_label}` : ''}` : null} />
              <Row label="Date" value={v.event_date} />
              <Row label="City" value={v.city} />
              <Row label="Organiser" value={v.organisation_name} />
              <Row label="Facilitated by" value={v.teacher_name} />
              <Row label="Attendance" value={v.attended ? 'Marked present' : 'Registered'} />
              <Row label="Reference" value={v.reference} />
            </div>
            <p className="mt-5 rounded-xl bg-brand-50 px-3 py-2 text-center text-xs font-semibold text-brand-700">
              Issued by {v.organisation_name || 'the organiser'} in partnership with NOSTOPS
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-sm" data-testid="verify-invalid">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cream text-4xl">🔍</div>
            <h1 className="mt-3 text-xl font-black text-ink">Certificate not found</h1>
            <p className="mt-1 text-sm text-ink-soft">
              We couldn&apos;t verify a certificate with this code. Please check the reference or scan the QR code again.
            </p>
            <Link href="/" className="mt-5 inline-block text-sm font-bold text-brand-700 hover:underline">Go to NOSTOPS →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
