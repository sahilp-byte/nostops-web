// Shared, client-safe display helpers for Guru nomination statuses (website pipeline).
/** Main-backend (mobile app) status for a nomination waiting for admin review. */
export const APP_PENDING = 'pending_admin_review';

export const NOMINATION_TONE: Record<string, string> = {
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
  info_requested: 'bg-orange-50 text-orange-800 border-orange-200',
  with_council: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  council_approved: 'bg-teal-50 text-teal-800 border-teal-200',
  accepted: 'bg-teal-50 text-teal-800 border-teal-200',
  published: 'bg-green-50 text-green-800 border-green-200',
  declined: 'bg-gray-100 text-gray-700 border-gray-200',
  council_declined: 'bg-gray-100 text-gray-700 border-gray-200',
  guru_declined: 'bg-gray-100 text-gray-700 border-gray-200',
  withdrawn: 'bg-gray-100 text-gray-700 border-gray-200',
};

/** The nominator's 5-step progress line. Index of the step the nomination has reached; -1 = closed. */
export const NOMINATION_STEPS = ['Received', 'Reviewed', 'Council', 'Guru invited', 'Published'];

export function nominationStep(status: string): number {
  switch (status) {
    case 'pending_review':
    case 'info_requested':
      return 0;
    case 'with_council':
      return 2;
    case 'council_approved':
    case 'accepted':
      return 3;
    case 'published':
      return 4;
    default:
      return -1;
  }
}
