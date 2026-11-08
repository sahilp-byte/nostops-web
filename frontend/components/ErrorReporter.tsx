'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error';

// Catches uncaught browser errors and unhandled promise rejections on every
// page and reports them to the Error Monitor. Renders nothing.
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => reportClientError(ev.error || ev.message, 'window.onerror');
    const onRejection = (ev: PromiseRejectionEvent) => reportClientError(ev.reason || 'Unhandled rejection', 'unhandledrejection');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
