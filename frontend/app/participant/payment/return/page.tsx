import type { Metadata } from 'next';
import { confirmParticipantPayment } from '@/lib/server/participant';
import ParticipantPaymentReturn from '@/components/participant/ParticipantPaymentReturn';

export const metadata: Metadata = {
  title: 'Payment status · NOSTOPS',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

// Cashfree hosted-checkout return target for PAID institutional registrations.
// Confirm server-side first (survives blocked cross-site cookies), then let the
// client poll only if the gateway is still processing.
export default async function ParticipantPaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;
  const orderId = order_id || '';
  const { status, confirmed } = orderId
    ? await confirmParticipantPayment(orderId).catch(() => ({ status: 'UNKNOWN', confirmed: false }))
    : { status: 'UNKNOWN', confirmed: false };
  return <ParticipantPaymentReturn orderId={orderId} initialStatus={status} initialConfirmed={confirmed} />;
}
