import type { PublicTeacher } from '@/lib/teacher';

// Shared by /spaces search results and /spaces/locality/[lid]: listed teachers whose city matches the
// district (or a locality/taluk name) of the searched area. Display matching only — never identity.
const ALIASES: Record<string, string[]> = {
  bangalore: ['bengaluru'], bengaluru: ['bangalore'], gurgaon: ['gurugram'], gurugram: ['gurgaon'], mumbai: ['bombay'],
  mysore: ['mysuru'], mangalore: ['mangaluru'], trivandrum: ['thiruvananthapuram'], thiruvananthapuram: ['trivandrum'],
  pondicherry: ['puducherry'], puducherry: ['pondicherry'], cochin: ['kochi'], ernakulam: ['kochi', 'cochin'], kolkata: ['calcutta'], chennai: ['madras'],
};
const norm = (s: string) => s.toLowerCase().replace(/\b(rural|urban|city|district)\b/g, '').replace(/[^a-z]/g, '');

export function nearbyTeachers(all: PublicTeacher[], district: string, state: string, places: string[], onlyVerified = false): PublicTeacher[] {
  const keys = new Set<string>();
  for (const raw of [district, ...places]) {
    const k = norm(raw || '');
    if (k.length < 3) continue;
    keys.add(k);
    for (const a of ALIASES[k] || []) keys.add(a);
  }
  if (state === 'Delhi') ['delhi', 'newdelhi'].forEach((k) => keys.add(k));
  return all.filter((t) => t.city && keys.has(norm(t.city)) && (!onlyVerified || t.isVerified)).slice(0, 12);
}
