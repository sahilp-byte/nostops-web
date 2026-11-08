import { renderTeacherOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/teacher-og';

// Dynamic per-teacher Twitter/X image (same branded card as OG). Next wires this
// to twitter:image on the public profile page, so shares on X show a
// teacher-specific preview rather than a generic one.
export const runtime = 'nodejs';
export const revalidate = 120;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga teacher profile';

export default async function TwitterImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return renderTeacherOg(handle);
}
