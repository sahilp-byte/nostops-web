import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

// City Coordinator is TEMPORARILY DEACTIVATED (Phase 1, owner instruction). Every
// /app/coordinator/* screen (apply, agreement, roster, institutional) redirects away.
// Records (coordinator_applications, inst_city_coordinator_assignments) and backend
// modules are preserved — delete this layout to re-enable.
export default function CoordinatorDeactivatedLayout({ children }: { children: ReactNode }) {
  redirect('/app');
  return <>{children}</>;
}
