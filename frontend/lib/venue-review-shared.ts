// Client-safe shared types + constants for the Venue Quality & Verification
// Console. Kept free of any server-only imports (no next/headers) so client
// components can import STATUS_META / QUEUE_BUCKETS without dragging the server
// data layer into the browser bundle.

// PROMPT 22 / 32 — the venue submission + visibility lifecycle.
export type ReviewStatus =
  | 'submitted'
  | 'under_review'
  | 'needs_information'
  | 'approved'
  | 'published'
  | 'hidden'
  | 'rejected'
  | 'duplicate'
  | 'archived';

export type SubmitterType = 'owner' | 'manager' | 'host' | 'teacher' | 'business' | 'organisation' | 'community';

export const STATUS_META: Record<ReviewStatus, { label: string; badge: string }> = {
  submitted: { label: 'New submission', badge: 'bg-accent/10 text-accent-600' },
  under_review: { label: 'Under review', badge: 'bg-brand-50 text-brand-700' },
  needs_information: { label: 'Needs information', badge: 'bg-accent/15 text-accent-600' },
  approved: { label: 'Approved', badge: 'bg-brand-50 text-brand-700' },
  published: { label: 'Published', badge: 'bg-brand text-white' },
  hidden: { label: 'Temporarily hidden', badge: 'bg-royal-50 text-royal' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' },
  duplicate: { label: 'Duplicate', badge: 'bg-cream text-ink-soft' },
  archived: { label: 'Archived', badge: 'bg-cream text-muted' },
};

// PROMPT 23 — the admin queue buckets, in display order.
export const QUEUE_BUCKETS: { status: ReviewStatus; title: string }[] = [
  { status: 'submitted', title: 'New submissions' },
  { status: 'under_review', title: 'Pending reviews' },
  { status: 'needs_information', title: 'Needs information' },
  { status: 'approved', title: 'Recently approved' },
  { status: 'rejected', title: 'Recently rejected' },
  { status: 'duplicate', title: 'Potential duplicates' },
  { status: 'hidden', title: 'Temporarily hidden' },
  { status: 'archived', title: 'Archived venues' },
  { status: 'published', title: 'Published venues' },
];

export type VenueReviewRow = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  venueType?: string;
  status: ReviewStatus;
  source: 'submission' | 'published';
  submitterType?: SubmitterType;
  submitterName?: string;
  submittedAt?: string;
  website?: string;
  address?: string;
  verificationStatus?: string;
  claimed?: boolean;
  coverImage?: string | null;
  updatedAt?: string;
  /** Owner changes to a LIVE venue awaiting admin review. */
  hasPendingChanges?: boolean;
};

/** Owner changes to a live venue, waiting next to the live listing for review. */
export type PendingChanges = {
  fields: Record<string, unknown>;
  changed: string[];
  actor?: string;
  actorType?: string;
  aiFields: string[];
  submittedAt?: string;
  version?: number;
};

/** One entry of a venue's version history (applied = was the listing; proposed = owner changes). */
export type VenueRevision = {
  id: string;
  version: number;
  kind: 'applied' | 'proposed';
  action: string;
  state?: string | null;
  actor?: string;
  actorType?: string;
  changed: string[];
  aiFields: string[];
  fields: Record<string, unknown>;
  note?: string;
  createdAt?: string;
  decidedBy?: string;
  decisionNote?: string;
};

/** Readable labels for the venue listing fields used in diffs + history. */
export const VENUE_FIELD_LABEL: Record<string, string> = {
  name: 'Venue name', city: 'City', state: 'State', country: 'Country', address: 'Address', venue_type: 'Venue type',
  capacity: 'Capacity', best_for: 'Best for', amenities: 'Amenities', description: 'Description',
  website_or_maps_url: 'Website / Maps link', google_business_url: 'Google Business link', photos: 'Photos',
};

// PROMPT 29 / 30 — internal notes + audit history (client-safe shapes).
export type AdminNote = { id?: string; author?: string; text: string; created_at?: string };
export type AuditEvent = { action: string; actor?: string; at?: string; from?: string; to?: string; note?: string };

// PROMPT 33 — venue ownership claim review (client-safe shapes).
export type ClaimStatus = 'claim_submitted' | 'verification_required' | 'verified' | 'rejected';
export const CLAIM_META: Record<ClaimStatus, { label: string; badge: string }> = {
  claim_submitted: { label: 'Claim submitted', badge: 'bg-accent/10 text-accent-600' },
  verification_required: { label: 'Verification required', badge: 'bg-accent/15 text-accent-600' },
  verified: { label: 'Verified', badge: 'bg-brand-50 text-brand-700' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' },
};
export type VenueClaim = {
  id?: string;
  claimant?: string;
  relationship?: string;
  supporting?: string;
  contact?: string;
  status: ClaimStatus;
  created_at?: string;
};

// PROMPT 35 — internal completeness / quality score (client-safe shapes).
export type QualityIndicator = { label: string; met: boolean };
export type QualityScore = { pct: number; met: number; total: number; indicators: QualityIndicator[] };
