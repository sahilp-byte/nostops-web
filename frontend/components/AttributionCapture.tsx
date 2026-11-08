'use client';

import { useEffect } from 'react';
import { captureAttribution } from '@/lib/attribution';

// Records first-touch UTM / referrer / landing page once per visit (see
// lib/attribution). Renders nothing.
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
