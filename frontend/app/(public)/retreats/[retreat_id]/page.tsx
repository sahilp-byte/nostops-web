import { notFound, permanentRedirect } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { isPublicRetreatRecord, toPublicRetreat } from '@/lib/server/retreats';
import { retreatPath } from '@/lib/retreat-url';

// Legacy /retreats/{rt_id} → 301 (permanent) to the SEO city-nested slug URL
// /retreats/in/{city}/{slug}-{rt_id}. Preserves cohort/via invite query so any
// already-shared or indexed bare-id link keeps working and consolidates ranking
// onto the canonical URL.
export const revalidate = 900;

type Params = {
  params: Promise<{ retreat_id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyRetreatRedirect({ params, searchParams }: Params) {
  const { retreat_id } = await params;
  const sp = searchParams ? await searchParams : {};

  let raw: any = null;
  try {
    raw = await apiGet<any>(`/retreats/${retreat_id}`, { revalidate: 900 });
  } catch {
    raw = null;
  }
  if (!isPublicRetreatRecord(raw)) notFound();
  const r = toPublicRetreat(raw);
  if (!r) notFound();

  const qs = new URLSearchParams();
  const cohort = typeof sp.cohort === 'string' ? sp.cohort.slice(0, 120) : '';
  const via = typeof sp.via === 'string' ? sp.via.slice(0, 80) : '';
  if (cohort) qs.set('cohort', cohort);
  if (via) qs.set('via', via);
  const q = qs.toString();
  permanentRedirect(`${retreatPath(r)}${q ? `?${q}` : ''}`);
}
