import { renderTeacherOg } from '@/lib/server/teacher-og';

// Stable same-origin URL for the teacher's social share card, used by the in-app
// ShareCardPreview. Re-renders the SAME next/og image as the public profile's
// opengraph-image (which lives at an unpredictable hashed URL). Public data only.
export const runtime = 'nodejs';
export const revalidate = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return renderTeacherOg(handle);
}
