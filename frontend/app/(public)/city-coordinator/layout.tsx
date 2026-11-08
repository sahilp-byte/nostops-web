import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

// "Become a City Coordinator" is TEMPORARILY DEACTIVATED (Phase 1). Delete this layout to re-enable.
export default function CityCoordinatorDeactivatedLayout({ children }: { children: ReactNode }) {
  notFound();
  return <>{children}</>;
}
