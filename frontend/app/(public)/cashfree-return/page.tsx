import type { Metadata } from 'next';
import CashfreeReturn from '@/components/payments/CashfreeReturn';

export const metadata: Metadata = { title: 'Payment status', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Cashfree hosted-checkout return target (backend redirects here with ?order_id).
export default async function CashfreeReturnPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id } = await searchParams;
  return <CashfreeReturn orderId={order_id || ''} />;
}
