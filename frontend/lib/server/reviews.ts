// Server-only: public reviews for a teacher (learner-facing). Reads the
// public reviews endpoint (by handle) which returns approved review texts +
// a rating distribution. No private data. Field names are mapped defensively
// because the live dataset currently has few/no written reviews.
import { apiGetSafe } from '@/lib/api';

export type Review = {
  id?: string;
  author: string;
  rating?: number;
  text?: string;
  createdAt?: string;
  reply?: string;
};

export type ReviewStats = {
  avg: number;
  count: number;
  five: number;
  four: number;
  three: number;
  two: number;
  one: number;
};

export type ReviewsData = { reviews: Review[]; stats: ReviewStats };

export async function getReviews(
  handle: string,
  opts: { revalidate?: number; noStore?: boolean } = { noStore: true },
): Promise<ReviewsData> {
  const d = await apiGetSafe<any>(
    `/public-reviews/${encodeURIComponent(handle)}`,
    { reviews: [], stats: {} },
    opts,
  );
  const raw = Array.isArray(d?.reviews) ? d.reviews : [];
  const reviews: Review[] = raw
    .map((r: any) => ({
      id: r.review_id || r.id,
      author: (r.author_name || r.reviewer_name || r.student_name || r.name || 'Learner').toString(),
      rating: typeof r.rating === 'number' ? r.rating : undefined,
      text: (r.text || r.review_text || r.comment || r.body || '').toString(),
      createdAt: r.created_at || r.createdAt,
      reply: (r.reply_text || r.reply || '').toString() || undefined,
    }))
    .filter((r: Review) => (r.text && r.text.trim()) || typeof r.rating === 'number');

  const s = d?.stats || {};
  const stats: ReviewStats = {
    avg: Number(s.avg || 0),
    count: Number(s.count || 0),
    five: Number(s.five || 0),
    four: Number(s.four || 0),
    three: Number(s.three || 0),
    two: Number(s.two || 0),
    one: Number(s.one || 0),
  };
  return { reviews, stats };
}
