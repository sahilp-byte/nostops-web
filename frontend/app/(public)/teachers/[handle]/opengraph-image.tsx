import { renderTeacherOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/teacher-og';

// Dynamic per-teacher Open Graph image. Next wires this to og:image on the
// public profile page automatically (absolute URL via metadataBase).
export const runtime = 'nodejs';
export const revalidate = 120;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga teacher profile';

export default async function OgImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return renderTeacherOg(handle);
}
