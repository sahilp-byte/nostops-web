// Shared public-site navigation config (single source for the header and the
// footer organisation links so labels/destinations can never drift).
import type { NavEntry } from '@/components/HeaderNav';

export const ORG_COHORTS = [
  { href: '/for-organisations/companies', label: 'Companies', desc: 'Corporate yoga & workplace wellness' },
  { href: '/for-organisations/educational-institutions', label: 'Educational Institutions', desc: 'Yoga for students & faculty' },
  { href: '/for-organisations/startup-networking-groups', label: 'Startup & Networking Groups', desc: 'Founder & team wellbeing' },
];

// ── PLATFORM-WIDE APPROVED HEADER NAVIGATION ─────────────────────────────────
// Exactly six top-level items, in this order (account controls live separately).
export const HEADER_NAV: NavEntry[] = [
  { href: '/teachers', label: 'Teachers Network' },
  { href: '/retreats/host', label: 'Host your Retreat', match: '/retreats' },
  { href: '/venues', label: 'Venues' },
  { href: '/list-your-venue', label: 'List your Venue' },
  { label: 'For Organisations', href: '/for-organisations', children: ORG_COHORTS },
  { href: '/about', label: 'About' },
];

// NOSTOPS Spaces section only: the same approved items with "Spaces" shown (and highlighted)
// between "List your Venue" and "For Organisations", as in the Spaces reference designs.
export const SPACES_HEADER_NAV: NavEntry[] = [
  ...HEADER_NAV.slice(0, 4),
  { href: '/spaces', label: 'Spaces', match: '/spaces' },
  ...HEADER_NAV.slice(4),
];
