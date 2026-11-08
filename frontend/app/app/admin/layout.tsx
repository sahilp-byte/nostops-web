import type { ReactNode } from 'react';
import { requireAdminUser } from '@/lib/server/admin-guard';

// Defense-in-depth: a SINGLE server-side admin gate covering EVERY /app/admin/*
// route. Even if an individual admin page forgets its own check, a non-admin can
// never render an admin screen — they are redirected before any admin data loads.
// Backend authorization remains the authoritative layer; this is the web's own
// independent enforcement.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminUser();
  return <>{children}</>;
}
