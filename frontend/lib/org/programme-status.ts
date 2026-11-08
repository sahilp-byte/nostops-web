// Honest programme status (B2.3 audit). Programmes keep the "Council-curated"
// label, but until the Council approves their content (content_status leaves
// SEED_DEVELOPMENT) every surface shows this development note. A missing status
// (older event snapshots) is treated as still in development.
export const PROGRAMME_DEV_NOTE = 'In development — pending Council review';

export const pendingCouncilReview = (p?: { content_status?: string | null } | null): boolean =>
  !p?.content_status || p.content_status === 'SEED_DEVELOPMENT';
