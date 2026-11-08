'use client';

import { useEffect, useState } from 'react';
import { isPaymentTestHost } from '@/lib/payment-mode';

/** Returns true in the browser when this host can never take payments (preview). */
export function usePaymentsTestMode(): boolean {
  const [testMode, setTestMode] = useState(false);
  useEffect(() => {
    setTestMode(isPaymentTestHost(window.location.host));
  }, []);
  return testMode;
}
// The site-wide "Test mode" strip was removed at the owner's request; pay buttons still
// use this hook and stay disabled (with their own notice) on the preview.
